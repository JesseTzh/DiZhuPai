import test from 'node:test';
import assert from 'node:assert/strict';
import { cardGeometry } from '../src/cards/model.js';
import { cardCount, cardIds, cardW, cardH, cardThickness } from '../src/cards/constants.js';
import { dot } from '../src/engine/math.js';
import { P, Dv, depthOf, sepOrder } from '../src/engine/camera.js';
import { world } from '../src/game/table.js';
import { noiseRegion, filterFor } from '../src/engine/filter.js';
import { cardFlip } from '../src/cards/animation.js';

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
const state = (angle) => ({ flips: cardIds.map(() => angle), busy: cardIds.map(() => false) });

test('fixed overhead projection preserves table proportions and sorts only by height', () => {
  assert.deepEqual(Dv(0, 0, 1), [0, 0]);
  assert.deepEqual(P(100, 200, 0), P(100, 200, 90));
  const right = Dv(...world(1, 0)),
    down = Dv(...world(0, 1));
  close(right[1], 0);
  close(down[0], 0);
  close(right[0], down[1]);
  assert.ok(right[0] > 0);
  close(depthOf([100, -200, 7]), 7);
  assert.equal(
    sepOrder(
      {
        box: [
          [0, 0, 10],
          [1, 1, 11],
        ],
      },
      {
        box: [
          [2, 2, 0],
          [3, 3, 1],
        ],
      },
    ),
    1,
  );
});

test('all 54 cards retain physical dimensions and clear the table throughout a flip', () => {
  for (const angle of [0, 30, 90, 135, 180, 270, 360]) {
    const st = state(angle);
    for (const id of cardIds) {
      const g = cardGeometry(id, st);
      close(Math.hypot(...g.basisU), 1);
      close(Math.hypot(...g.basisV), 1);
      close(Math.hypot(...g.basisN), 1);
      close(dot(g.basisU, g.basisV), 0);
      close(
        Math.hypot(...g.point(cardW / 2, 0, 0).map((v, k) => v - g.point(-cardW / 2, 0, 0)[k])),
        cardW,
      );
      close(
        Math.hypot(...g.point(0, cardH / 2, 0).map((v, k) => v - g.point(0, -cardH / 2, 0)[k])),
        cardH,
      );
      assert.ok(g.all.every((p) => p[2] >= 0.6 - cardThickness / 2 - 1e-9));
      for (const p of g.all)
        for (let axis = 0; axis < 3; axis++)
          assert.ok(p[axis] >= g.bounds[0][axis] && p[axis] <= g.bounds[1][axis]);
    }
  }
});

test('desktop layout preserves unique centers across its nine-column grid', () => {
  const models = cardIds.map((id) => cardGeometry(id, state(0)));
  assert.equal(new Set(models.map((g) => g.center.join())).size, cardCount);
  const delta = models[9].center.map((v, i) => v - models[0].center[i]);
  close(Math.hypot(...delta), 104);
});

test('overlapping flip requests preserve busy cards and settle at a face-up state', () => {
  const st = state(0),
    steps = [];
  const ui = { animate: (step) => steps.push(step) };
  cardFlip(st, ui, [0, 1]);
  cardFlip(st, ui, [1, 2]);
  assert.equal(steps.length, 2);
  for (const step of steps) assert.equal(step(1), false);
  assert.deepEqual(st.flips.slice(0, 4), [180, 180, 180, 0]);
  assert.ok(st.busy.every((v) => !v));
  cardFlip(st, ui, cardIds, true);
  steps.at(-1)(1);
  assert.ok(st.flips.every((v) => v === 0));
});

test('noise cache covers its view, grows on a stable grid and respects the memory budget', () => {
  const view = { x: 0, y: 0, width: 1046, height: 837 },
    region = noiseRegion(view);
  assert.ok(region[0] < 0 && region[1] < 0);
  assert.ok(region[0] + region[2] > view.width && region[1] + region[3] > view.height);
  assert.ok(region[2] * region[3] * 4 <= 16_000_000);
  const grown = noiseRegion({ ...view, width: 1100 }, region);
  assert.ok(grown[0] <= region[0] && grown[2] >= region[2]);
  assert.equal(noiseRegion({ x: 0, y: 0, width: 10000, height: 10000 }), null);
  assert.ok(noiseRegion(view, [-10000, -10000, 20000, 20000]));
  assert.equal((filterFor(218 / 585).match(/feTurbulence/g) || []).length, 3);
});
