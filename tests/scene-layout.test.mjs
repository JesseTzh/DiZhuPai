import test from 'node:test';
import assert from 'node:assert/strict';
import { DESKTOP_LAYOUT, MOBILE_LAYOUT, layoutFor } from '../src/game/scene-layout.js';
import { handPose, fitScene } from '../src/game/scene-frame.js';
import { setCameraPitch } from '../src/engine/camera.js';
import { tableItemModel } from '../src/game/table-items.js';
import { ITEMS } from '../src/game/items.js';

// The two modes are separate constants: desktop numbers are a contract (the desktop
// scene must not drift when phone values are tuned), and phone values only apply
// where layoutFor(true) is passed.
test('desktop geometry is unchanged and only the phone mode departs from it', () => {
  assert.deepEqual(DESKTOP_LAYOUT.rowV, [180, -165]);
  assert.equal(DESKTOP_LAYOUT.handSpacing, 24);
  assert.equal(DESKTOP_LAYOUT.handScale, 0.86);
  assert.equal(DESKTOP_LAYOUT.selectedLift, 22);
  assert.equal(DESKTOP_LAYOUT.bagU, -315);
  assert.equal(DESKTOP_LAYOUT.deckU, 315);
  assert.equal(DESKTOP_LAYOUT.itemLayout, null);
  assert.equal(DESKTOP_LAYOUT.bounds, null);
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

test('the phone toy column stays inside the tabletop between the two sacks', () => {
  const { u, v, step, scale } = MOBILE_LAYOUT.itemLayout;
  for (const [index, item] of ITEMS.entries()) {
    const model = tableItemModel(item.id, { u, v: v + index * step, scale });
    for (const [x, y] of model.points) {
      const itemU = (x - y) / Math.SQRT2,
        itemV = (x + y) / Math.SQRT2;
      assert.ok(Math.abs(itemU) < 372, `${item.id} 在桌面内`);
      // Clear of both money sacks (they sit at the row positions near ±140).
      assert.ok(itemV > -110 && itemV < 110, `${item.id} 不压钱袋`);
    }
  }
});
