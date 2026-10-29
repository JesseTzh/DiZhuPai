import { pd } from '../engine/camera.js';
import { facing } from '../engine/shading.js';
import { PALS } from '../engine/palette.js';
import { coinShape } from '../coins/coin.js';
import { cardW, cardH } from '../cards/constants.js';
import { ITEMS } from './items.js';
import { tableItemHit, drawTableItem } from './table-items.js';
import { deckMarkup, wildMarkup, handCardMarkup, bagMarkup, itemMarkup } from './scene-overlay.js';

/* Turn a scene frame into painter's parts: { at, key, extent, draw }. `key` names every input
 * of a part's pixels apart from the view (null: the part changes every frame); the renderer
 * retains a sprite for a key that repeats. Shadows go into the canvas's shared shadow run and
 * hit areas into `overlay` / `hits`, with projected paths memoised per key. */
const SACK_SCALE = 1.08;
const poseKey = ({ u, v, z = 2, scale = 0.86, flip = 0, thickness = 0.76 }) =>
  `${u}|${v}|${z}|${scale}|${flip}|${thickness}`;
const coinKey = (c) => `${c.mode},${c.x},${c.y},${c.z},${c.a},${c.b},${c.psi}`;
const sackMap = (pos) => (p) => p.map((q, i) => pos[i] + SACK_SCALE * (q - (i === 2 ? 0 : 48)));
// The eight corners of a card's slab bound everything card() paints, outline stroke aside.
const cardCorners = (g) => {
  const corners = [];
  for (const a of [-cardW / 2, cardW / 2])
    for (const b of [-cardH / 2, cardH / 2])
      for (const h of [-g.thickness / 2, g.thickness / 2]) corners.push(g.point(a, b, h));
  return corners;
};

export function cardParts(scene, frame, st, images, hover) {
  const { canvas, sprites, layout, parts, overlay, hits } = scene;
  for (const { id, pose, options } of frame.cards) {
    const lifted = options.act ? hover.get(options.handIndex) || 0 : 0;
    // Slide on the tabletop; retain the resting pose for stacking and hit order.
    const lift = options.selected ? layout.selectedLift : 12 * lifted;
    const resting = canvas.cardGeometry(pose);
    const shown = lift ? { ...pose, v: pose.v - lift } : pose;
    const g = lift ? canvas.cardGeometry(shown) : resting;
    const front = facing(g.N) && !options.back;
    const art = front
      ? options.wild
        ? 'wild'
        : `f${options.stampFace || id}`
      : `b${options.palette || st.pal}`;
    const image = front
      ? options.wild
        ? images.wild
        : images.fronts[options.stampFace || id]
      : images.backs[options.palette || st.pal];
    const key = `card|${art}|${poseKey(shown)}|${options.selected ? 1 : 0}|${options.deckCount || 0}`;
    if (options.shadow !== false)
      canvas.addShadowRing(sprites.memo(key, 'shadow', () => canvas.shadowRing([...g.A, ...g.B])));
    parts.push({
      at: resting.c,
      key,
      extent: () => canvas.extent(cardCorners(g), 2),
      draw: () => canvas.card(g, image, options),
    });
    // Hover never moves its own hit area: a stationary pointer cannot retrigger it.
    const hit = options.selected ? g : resting,
      hitKey = options.selected ? key : `card|${art}|${poseKey(pose)}|0|${options.deckCount || 0}`,
      ring = () => sprites.memo(hitKey, 'ring', () => pd(facing(hit.N) ? hit.B : hit.A));
    if (options.deckCount) overlay.push(deckMarkup(options, pose.thickness, ring()));
    if (options.wild || options.revealing) overlay.push(wildMarkup(id, options, ring()));
    if (options.act)
      hits.push({ at: resting.c, markup: handCardMarkup(id, options, lifted, ring()) });
  }
}

export function bagParts(scene, frame, images) {
  const { canvas, sprites, parts, overlay } = scene;
  for (const { pos, state, palette, player } of frame.bags) {
    const model = canvas.sackGeometry(state, player),
      m = model.m,
      map = sackMap(pos);
    const grounded = state.coins.filter((c) => c.mode !== 'rain'),
      // sack() also draws the coins falling in above the neck.
      drawn = state.coins.filter((c) => c.mode !== 'rain' || c.z >= m.Hb);
    // The shape key covers fill, squash and punch; with every coin pose it names the pixels.
    // The punch burst reaches far past the cloth, so a sack that shows it is never retained.
    const burst = state.punchT != null && state.punchT < 0.3,
      key = burst
        ? null
        : `bag|${player}|${palette}|${model.key}|${pos}|${state.coins.map(coinKey).join(';')}`;
    canvas.addShadowRing(
      sprites.memo(key, 'shadow', () =>
        canvas.shadowRing([...m.body[2], ...m.body[8], ...m.shell.at(-1)].map(map)),
      ),
    );
    for (const c of grounded) {
      const g = canvas.coinGeometry(c);
      canvas.addShadowRing(
        sprites.memo(c.mode === 'rest' ? `coin|${pos}|${coinKey(c)}` : null, 'shadow', () =>
          canvas.shadowRing([...g.A, ...g.B].map(map)),
        ),
      );
    }
    parts.push({
      at: pos.map((q, i) => q + (i === 2 ? 30 : 0)),
      key,
      extent: () =>
        canvas.extent(
          [
            ...m.body.flat(),
            ...m.shell.flat(),
            ...drawn.flatMap((c) => {
              const g = canvas.coinGeometry(c);
              return [...g.A, ...g.B];
            }),
          ].map(map),
          4,
        ),
      draw: () => canvas.sack(model, state, PALS[palette], pos, SACK_SCALE, images.coin),
    });
    const hit = player === 0 ? sprites.memo(key, 'hit', () => pd(m.body[5].map(map))) : '';
    overlay.push(bagMarkup(player, palette, state.fillShow, hit));
  }
}

export function coinParts(scene, frame, images) {
  const { canvas, parts } = scene;
  for (const { c, tilt, heading, psi } of frame.coins) {
    const g = coinShape(c, tilt, heading, psi);
    canvas.addShadow([...g.A, ...g.B], 0);
    parts.push({ at: c, key: null, draw: () => canvas.coin(g, images.coin) });
  }
}

export function itemParts(scene, models) {
  const { canvas, sprites, parts, overlay } = scene;
  for (const { id, model, key } of models) {
    parts.push({
      at: model.at,
      key,
      extent: () => canvas.extent(model.points, 2),
      draw: () => drawTableItem(canvas, model),
    });
    const item = ITEMS.find((item) => item.id === id);
    overlay.push(
      itemMarkup(
        item,
        sprites.memo(key, 'hit', () => tableItemHit(canvas, model)),
      ),
    );
  }
}
