import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { FULL_HD, openRecording, videoName } from './video.mjs';
import { setHand, setTarget, url } from './harness.mjs';
const root = fileURLToPath(new URL('../', import.meta.url)),
  out = path.join(root, 'test-results');
await mkdir(out, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' },
);
const recording = await openRecording(browser, videoName(), {
    viewport: FULL_HD,
  }),
  page = recording.page,
  errors = [],
  shots = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('requestfailed', (r) => errors.push(`${r.url()}: ${r.failure()?.errorText}`));
const shot = async (name) => {
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  shots.push(name);
};
const clean = async () => {
  assert.equal(await page.evaluate(() => document.documentElement.dataset.errors || ''), '');
  assert.equal(
    await page.evaluate(() => /NaN|Infinity/.test(document.querySelector('#art').innerHTML)),
    false,
  );
  assert.equal(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((n) => n.id);
      return ids.length - new Set(ids).size;
    }),
    0,
    'SVG IDs remain unique',
  );
};
// 悬停进度按帧推进，慢速 CI 渲染器上需要等值到位而不是固定延时。
const hoverDone = (id) =>
  page.waitForFunction(
    (card) =>
      [...document.querySelectorAll('.hand-card')].some(
        (node) => node.dataset.card === card && node.dataset.hover === '1.000',
      ),
    id,
  );
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
  const readyView = await page.locator('#fig').getAttribute('viewBox');
  const readyImage = await page.locator('#cpu-scene').evaluate((canvas) => canvas.toDataURL());
  // Legacy URL overrides no longer alter the camera, including on a fresh load.
  await page.goto(url({ page: 'game', yaw: 200, pitch: 25, free: 1 }));
  await page.evaluate(() => gameApp.ready());
  assert.equal(await page.locator('#fig').getAttribute('viewBox'), readyView);
  assert.equal(
    await page.locator('#cpu-scene').evaluate((canvas) => canvas.toDataURL()),
    readyImage,
  );
  await clean();
  await shot('game-ready');
  await page.locator('[data-slot="0"] [data-slot-action="new"]').click();
  await page.waitForFunction(() => gameApp.state.visual.dealTime > 0.65);
  await shot('game-dealing');
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  assert.equal(await page.title(), '地主牌');
  assert.equal(await page.locator('.game-topbar').isVisible(), true);
  assert.match(await page.locator('#level-label').textContent(), /第 1 \/ 3 大关，第 1 \/ 3 小关/);
  assert.equal(await page.locator('#current-coins').textContent(), '当前金币 500');
  assert.equal(await page.locator('#current-items').count(), 0);
  assert.equal(await page.locator('.game-topbar canvas').count(), 1);
  assert.equal(await page.locator('.game-topbar svg, .topbar-title').count(), 0);
  assert.equal(await page.locator('.level-progress, #level-detail').count(), 0);
  // The game topbar paints its gear on canvas, so only a labelled hit area remains.
  assert.equal(await page.locator('#open-settings.topbar-hit').count(), 1);
  assert.equal(await page.locator('#open-settings').getAttribute('aria-label'), '设置');
  assert.deepEqual(
    await page.evaluate(() => gameApp.state.game.hands.map((h) => h.length)),
    [18, 18],
  );
  assert.equal(await page.locator('.hand-card').count(), 18);
  assert.equal(await page.locator('.money-bag').count(), 2);
  await clean();
  await shot('game-hand');
  // Hover returns promptly and leaves the viewport without a focus frame.
  const hoverCard = page.locator('.hand-card').last();
  const hoverId = await hoverCard.getAttribute('data-card');
  const restingPath = await hoverCard.locator('path').getAttribute('d');
  await hoverCard.hover();
  await hoverDone(hoverId);
  assert.equal(await hoverCard.locator('path').getAttribute('d'), restingPath);
  await page.mouse.move(4, 4);
  await page.waitForTimeout(100);
  assert.equal(await hoverCard.locator('path').getAttribute('d'), restingPath);
  assert.equal(
    await page.locator('#fig').evaluate((node) => getComputedStyle(node).outlineStyle),
    'none',
  );
  // A stationary pointer at the lower edge used to alternate hover on/off every frame.
  const edgeBox = await hoverCard.boundingBox();
  await page.mouse.move(edgeBox.x + edgeBox.width / 2, edgeBox.y + edgeBox.height - 2);
  await hoverDone(hoverId);
  const edgePath = await hoverCard.locator('path').getAttribute('d');
  for (let sample = 0; sample < 6; sample++) {
    await page.waitForTimeout(80);
    assert.equal(await hoverCard.getAttribute('data-hover'), '1.000');
    assert.equal(await hoverCard.locator('path').getAttribute('d'), edgePath);
  }
  await page.mouse.move(0, 0);
  // Clicking a money bag only plays the decorative spill, never a coin transfer.
  const beforeSpill = await page.evaluate(() => structuredClone(gameApp.state.game));
  await page.locator('.money-bag[data-player="0"]').click();
  await page.waitForFunction(
    () =>
      gameApp.state.visual.spill &&
      gameApp.state.visual.time - gameApp.state.visual.spill.start > 0.4,
  );
  assert.equal(await page.evaluate(() => gameApp.state.visual.transfer), null);
  await page.screenshot({ path: path.join(out, 'bag-spill.png') });
  await page.waitForFunction(() => !gameApp.state.visual.spill);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game), beforeSpill);
  // Hint picks a legal move; playing it hands the turn to the real computer.
  await page.evaluate(() => gameApp.hint());
  assert.ok(await page.evaluate(() => gameApp.state.game.selected.length));
  await page.locator('#play-cards').click();
  await page.waitForFunction(
    () =>
      (gameApp.state.game.turn === 0 && !gameApp.state.locked) ||
      gameApp.state.game.phase === 'over',
  );
  await clean();
  await shot('game-trick');
  // Drag selection: forward, reverse, cancel, blank release and duplicate faces.
  await setHand(page, [2, 15, 3, 16, 4, 17, 5, 18]);
  await setTarget(page, null);
  // Both the Canvas paint colour and the real button state catch paint-order regressions.
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
  const expected = order.slice(1, 6).sort((a, b) => a - b);
  // 单次 move 跨多张牌，并折返；每张牌只能处理一次。
  await sweep(await point(1), await point(5), true);
  assert.deepEqual(await selected(), expected);
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  assert.equal(await paintColor(), '#8b8377');
  await sweep(await point(5), await point(1));
  assert.deepEqual(await selected(), []);
  await sweep(await point(5), await point(1));
  assert.deepEqual(await selected(), expected, '从右向左也能快速选中中间所有牌');
  await page.keyboard.press('Escape');
  await move(await point(1));
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
  // Force a known single response to test the physical transfer and turn reset deterministically.
  await page.evaluate(() => {
    const g = gameApp.state.game;
    g.phase = 'playing';
    g.turn = 0;
    g.target = {
      player: 1,
      cards: [53],
      move: { type: 'single', main: 17, length: 1, name: '单张' },
    };
    g.last = { ...g.target, type: 'play' };
    g.history = [g.last];
    g.selected = [];
    gameApp.state.locked = false;
    gameApp.render();
  });
  const coins = await page.evaluate(() => [...gameApp.state.game.coins]);
  assert.equal(await page.locator('#pass-turn').isEnabled(), true);
  await page.locator('#pass-turn').click();
  await page.waitForFunction(
    () =>
      gameApp.state.visual.transfer &&
      gameApp.state.visual.time - gameApp.state.visual.transfer.start > 0.35,
  );
  await shot('game-coin-transfer');
  await page.waitForFunction(() => !gameApp.state.locked);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.coins), [coins[0] - 20, Infinity]);
  assert.equal(await page.locator('#current-coins').textContent(), `当前金币 ${coins[0] - 20}`);
  await clean();
  // Settings: scale radio, keyboard navigation and persisted value.
  await page.locator('#open-settings').click();
  assert.equal(await page.locator('#settings-screen').evaluate((node) => node.open), true);
  assert.equal(
    await page
      .locator('#settings-screen [role="switch"], #settings-screen [role="radiogroup"]')
      .count(),
    3,
  );
  await page.locator('[data-scale="1"]').click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-scale="1.5"]').getAttribute('aria-checked'), 'true');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('[data-scale="1"]').getAttribute('aria-checked'), 'true');
  await page.locator('#close-settings').click();
  assert.equal(await page.locator('#settings-screen').evaluate((node) => node.open), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('render-scale')), '1');
  // Dragging and double-clicking cannot change the fixed projection. The scene
  // labels are transient move captions now, so only the viewBox is compared.
  const projection = () =>
    page.evaluate(() => document.getElementById('fig').getAttribute('viewBox'));
  const viewBefore = await projection();
  await page.mouse.move(630, 390);
  await page.mouse.down();
  await page.mouse.move(760, 430, { steps: 8 });
  await page.mouse.up();
  await page.mouse.dblclick(630, 390);
  await page.waitForTimeout(850);
  assert.equal(await projection(), viewBefore);
  assert.equal(await page.locator('#vreset, #vspin').count(), 0);
  assert.equal(await page.evaluate(() => 'setView' in gameApp || 'getView' in gameApp), false);
  await shot('game-fixed-view');
  assert.equal(await page.locator('.zchip, #hint, #clear-selection').count(), 0);
  assert.equal(errors.length, 0, errors.join('\n'));
  const report = { passed: true, screenshots: shots, errors };
  await writeFile(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await recording.save();
}
