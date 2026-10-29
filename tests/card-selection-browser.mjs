import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { newGame, setHand, setTarget, url } from './harness.mjs';
import { FULL_HD, openRecording } from './video.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const recording = await openRecording(browser, 'card-selection-browser', { viewport: FULL_HD });
const page = recording.page;
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const selected = () => page.evaluate(() => [...gameApp.state.game.selected].sort((a, b) => a - b));
const point = async (index) => {
  const box = await page.locator('.hand-card').nth(index).boundingBox();
  return { x: box.x + 5, y: box.y + box.height / 2 };
};
const move = (p) => page.mouse.move(p.x, p.y);
const sweep = async (from, to, back = false) => {
  await move(from);
  await page.mouse.down();
  await move(to);
  if (back) await move(from);
  await page.mouse.up();
};
const paintColor = () => page.evaluate(() => window.playColor);

try {
  await page.goto(url({ page: 'game' }));
  await page.evaluate(() => gameApp.ready());
  await newGame(page);
  await setHand(page, [2, 15, 3, 16, 4, 17, 5, 18]);
  await setTarget(page, null);
  // 同时检查 Canvas 显示颜色和真实按钮状态，捕获绘制顺序回归。
  await page.evaluate(() => {
    const ctx = document.querySelector('.game-actions-canvas').getContext('2d');
    const draw = ctx.fillText;
    ctx.fillText = function (text, ...args) {
      if (text === '出牌') window.playColor = this.fillStyle;
      return draw.call(this, text, ...args);
    };
    gameApp.render();
  });
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  assert.equal(await paintColor(), '#8b8377');

  const order = await page
    .locator('.hand-card')
    .evaluateAll((nodes) => nodes.map((n) => +n.dataset.card));
  const first = await point(1);
  const last = await point(5);
  const expected = order.slice(1, 6).sort((a, b) => a - b);
  // 单次 move 跨多张牌，并折返；每张牌只能处理一次。
  await sweep(first, last, true);
  assert.deepEqual(await selected(), expected);
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  assert.equal(await paintColor(), '#8b8377');
  await sweep(await point(5), await point(1));
  assert.deepEqual(await selected(), []);

  await sweep(await point(5), await point(1));
  assert.deepEqual(await selected(), expected, '从右向左也能快速选中中间所有牌');
  await page.keyboard.press('Escape');
  const start = await point(1);
  await move(start);
  await page.mouse.down();
  await move(await point(5));
  await page.mouse.move(3, 100);
  await page.mouse.up();
  assert.deepEqual(await selected(), expected, '空白处松手保留划选结果');
  await page.mouse.click(3, 100);
  assert.deepEqual(await selected(), []);

  let single = await point(1);
  await page.mouse.click(single.x, single.y);
  assert.deepEqual(await selected(), [order[1]]);
  assert.equal(await page.locator('#play-cards').isEnabled(), true);
  assert.equal(await paintColor(), '#231e16');
  single = await point(1);
  await page.mouse.click(single.x, single.y);
  assert.deepEqual(await selected(), []);
  assert.equal(await paintColor(), '#8b8377');

  // 取消手势后移动不能继续选牌；下一次按下可以正常选牌。
  await move(await point(1));
  await page.mouse.down();
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel')));
  await move(await point(5));
  await page.mouse.up();
  assert.deepEqual(await selected(), [order[1]]);
  await page.keyboard.press('Escape');

  await setTarget(page, { type: 'single', main: 15, length: 1, name: '单张' }, [1]);
  await page.evaluate((id) => gameApp.select(id), order[1]);
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  assert.equal(await paintColor(), '#8b8377');
  await page.evaluate(() => {
    gameApp.state.locked = true;
    gameApp.render();
  });
  await sweep(await point(2), await point(6));
  assert.deepEqual(await selected(), [order[1]], '锁定期间不能划选');
  // 相同牌面保留两个交互节点，鼠标与键盘可分别选取，划选后可一起出牌。
  await page.evaluate(() => {
    gameApp.state.locked = false;
  });
  await setHand(page, [2, 2, 15]);
  await setTarget(page, null);
  const twins = page.locator('.hand-card[data-card="2"]');
  assert.equal(await twins.count(), 2);
  assert.equal(
    await twins.evaluateAll((nodes) => new Set(nodes.map((n) => n.dataset.handIndex)).size),
    2,
  );
  await twins.nth(1).focus();
  await page.keyboard.press('Enter');
  assert.equal(await twins.nth(0).getAttribute('aria-pressed'), 'false');
  assert.equal(await twins.nth(1).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Space');
  assert.deepEqual(await selected(), [2, 2]);
  await page.keyboard.press('Escape');
  const twinPoints = await twins.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { x: box.x + 5, y: box.y + box.height / 2 };
    }),
  );
  await sweep(twinPoints[0], twinPoints[1], true);
  assert.deepEqual(await selected(), [2, 2]);
  assert.equal(await page.locator('#play-cards').isEnabled(), true);
  await page.locator('#play-cards').click();
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.hands[0]), [15]);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.target.cards), [2, 2]);
  assert.deepEqual(errors, []);
  console.log('双向快速划选、折返、取消、空白处松手及出牌按钮 Canvas 状态检查通过。');
} finally {
  await browser.close();
  await recording.save();
}
