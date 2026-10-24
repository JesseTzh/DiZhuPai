import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasRenderer } from '../src/engine/canvas-renderer.js';
import { renderDprSetting, renderPixelRatio } from '../src/engine/render-pixel-ratio.js';
import {
  transferCoinPose,
  transferTiming,
  TRANSFER_DURATION,
  TRANSFER_COLLECT_AT,
} from '../src/game/transfer.js';
import { COIN_T } from '../src/coins/coin.js';

function globals(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() =>
      descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key],
    );
  }
}
function environment(t) {
  const events = new EventTarget();
  globals(t, {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  });
}

test('Canvas startup draws the latest state and disposes if the page leaves during initialization', async (t) => {
  environment(t);
  let resolve,
    disposed = 0;
  const ready = new Promise((done) => {
    resolve = done;
  });
  const draws = [],
    svg = { dataset: {} };
  const draw = createCanvasRenderer({}, svg, async () => ({ createRenderer: () => ready }));
  draw({ frame: 1 });
  draw({ frame: 2 });
  resolve({ draw: (state) => draws.push(state.frame), dispose: () => disposed++ });
  await draw.ready;
  assert.deepEqual(draws, [2]);
  assert.equal(svg.dataset.renderer, 'cpu');
  draw.dispose();
  draw({ frame: 3 });
  assert.deepEqual(draws, [2]);
  assert.equal(disposed, 1);

  let finish;
  const delayed = new Promise((done) => {
    finish = done;
  });
  const leaving = createCanvasRenderer({}, { dataset: {} }, async () => ({
    createRenderer: () => delayed,
  }));
  await Promise.resolve();
  leaving.dispose();
  finish({ draw: () => assert.fail('disposed renderer drew'), dispose: () => disposed++ });
  await leaving.ready;
  assert.equal(disposed, 2);
});

test('render scale defaults to 2×, restores 4× and supports a query override', (t) => {
  globals(t, {
    location: { search: '' },
    localStorage: { getItem: () => null },
    devicePixelRatio: 3,
  });
  assert.equal(renderDprSetting(), '2');
  assert.equal(renderPixelRatio(), 2);
  globalThis.localStorage = { getItem: () => '4' };
  assert.equal(renderPixelRatio(), 4);
  globalThis.location.search = '?dpr=3';
  assert.equal(renderPixelRatio(), 3);
  globalThis.location.search = '?dpr=auto';
  assert.equal(renderPixelRatio(), 2);
});

test('all coins settle on the table before collection, preserve their landing positions and finish before unlock', () => {
  for (const from of [0, 1])
    for (const amount of [1, 5, 20]) {
      const transfer = { from, amount },
        source = [-220, 35, 55],
        target = [-20, -220, 55];
      const landings = [];
      for (let i = 0; i < amount; i++) {
        const timing = transferTiming(amount, i);
        const pose = (elapsed) => transferCoinPose(transfer, i, elapsed, source, target);
        assert.equal(pose(0), null);
        assert.deepEqual(pose(timing.spill).c, source);
        assert.equal(pose(timing.spill + 0.2).phase, 'spill');
        const rest = pose(TRANSFER_COLLECT_AT - 0.05);
        assert.equal(rest.phase, 'rest');
        assert.ok(Math.abs(rest.c[2] - (COIN_T / 2 + 0.6)) < 1e-9);
        assert.equal(rest.tilt, 0);
        landings.push(rest.c.join(':'));
        const takeoff = pose(timing.collect);
        assert.equal(takeoff.phase, 'collect');
        for (let k = 0; k < 3; k++) assert.ok(Math.abs(rest.c[k] - takeoff.c[k]) < 1e-9);
        assert.ok(pose(timing.collect + 0.3).c[2] > rest.c[2] + 40);
        assert.equal(pose(TRANSFER_DURATION), null);
      }
      assert.equal(new Set(landings).size, amount, 'scatter to distinct positions');
    }
});
