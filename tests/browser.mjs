import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { FULL_HD, openRecording, videoName } from './video.mjs';
const root = fileURLToPath(new URL('../', import.meta.url)),
  out = path.join(root, 'test-results');
await mkdir(out, { recursive: true });
const base = process.env.TEST_URL || 'http://127.0.0.1:5173/';
// 固定随机种子：发牌与商店刷新完全可复现，测试结果不再随运行漂移。
const url = (params = {}) => {
  const target = new URL(base);
  target.searchParams.set('seed', 'dizhupai-347');
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, String(value));
  return target.href;
};
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
  assert.equal(await page.locator('#current-coins').textContent(), '当前金币 100');
  assert.equal(await page.locator('#current-items').count(), 0);
  assert.equal(await page.locator('.game-topbar canvas').count(), 1);
  assert.equal(await page.locator('.game-topbar svg, .topbar-title').count(), 0);
  assert.equal(await page.locator('.level-progress, #level-detail').count(), 0);
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
  // 悬停进度按帧推进，慢速 CI 渲染器上需要等值到位而不是固定延时。
  await page.waitForFunction(
    (card) =>
      [...document.querySelectorAll('.hand-card')].some(
        (node) => node.dataset.card === card && node.dataset.hover === '1.000',
      ),
    hoverId,
  );
  assert.equal(await hoverCard.locator('path').getAttribute('d'), restingPath);
  await page.mouse.move(4, 4);
  await page.waitForTimeout(100);
  assert.equal(await hoverCard.locator('path').getAttribute('d'), restingPath);
  assert.equal(
    await page.locator('#fig').evaluate((node) => getComputedStyle(node).outlineStyle),
    'none',
  );
  // Actual selection and buttons, including cancelling a selected card.
  await page.locator('.hand-card').first().dispatchEvent('pointerdown', { button: 0 });
  assert.equal(await page.evaluate(() => gameApp.state.game.selected.length), 1);
  await page.mouse.click(4, 100);
  assert.equal(await page.evaluate(() => gameApp.state.game.selected.length), 0);
  await page.evaluate(() => gameApp.hint());
  const selection = await page.evaluate(() => gameApp.state.game.selected.length);
  assert.ok(selection > 0);
  await page.locator('#play-cards').click();
  await page.waitForFunction(
    () =>
      (gameApp.state.game.turn === 0 && !gameApp.state.locked) ||
      gameApp.state.game.phase === 'over',
  );
  await clean();
  await shot('game-trick');
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
    g.selected = [];
    gameApp.render();
  });
  const coins = await page.evaluate(() => [...gameApp.state.game.coins]);
  await page.locator('#pass-turn').click();
  await page.waitForFunction(
    () =>
      gameApp.state.visual.transfer &&
      gameApp.state.visual.time - gameApp.state.visual.transfer.start > 0.35,
  );
  await shot('game-coin-transfer');
  await page.waitForFunction(() => !gameApp.state.locked);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.coins), [
    coins[0] - 5,
    coins[1] + 5,
  ]);
  assert.equal(await page.locator('#current-coins').textContent(), `当前金币 ${coins[0] - 5}`);
  await clean();
  await page.locator('#open-settings').click();
  assert.equal(await page.locator('#settings-screen').evaluate((node) => node.open), true);
  assert.equal(
    await page
      .locator('#settings-screen [role="switch"], #settings-screen [role="radiogroup"]')
      .count(),
    2,
  );
  await page.locator('[data-scale="1"]').click();
  await page.locator('#close-settings').click();
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
  // Play an entire game through public UI actions; the real computer makes every opposing decision.
  for (let i = 0; i < 80; i++) {
    await page.waitForFunction(
      () =>
        ['over', 'shop'].includes(gameApp.state.game.phase) ||
        (!gameApp.state.locked && gameApp.state.game.turn === 0),
    );
    if (await page.evaluate(() => ['over', 'shop'].includes(gameApp.state.game.phase))) break;
    await page.evaluate(() => gameApp.hint());
    if (await page.locator('#play-cards').isEnabled()) await page.locator('#play-cards').click();
    else await page.locator('#pass-turn').click();
  }
  await page.waitForFunction(() => gameApp.state.game.phase === 'shop');
  await shot('game-result');
  await clean();
  const balances = await page.evaluate(() => [...gameApp.state.game.coins]);
  await page.locator('#leave-shop').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.coins), balances);
  assert.equal(await page.evaluate(() => gameApp.state.game.round), 2);
  assert.equal(errors.length, 0, errors.join('\n'));
  const report = { passed: true, screenshots: shots, errors };
  await writeFile(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await recording.save();
}
