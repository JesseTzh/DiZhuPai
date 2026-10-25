import { P, Dv, setOrigin, paintOrder, pd, sp } from '../engine/camera.js';
import { hull } from '../engine/math.js';
import { facing, tone, SH, SHADOW_LEN, SHADOW_K } from '../engine/shading.js';
import { INK, SHADOW } from '../engine/palette.js';
import { inkScale, tag, txM } from '../engine/primitives.js';
import { svgElement, setAttributes, patchSvg } from '../engine/svg-dom.js';
import {
  cardIds,
  cardDeck,
  cardOutline,
  cardCream,
  cardStock,
  cardW,
  cardH,
  cardThickness,
  cardInkScale,
} from './constants.js';
import { cardFrontPrints, cardBackPrint } from '../assets/cards/index.js';
import { cardGeometry } from './model.js';

const weight = (width) => (width * cardInkScale).toFixed(2);
const stroke = (width) => ({
  fill: 'none',
  stroke: INK,
  'stroke-width': weight(width),
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});

function silhouette(points) {
  const outline = hull(points.map((point) => P(...point)));
  let area = 0,
    perimeter = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    area += a[0] * b[1] - b[0] * a[1];
    perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const thickness = perimeter ? Math.abs(area) / perimeter / 218 : 0;
  return { d: sp(outline), 'stroke-width': weight(Math.min(2.8, 0.9 + 20 * thickness)) };
}

/** Retained scene: every card, face, print, shadow and label owns stable nodes.
 * No SVG parsing or element allocation is needed in the card animation loop.
 */
export function createCardRenderer(art, svg) {
  const defs = svgElement('defs');
  defs.innerHTML = inkScale(
    cardFrontPrints.map((print, id) => `<g id="card-print-${id}">${print}</g>`).join('') +
      '<g id="card-print-back"></g>',
  );
  const back = defs.lastElementChild;
  const shadows = svgElement('g'),
    deck = svgElement('g'),
    labels = svgElement('g');
  const labelGroups = cardIds.map(() => svgElement('g'));
  labels.append(...labelGroups);
  art.append(defs, shadows, deck, labels);
  const cards = cardIds.map((id) => {
    const group = svgElement('g', {
      class: 'playing-card',
      'data-card': id,
      'data-key': cardDeck[id].key,
      'aria-label': cardDeck[id].name,
      role: 'img',
    });
    const sides = cardOutline.map(() =>
      svgElement('path', { 'stroke-width': weight(0.7), 'stroke-linejoin': 'round' }),
    );
    const surface = svgElement('path', { fill: cardCream }),
      print = svgElement('use');
    const outline = svgElement('path', stroke(1.8)),
      ink = svgElement('path', stroke(2.8));
    const shadow = svgElement('path', { fill: SHADOW });
    group.append(...sides, surface, print, outline, ink);
    deck.append(group);
    shadows.append(shadow);
    return {
      group,
      sides,
      surface,
      print,
      outline,
      ink,
      shadow,
      geometry: null,
      flip: null,
    };
  });
  let palette = null,
    signature = '';

  return (state, material) => {
    const nextSignature = [state.pal, ...state.flips, ...state.busy].join('|');
    if (signature === nextSignature) return;
    signature = nextSignature;
    if (palette !== state.pal) {
      back.innerHTML = inkScale(cardBackPrint(material, 'shared'));
      palette = state.pal;
    }
    const models = cards.map((card, id) => {
      if (card.flip !== state.flips[id]) {
        card.geometry = cardGeometry(id, state);
        card.flip = state.flips[id];
      }
      return card.geometry;
    });
    setOrigin(0, 0);
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const model of models)
      for (const point of model.all) {
        const [x, y] = P(...point);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    const baseW = 900,
      baseH = 720;
    const scale = Math.max(1, (maxX - minX) / (baseW * 0.88), (maxY - minY) / (baseH * 0.8));
    const width = baseW * scale,
      height = baseH * scale;
    setOrigin(width / 2 - (minX + maxX) / 2, height * 0.46 - (minY + maxY) / 2);
    setAttributes(svg, { viewBox: `0 0 ${width} ${height}` });

    const [sx, sy] = SH,
      shadowScale = SHADOW_LEN / SHADOW_K;
    for (const [id, model] of models.entries()) {
      const card = cards[id],
        front = facing(model.basisN),
        ring = front ? model.ringB : model.ringA;
      setAttributes(card.group, { 'data-face': front ? 'front' : 'back' });
      model.faces.forEach((face, i) => {
        const visible = facing(face.normal),
          node = card.sides[i];
        setAttributes(node, { display: visible ? 'inline' : 'none' });
        if (visible) {
          const color = tone(face.normal, cardStock);
          setAttributes(node, { d: pd(face.points), fill: color, stroke: color });
        }
      });
      const d = pd(ring);
      setAttributes(card.surface, { d });
      setAttributes(card.outline, { d });
      const origin = front
        ? model.point(-cardW / 2, -cardH / 2, cardThickness / 2 + 0.005)
        : model.point(cardW / 2, -cardH / 2, -cardThickness / 2 - 0.005);
      const readU = front ? model.basisU : model.basisU.map((n) => -n);
      setAttributes(card.print, {
        transform: txM(P(...origin), Dv(...readU), Dv(...model.basisV)),
        href: `#card-print-${front ? id : 'back'}`,
      });
      setAttributes(card.ink, silhouette(model.all));
      setAttributes(card.shadow, {
        d: sp(
          hull(
            model.all.map(([x, y, z]) => P(x + z * sx * shadowScale, y + z * sy * shadowScale, 0)),
          ),
        ),
      });
    }
    const ordered = models.map((model, id) => ({ at: model.center, box: model.bounds, id }));
    ordered.sort(paintOrder);
    let cursor = deck.firstElementChild;
    for (const { id } of ordered) {
      const node = cards[id].group;
      if (node !== cursor) deck.insertBefore(node, cursor);
      cursor = node.nextElementSibling;
    }
    for (const id of cardIds) {
      const text = cardDeck[id].label;
      patchSvg(
        labelGroups[id],
        inkScale(tag(models[id].point(0, -cardH / 2, 0), 0, -18, text, state.busy[id])),
      );
    }
  };
}
