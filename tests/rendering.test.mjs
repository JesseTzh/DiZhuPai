import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasRenderer } from '../src/engine/canvas-renderer.js';
import { renderDprSetting, renderPixelRatio } from '../src/engine/render-pixel-ratio.js';
import { setCameraPitch, rotV, visDot, lightDots } from '../src/engine/camera.js';
import { setLight, L, LIN, facing, tone, toneI, mix } from '../src/engine/shading.js';
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

test('render scale re-reads storage only when it changes between frames', (t) => {
  let reads = 0;
  globals(t, {
    location: { search: '' },
    localStorage: { getItem: () => (reads++, '4') },
    devicePixelRatio: 3,
  });
  assert.equal(renderPixelRatio(), 4);
  for (let i = 0; i < 5; i++) renderPixelRatio();
  assert.equal(reads, 1);
  globalThis.localStorage = { getItem: () => (reads++, '2') };
  assert.equal(renderPixelRatio(), 2);
  assert.equal(reads, 2);
});

test('folded visibility and light dots match the rotated reference at every pitch', () => {
  const normals = [];
  const count = 256,
    golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const z = 1 - (2 * (i + 0.5)) / count,
      r = Math.sqrt(1 - z * z),
      a = i * golden;
    normals.push([r * Math.cos(a), r * Math.sin(a), z]);
  }
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  // reference step3 from shading.js, recomputed from the raw rotV vector
  const SOFT = 0.18,
    ss = (a, b, x) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
  const step3 = (d, hi, lo, m) => {
    const a = ss(hi - SOFT, hi + SOFT, d),
      b = ss(lo - SOFT, lo + SOFT, d);
    return a >= 1 ? m.l : b <= 0 ? m.d : a > 0 ? mix(m.m, m.l, a) : b < 1 ? mix(m.d, m.m, b) : m.m;
  };
  const m = { l: '#ffffff', m: '#808080', d: '#000000' };
  for (const deg of [40, 55, 68, 80, 90]) {
    setCameraPitch(deg, deg < 90 ? 1800 : 0);
    for (const az of [35, 105, 160]) {
      setLight(az);
      for (const n of normals) {
        const r = rotV(n),
          sum = r[0] + r[1] + r[2],
          dotL = r[0] * L[0] + r[1] * L[1] + r[2] * L[2],
          dotLin = r[0] * LIN[0] + r[1] * LIN[1] + r[2] * LIN[2];
        assert.ok(near(visDot(n), sum));
        assert.ok(
          near(lightDots[0][0] * n[0] + lightDots[0][1] * n[1] + lightDots[0][2] * n[2], dotL),
        );
        assert.ok(
          near(lightDots[1][0] * n[0] + lightDots[1][1] * n[1] + lightDots[1][2] * n[2], dotLin),
        );
        assert.equal(facing(n), sum > 1e-6);
        assert.equal(tone(n, m), step3(dotL, -0.15, -0.45, m));
        assert.equal(toneI(n, m), step3(dotLin, 0.6, 0.05, m));
      }
    }
  }
  setCameraPitch(90, 0);
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
