import test from 'node:test';
import assert from 'node:assert/strict';
import { DESKTOP_LAYOUT, MOBILE_LAYOUT, GAME_CAMERA, layoutFor } from '../src/game/scene-layout.js';
import {
  handPose,
  fitScene,
  tableSize,
  sceneFrame,
  bagPosition,
  deckPosition,
} from '../src/game/scene-frame.js';
import { P, setCameraPitch } from '../src/engine/camera.js';
import { tableGeometry } from '../src/game/table-geometry.js';
import { world } from '../src/game/table.js';
import { tableItemModel, tableItemPlacement } from '../src/game/table-items.js';
import { ITEMS } from '../src/game/items.js';
import { createRowClearance, rowClearance } from '../src/game/row-clearance.js';
import { createGame } from '../src/game/state.js';
import { makeVisual } from '../src/game/scene.js';

// Each mode keeps its own card geometry and centered framing contract.
test('each mode retains its card layout and uses a shallow perspective frame', () => {
  assert.deepEqual(DESKTOP_LAYOUT.rowV, [150, -174]);
  assert.equal(DESKTOP_LAYOUT.handSpacing, 27);
  assert.equal(DESKTOP_LAYOUT.handScale, 1.03);
  assert.equal(DESKTOP_LAYOUT.selectedLift, 22);
  assert.equal(DESKTOP_LAYOUT.bagU, -350);
  assert.equal(DESKTOP_LAYOUT.deckU, 350);
  assert.deepEqual(DESKTOP_LAYOUT.itemLayout, { insetU: 42, insetV: 16, step: 34, scale: 0.28 });
  for (const { bounds } of [DESKTOP_LAYOUT, MOBILE_LAYOUT]) {
    assert.equal(bounds.u0, -bounds.u1);
    assert.equal(bounds.v0, -bounds.v1);
  }
  assert.deepEqual(GAME_CAMERA, { pitch: 72, distance: 2400 });
  assert.equal(layoutFor(false), DESKTOP_LAYOUT);
  assert.equal(layoutFor(true), MOBILE_LAYOUT);
  assert.notEqual(MOBILE_LAYOUT, DESKTOP_LAYOUT);
  // Rows closer together (the frame is what sets the card size), cards larger.
  assert.ok(
    MOBILE_LAYOUT.rowV[0] - MOBILE_LAYOUT.rowV[1] < DESKTOP_LAYOUT.rowV[0] - DESKTOP_LAYOUT.rowV[1],
  );
  assert.ok(MOBILE_LAYOUT.handScale > DESKTOP_LAYOUT.handScale);
  assert.ok(MOBILE_LAYOUT.handSpacing > DESKTOP_LAYOUT.handSpacing);
});

test('handPose uses its layout and caps long hands to the readable span', () => {
  setCameraPitch(90, 0);
  const desktop = handPose(0, 9, 18),
    mobile = handPose(0, 9, 18, MOBILE_LAYOUT);
  assert.equal(desktop.v, DESKTOP_LAYOUT.rowV[0]);
  assert.equal(desktop.scale, DESKTOP_LAYOUT.handScale);
  assert.equal(mobile.v, MOBILE_LAYOUT.rowV[0]);
  assert.equal(mobile.scale, MOBILE_LAYOUT.handScale);
  assert.ok(Math.abs(mobile.u - desktop.u) > 0, 'phone spreads the hand wider');
  for (const count of [18, 20]) {
    const span = MOBILE_LAYOUT.handSpan;
    assert.ok(Math.abs(handPose(0, count - 1, count, MOBILE_LAYOUT).u) <= span / 2 + 1e-9);
  }
});

