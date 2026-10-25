import test from 'node:test';
import assert from 'node:assert/strict';
import { setCameraPitch, paintOrder } from '../src/engine/camera.js';
import { cardOutline, cardW, cardThickness } from '../src/cards/constants.js';
import { handPose } from '../src/game/scene-frame.js';

// Mirror of the pure half of ModelCanvas.cardGeometry (model-canvas.js) plus the bounds helper
// from cpu-renderer.js: the box each card part contributes to the painter's sort.
const cardBox = (pose) => {
  const { u, v, z = 2, scale = 0.86, flip = 0, thickness = 0.76 } = pose,
    ct = Math.cos(flip),
    st = Math.sin(flip);
  const c = [(u + v) / Math.SQRT2, (v - u) / Math.SQRT2, z + (Math.abs(st) * cardW * scale) / 2];
  const U = [ct / Math.SQRT2, -ct / Math.SQRT2, -st],
    V = [1 / Math.SQRT2, 1 / Math.SQRT2, 0],
    N = [st / Math.SQRT2, -st / Math.SQRT2, ct];
  const point = (a, b, h) => c.map((q, k) => q + scale * (a * U[k] + b * V[k] + h * N[k]));
  const corners = cardOutline.flatMap(([a, b]) => [
    point(a, b, -thickness / 2),
    point(a, b, thickness / 2),
  ]);
  return {
    at: c,
    box: [0, 1, 2].map((axis) => [
      Math.min(...corners.map((p) => p[axis])),
      Math.max(...corners.map((p) => p[axis])),
    ]),
  };
};

// The table scene as cpu-renderer.draw assembles it: decks, both hands, then the played row
// (poses as in scene-frame.js: sorted big-to-small, left to right, z rising 0.1 per card).
function tableParts({ n0, n1, d0 = 25, d1 = 25, nPlayed = 7 }) {
  const parts = [];
  const push = (pose, tag) => parts.push({ ...cardBox(pose), tag });
  const deckPose = (p) => {
    const thickness = (p === 0 ? d0 : d1) * cardThickness;
    return {
      u: 315,
      v: p === 0 ? 180 : -165,
      z: 1 + (thickness * 0.82) / 2,
      thickness,
      scale: 0.82,
      flip: Math.PI,
    };
  };
  if (d0 > 0) push(deckPose(0), 'deck0');
  for (let i = 0; i < n0; i++) push(handPose(0, i, n0), 'h0-' + i);
  if (d1 > 0) push(deckPose(1), 'deck1');
  for (let i = 0; i < n1; i++) push(handPose(1, i, n1), 'h1-' + i);
  const gap = Math.min(42, 445 / Math.max(1, nPlayed - 1));
  for (let i = 0; i < nPlayed; i++)
    push({ u: (i - (nPlayed - 1) / 2) * gap, v: 0, z: 6 + i * 0.1, scale: 0.86 }, 'P' + i);
  return parts;
}

const drawOrder = (parts) => [...parts].sort(paintOrder).map((p) => p.tag);
const inIndexOrder = (tags, prefix) => {
  const picked = tags.filter((tag) => tag.startsWith(prefix));
  assert.deepEqual(
    picked,
    picked.map((_, i) => prefix + i),
  );
};

test('game camera pitch keeps paintOrder a pure stacking order for flat cards', () => {
  setCameraPitch(68, 1800);
  // Seed 78ke7yi8 regression: the computer's 8910JQKA straight rendered with the 9 covered from
  // both sides — the old pairwise comparator (sepOrder || depth) is not transitive and the sort
  // scrambled the row whenever the hands held 14 and 6 cards.
  const tags = drawOrder(tableParts({ n0: 14, n1: 6 }));
  inIndexOrder(tags, 'P');
  inIndexOrder(tags, 'h0-');
  inIndexOrder(tags, 'h1-');
});

test('every hand size and straight length paints the played row without both-side covers', () => {
  setCameraPitch(68, 1800);
  for (let n0 = 0; n0 <= 20; n0++)
    for (let n1 = 0; n1 <= 20; n1++)
      for (const d0 of [0, 25])
        for (const d1 of [0, 25])
          for (const nPlayed of [2, 5, 7, 12]) {
            const tags = drawOrder(tableParts({ n0, n1, d0, d1, nPlayed }));
            inIndexOrder(tags, 'P');
            inIndexOrder(tags, 'h0-');
            inIndexOrder(tags, 'h1-');
          }
});
