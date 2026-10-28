import { cardThickness } from '../cards/constants.js';
import { P, setOrigin, setCenter } from '../engine/camera.js';
import { sackModel } from '../coins/sack.js';
import { sortHand, rankIn } from './rules.js';
import { world } from './table.js';
import {
  wildReveal,
  stampReveal,
  stampSlide,
  stampStart,
  STAMP_REVEAL_DURATION,
  DEAL_DURATION,
} from './wild-reveal.js';
import { transferCoinPose, TRANSFER_DURATION, STEAL_DURATION } from './transfer.js';
import { DESKTOP_LAYOUT } from './scene-layout.js';
import { selectedHandIndices } from './selection.js';

// Layout and animation state only; no rendering calls.
export const playerPalette = (key) => (key === 'tomato' ? 'cobalt' : key);
const rowV = (layout, p) => layout.rowV[p];
export const bagPosition = (p, layout = DESKTOP_LAYOUT) => world(layout.bagU, rowV(layout, p));
export const deckPosition = (p, layout = DESKTOP_LAYOUT) => ({
  u: layout.deckU,
  v: rowV(layout, p),
});
export function handPose(p, index, count, layout = DESKTOP_LAYOUT) {
  const spacing = layout.handSpan
    ? Math.min(layout.handSpacing, layout.handSpan / Math.max(1, count - 1))
    : layout.handSpacing;
  return {
    u: (index - (count - 1) / 2) * spacing,
    v: rowV(layout, p),
    z: 3 + index * 0.08,
    scale: layout.handScale,
    flip: p === 0 ? 0 : Math.PI,
  };
}
export function fitScene(
  svg,
  viewport,
  { zoom = 1, surface, centerY, bounds, padX = 45, padY = 55, tall = 82 } = {},
) {
  setCenter([0, 0], 0);
  setOrigin(0, 0);
  const u0 = bounds ? bounds.u0 : -372,
    u1 = bounds ? bounds.u1 : 372,
    v0 = bounds ? bounds.v0 : -273,
    v1 = bounds ? bounds.v1 : 273;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const u of [u0, u1])
    for (const v of [v0, v1])
      for (const z of [0, tall]) {
        const [x, y] = P(...world(u, v, z));
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  const rect = viewport || svg.getBoundingClientRect(),
    ratio = rect.width && rect.height ? rect.height / rect.width : 0.77;
  const width = Math.max(maxX - minX + padX, (maxY - minY + padY) / ratio) / zoom,
    height = width * ratio;
  let originY = (height - minY - maxY) / 2;
  if (surface && centerY != null && rect.height) {
    const ys = surface.map((point) => P(...point)[1]);
    originY = (centerY * height) / rect.height - (Math.min(...ys) + Math.max(...ys)) / 2;
  }
  setOrigin((width - minX - maxX) / 2, originY);
  const view = `0 0 ${width} ${height}`;
  if (svg.getAttribute('viewBox') !== view) svg.setAttribute('viewBox', view);
}
export function sceneFrame(st, layout = DESKTOP_LAYOUT) {
  const { game, visual } = st;
  if (visual.home && !visual.entry) return { cards: [], bags: [], coins: [], labels: [] };
  const cards = [],
    bags = [],
    coins = [],
    labels = [],
    pockets = [[], []];
  const ownPalette = playerPalette(st.pal);
  const label = (text, u, v, z = 0, cls = 'scene-label') => labels.push({ text, u, v, z, cls });
  const card = (id, pose, options = {}) => cards.push({ id, pose, options });
  for (const tr of [visual.transfer, visual.spill].filter(Boolean)) {
    const mouths = [0, 1].map((p) => {
      const m = sackModel(visual.bags[p]),
        pos = bagPosition(p, layout),
        axis = m.axis(m.top);
      return { m, pos, at: pos.map((q, k) => q + 1.08 * (axis[k] - (k === 2 ? 0 : 48))) };
    });
    for (let i = 0; i < tr.amount; i++) {
      const pose = transferCoinPose(
        tr,
        i,
        tr.elapsed ?? visual.time - tr.start,
        mouths[tr.from].at,
        mouths[1 - tr.from].at,
      );
      if (!pose) continue;
      const { c, tilt, heading, psi, phase } = pose;
      const owner = [tr.from, 1 - tr.from].find(
        (p) =>
          Math.hypot(c[0] - mouths[p].at[0], c[1] - mouths[p].at[1]) < mouths[p].m.rimR * 1.08 &&
          c[2] < mouths[p].at[2] + 3,
      );
      if (owner != null && phase !== 'rest' && phase !== 'bounce') {
        const pos = mouths[owner].pos;
        pockets[owner].push({
          mode: 'rain',
          x: 48 + (c[0] - pos[0]) / 1.08,
          y: 48 + (c[1] - pos[1]) / 1.08,
          z: c[2] / 1.08,
          a: tilt,
          b: heading,
          psi,
        });
      } else coins.push({ c, tilt, heading, psi });
    }
  }
  for (let p = 0; p < 2; p++) {
    const pos = bagPosition(p, layout),
      bag = visual.bags[p],
      palette = p === 0 ? ownPalette : 'tomato';
    bags.push({ pos, state: { ...bag, coins: [...bag.coins, ...pockets[p]] }, palette, player: p });
    if (visual.transfer) {
      const tr = visual.transfer,
        elapsed = tr.elapsed ?? visual.time - tr.start;
      if (elapsed < TRANSFER_DURATION) {
        const delta = p === tr.from ? -tr.amount : tr.amount;
        label(
          `${delta > 0 ? '+' : ''}${delta}`,
          layout.bagU,
          rowV(layout, p),
          100 + elapsed * 8,
          'coin-delta ' + (delta > 0 ? 'gain' : 'loss'),
        );
      }
    }
    const deck = deckPosition(p, layout),
      count = game.phase === 'ready' ? 54 : game.decks[p].length;
    if (count > 0) {
      const thickness = count * cardThickness;
      card(
        0,
        {
          ...deck,
          z: 1 + (thickness * 0.82) / 2,
          thickness,
          scale: layout.deckScale,
          flip: Math.PI,
        },
        { back: true, palette, deckCount: count, player: p },
      );
    }
    const hand = visual.entry && !game.round ? [] : game.hands[p];
    // While dealing, the stamped card still sits at its natural spot; the reveal
    // then slides the whole row from the natural order to the upgraded order.
    const stamp = p === 0 ? game.stamp : null;
    const naturalIndex =
      stamp && game.phase === 'dealing'
        ? new Map(
            [...hand]
              .sort((a, b) => rankIn(b, { stamp }) - rankIn(a, { stamp }) || a - b)
              .map((id, index) => [id, index]),
          )
        : null;
    const stampT =
      stamp && game.phase === 'dealing'
        ? (visual.dealTime - stampStart(game)) / STAMP_REVEAL_DURATION
        : 0;
    const stolen = visual.steal?.cards;
    for (let i = 0; i < hand.length; i++) {
      if (p === 0 && stolen && visual.time - visual.steal.start < STEAL_DURATION) {
        if (stolen.includes(hand[i])) continue;
      }
      let index = i;
      if (naturalIndex) {
        const from = naturalIndex.get(hand[i]);
        index = stampT <= 0 ? from : from + (i - from) * stampSlide(stampT);
      }
      let pose = handPose(p, index, hand.length, layout);
      if (game.phase === 'dealing') {
        const t = Math.max(0, Math.min(1, (visual.dealTime - (i * 2 + p) * 0.043) / 0.48));
        if (t === 0) continue;
        const e = t * t * (3 - 2 * t);
        pose = {
          ...pose,
          u: deck.u + (pose.u - deck.u) * e,
          v: deck.v + (pose.v - deck.v) * e,
          z: 7 + (pose.z - 7) * e + Math.sin(t * Math.PI) * 50,
          flip: p === 0 ? Math.PI * (1 - e) : Math.PI,
        };
      }
      const isWild = p === 0 && hand[i] === game.wildCard;
      const reveal = isWild ? wildReveal(pose, visual.dealTime, game.phase === 'dealing') : null;
      // the stamped card flips over mid-air and lands showing its upgraded face
      const stamping = stamp && hand[i] === stamp.card && game.phase === 'dealing' && stampT > 0;
      const stampFlip = stamping ? stampReveal(stampT) : null;
      if (stampFlip) {
        pose = { ...pose, flip: pose.flip + stampFlip.flip, z: pose.z + stampFlip.hop };
      }
      const shown =
        !!stamp &&
        hand[i] === stamp.card &&
        (game.phase !== 'dealing' || (stamping && stampFlip.stamped));
      card(hand[i], reveal?.pose || pose, {
        dynamic:
          reveal?.dynamic ||
          stampFlip?.dynamic ||
          (game.phase === 'dealing' && visual.dealTime < (i * 2 + p) * 0.043 + 0.48),
        back: p === 1,
        palette,
        selected: p === 0 && selectedHandIndices(game).includes(i),
        handIndex: i,
        shadowEffect: st.hoverShadow,
        act: p === 0 ? `hand-${i}` : null,
        name:
          st.cardNames[shown ? stamp.card + 1 : hand[i]] +
          (isWild ? ' · 赖子' : shown && !isWild ? ' · 印章' : ''),
        wild: reveal?.wild || false,
        revealing: isWild && game.phase === 'dealing' && visual.dealTime > DEAL_DURATION,
        stampFace: shown ? stamp.card + 1 : null,
      });
    }
  }
  // The mouse drags the taken play from the table back into the growing hand.
  if (visual.steal && visual.time - visual.steal.start < STEAL_DURATION) {
    const t = Math.max(0, Math.min(1, (visual.time - visual.steal.start) / STEAL_DURATION)),
      e = t * t * (3 - 2 * t);
    for (const [i, id] of visual.steal.cards.entries()) {
      const index = game.hands[0].indexOf(id);
      if (index < 0) continue;
      const to = handPose(0, index, game.hands[0].length, layout);
      card(
        id,
        {
          u: visual.steal.from[i] + (to.u - visual.steal.from[i]) * e,
          v: to.v * e,
          z: 6 + (to.z - 6) * e + Math.sin(t * Math.PI) * 30,
          scale: layout.handScale,
          flip: 0,
        },
        {
          dynamic: true,
          palette: ownPalette,
          stampFace: game.stamp?.card === id ? game.stamp.card + 1 : null,
        },
      );
    }
  }
  const lastPlay = game.target || (game.last?.type === 'play' ? game.last : null);
  if (lastPlay) {
    const played = sortHand(lastPlay.cards, lastPlay.player === 0 ? { stamp: game.stamp } : null),
      n = played.length,
      gap = Math.min(layout.playGap, 445 / Math.max(1, n - 1));
    for (let i = 0; i < n; i++) {
      const t = Math.min(1, visual.playTime / 0.36),
        e = t * t * (3 - 2 * t),
        from = visual.playFrom?.[i];
      let pose = { u: (i - (n - 1) / 2) * gap, v: 0, z: 6 + i * 0.1, scale: layout.playScale };
      if (from && t < 1)
        pose = {
          ...pose,
          u: from.u + (pose.u - from.u) * e,
          v: from.v + (pose.v - from.v) * e,
          z: 6 + Math.sin(t * Math.PI) * 30,
          flip: Math.PI * (1 - e) * (lastPlay.player === 1 ? 1 : 0),
        };
      card(played[i], pose, {
        dynamic: !!from && t < 1,
        palette: lastPlay.player === 0 ? ownPalette : 'tomato',
        wild: lastPlay.player === 0 && played[i] === game.wildCard,
        stampFace:
          lastPlay.player === 0 && game.stamp?.card === played[i] ? game.stamp.card + 1 : null,
      });
    }
    label(`${lastPlay.player === 0 ? '你' : '电脑'} · ${lastPlay.move.name}`, 0, -63);
  }
  const entry = visual.entry;
  if (entry) {
    // Fall in world space so perspective, shadows and hit regions travel together.
    const fall = (delay) => {
      const t = Math.max(0, Math.min(1, (entry.time - delay) / 0.44));
      const z =
        t < 0.76 ? 320 * (1 - (t / 0.76) ** 2) : 12 * Math.sin(((t - 0.76) / 0.24) * Math.PI);
      return { visible: entry.time >= delay, z };
    };
    for (let i = cards.length - 1; i >= 0; i--) {
      const item = cards[i];
      const player = item.pose.v > 0 ? 0 : 1;
      const drop = fall(0.72 + player * 0.05);
      if (!drop.visible || (!game.round && !item.options.back)) cards.splice(i, 1);
      else item.pose = { ...item.pose, z: item.pose.z + drop.z };
    }
    for (let i = bags.length - 1; i >= 0; i--) {
      const drop = fall(0.84 + bags[i].player * 0.05);
      if (!drop.visible) bags.splice(i, 1);
      else bags[i].pos = bags[i].pos.map((value, axis) => value + (axis === 2 ? drop.z : 0));
    }
    return { cards, bags, coins: [], labels: [] };
  }
  return { cards, bags, coins, labels };
}