test('the phone frame fits tighter than the desktop frame on a 19.5:9 viewport', () => {
  const svg = {
    attributes: {},
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  const viewport = { width: 858, height: 396 };
  setCameraPitch(90, 0);
  fitScene(svg, viewport, {});
  const desktop = svg.attributes.viewBox;
  fitScene(svg, viewport, { bounds: MOBILE_LAYOUT.bounds, padX: 0, padY: 0, tall: 0 });
  const phone = svg.attributes.viewBox;
  const width = (view) => Number(view.split(' ')[2]);
  assert.ok(width(phone) < width(desktop) * 0.8, '手机取景更紧,牌面更大');
});

test('all table finishes retain a visible border in wide and tall viewports', () => {
  const svg = { getAttribute() {}, setAttribute() {} };
  setCameraPitch(GAME_CAMERA.pitch, GAME_CAMERA.distance);
  for (const layout of [DESKTOP_LAYOUT, MOBILE_LAYOUT]) {
    for (const viewport of [
      { width: 1916, height: 978 },
      { width: 748, height: 388 },
      { width: 460, height: 312 },
      { width: 792, height: 600 },
    ]) {
      const view = fitScene(svg, viewport, { bounds: layout.bounds, padX: 0, padY: 0, tall: 0 });
      const size = tableSize(view, viewport),
        scale = viewport.width / view.width;
      for (const style of ['planks', 'walnut', 'marble']) {
        const table = tableGeometry(style, size),
          points = table.B.map((p) => P(...p)),
          xs = points.map(([x]) => x * scale),
          ys = points.map(([, y]) => y * scale);
        for (const gap of [
          Math.min(...xs),
          viewport.width - Math.max(...xs),
          Math.min(...ys),
          viewport.height - Math.max(...ys),
        ]) {
          assert.ok(gap >= 6.99, `透视桌面边框完整显示，留白为 ${gap}px`);
        }
        assert.equal(tableGeometry(style, size), table, '相同尺寸复用桌面模型');
      }
      const left = P(...world(-100, -100)),
        right = P(...world(100, -100)),
        bottom = P(...world(-100, 100));
      assert.ok(right[0] > left[0] && bottom[1] > left[1]);
      const farWidth = P(...world(100, -100))[0] - P(...world(-100, -100))[0];
      const nearWidth = P(...world(100, 100))[0] - P(...world(-100, 100))[0];
      assert.ok(nearWidth > farWidth, '近端桌沿按透视放大');
    }
  }
  assert.notEqual(tableGeometry('planks'), tableGeometry('planks', { u: 600, v: 300 }));
});

test('道具沿两端布局的玩家左下桌沿排列，留出手牌空间', () => {
  for (const layout of [DESKTOP_LAYOUT, MOBILE_LAYOUT]) {
    for (const size of [
      { u: layout.bounds.u1, v: layout.bounds.v1 },
      { u: 400, v: 420 },
    ]) {
      const placements = ITEMS.map((item, index) => tableItemPlacement(layout, index, size));
      for (const [index, item] of ITEMS.entries()) {
        const model = tableItemModel(item.id, placements[index]);
        for (const [x, y] of model.points) {
          const itemU = (x - y) / Math.SQRT2,
            itemV = (x + y) / Math.SQRT2;
          assert.ok(itemU > -size.u && itemU < 0, `${item.id} 在左下桌沿内`);
          assert.ok(itemV > layout.rowV[0] + 44 * layout.handScale, `${item.id} 位于手牌下方`);
          assert.ok(itemV < size.v, `${item.id} 不越过桌沿`);
        }
        if (index) assert.ok(placements[index].u > placements[index - 1].u);
      }
    }
  }
});

test('长手牌触发独立的平滑避让，支持中途反向与回位', () => {
  for (const layout of [DESKTOP_LAYOUT, MOBILE_LAYOUT]) {
    const motion = createRowClearance();
    const shift = layout.clearanceShift;
    assert.equal(rowClearance(18, layout), 0);
    assert.equal(rowClearance(32, layout), shift);
    assert.deepEqual(motion.sample([18, 18], layout, 0), { values: [0, 0], moving: false });
    assert.deepEqual(motion.sample([32, 18], layout, 10).values, [0, 0]);
    const middle = motion.sample([32, 18], layout, 170);
    assert.equal(middle.values[0], shift / 2);
    assert.equal(middle.values[1], 0);
    assert.ok(middle.moving);
    assert.deepEqual(motion.sample([18, 32], layout, 170).values, middle.values);
    const reversed = motion.sample([18, 32], layout, 330);
    assert.equal(reversed.values[0], shift / 4);
    assert.equal(reversed.values[1], shift / 2);
    assert.deepEqual(motion.sample([18, 32], layout, 490), { values: [0, shift], moving: false });
    assert.ok(Math.abs(handPose(0, 53, 54, layout).u) <= layout.handSpan / 2);
  }
});

test('钱袋、牌堆与金币标签共用避让位移，手牌位置不变', () => {
  const game = createGame();
  game.hands = [[0], [1]];
  const visual = makeVisual(game);
  visual.transfer = { from: 0, amount: 1, start: 0 };
  const state = { game, visual, pal: 'cobalt', cardNames: [] };
  for (const layout of [DESKTOP_LAYOUT, MOBILE_LAYOUT]) {
    const resting = sceneFrame(state, layout);
    const moved = sceneFrame(state, layout, [120, 120]);
    for (const p of [0, 1]) {
      assert.deepEqual(moved.bags[p].pos, bagPosition(p, layout, 120));
      const deck = moved.cards.find((card) => card.options.deckCount && card.options.player === p);
      assert.equal(deck.pose.v, deckPosition(p, layout, 120).v);
      assert.equal(moved.labels[p].v, deck.pose.v);
    }
    assert.deepEqual(
      moved.cards.filter((card) => !card.options.deckCount),
      resting.cards.filter((card) => !card.options.deckCount),
    );
  }
});
