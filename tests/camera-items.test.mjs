import test from 'node:test';
import assert from 'node:assert/strict';
import { P, setOrigin, setCenter, setCameraPitch, depthOf } from '../src/engine/camera.js';
import { world } from '../src/game/table.js';
import { tableItemModel } from '../src/game/table-items.js';
import { transferCoinPose, TRANSFER_COLLECT_AT } from '../src/game/transfer.js';

test('pitch changes elevation and perspective while retaining a fixed horizontal heading', () => {
  setOrigin(0, 0);
  setCenter([0, 0], 0);
  try {
    for (const pitch of [40, 68, 90]) {
      setCameraPitch(pitch, 1800);
      const left = P(...world(-100, 0)),
        right = P(...world(100, 0));
      assert.ok(Math.abs(left[1] - right[1]) < 1e-9);
      assert.ok(Math.abs(left[0] + right[0]) < 1e-9);
      assert.ok(right[0] > left[0]);
      const nearWidth = P(...world(100, 180))[0] - P(...world(-100, 180))[0];
      const farWidth = P(...world(100, -180))[0] - P(...world(-100, -180))[0];
      if (pitch < 90) {
        assert.ok(nearWidth > farWidth, 'near side expands with perspective');
        assert.ok(P(...world(0, 0, 60))[1] < P(...world(0, 0))[1]);
        assert.ok(depthOf(world(0, 100)) > depthOf(world(0, -100)));
      }
      assert.ok([...left, ...right].every(Number.isFinite));
    }
    assert.equal(setCameraPitch(-100), 40);
    assert.equal(setCameraPitch(200), 90);
  } finally {
    setCameraPitch(90);
  }
});

test('purchased toys are solid meshes resting within the money bag corner on desktop', () => {
  for (const id of ['frog', 'hand', 'dragon']) {
    const model = tableItemModel(id);
    assert.ok(model.parts.length > 10);
    assert.ok(model.points.every((p) => p[2] >= 0.9));
    assert.ok(model.box[1][2] > 30);
    for (const [x, y] of model.points) {
      const u = (x - y) / Math.SQRT2,
        v = (x + y) / Math.SQRT2;
      assert.ok(Math.abs(u) < 365);
      assert.ok(v > 228 && v < 255);
    }
    for (const part of model.parts)
      for (const face of part.faces) {
        assert.ok(face.normal.every(Number.isFinite));
        assert.ok(Math.hypot(...face.normal) <= 1.000001);
      }
  }
});

test('each spill seed produces bounded random landings that stay fixed until collection', () => {
  for (const from of [0, 1]) {
    const landings = [];
    for (const scatterSeed of [123, 456]) {
      const transfer = { from, amount: 20, scatterSeed },
        positions = [];
      for (let i = 0; i < transfer.amount; i++) {
        const pose = (time) => transferCoinPose(transfer, i, time, [0, 0, 55], [0, 0, 55]);
        const a = pose(TRANSFER_COLLECT_AT - 0.06),
          b = pose(TRANSFER_COLLECT_AT - 0.01);
        assert.deepEqual(a.c, b.c);
        const [x, y] = a.c,
          u = (x - y) / Math.SQRT2,
          v = (x + y) / Math.SQRT2;
        assert.ok(Math.abs(u + 315) <= 23);
        const forward = (v - (from === 0 ? 180 : -165)) * (from === 0 ? -1 : 1);
        assert.ok(forward >= 90 && forward <= 190);
        positions.push(a.c);
      }
      landings.push(positions);
    }
    assert.notDeepEqual(landings[0], landings[1]);
  }
});
