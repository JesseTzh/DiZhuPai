import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { FULL_HD, openRecording } from './video.mjs';
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
// 固定随机种子：发牌与商店刷新完全可复现，测试结果不再随运行漂移。
const url = (params = {}) => {
  const target = new URL(process.env.TEST_URL || 'http://127.0.0.1:5173/');
  target.searchParams.set('seed', 'dizhupai-347');
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, String(value));
  return target.href;
};
try {
  for (const viewport of [
    FULL_HD,
    // 手机段保持竖屏原尺寸录制(录制器不会放大画面,画布与视口一致即满幅)。
    { width: 390, height: 844 },
  ]) {
    const recording = await openRecording(
      browser,
      `entry-browser-${viewport.width}x${viewport.height}`,
      { viewport },
    );
    const page = recording.page;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url());
    await page.evaluate(() => gameApp.ready());
    assert.equal(await page.locator('#enter-game').textContent(), '开始游戏');
    assert.equal(await page.locator('svg.home-table').count(), 0);
    const canvas = await page.locator('#cpu-scene').elementHandle();
    assert.equal(
      await page.locator('.stage').evaluate((node) => getComputedStyle(node).display),
      'block',
    );
    assert.equal(await page.locator('#cpu-scene').isVisible(), true);
    assert.equal(await page.locator('.card-deck').count(), 0);
    await page.locator('#enter-game').click();
    await page.waitForFunction(() => gameApp.state.visual.entry?.time > 0.2);
    const tilt = await page.evaluate(() => ({ ...gameApp.state.visual.entry }));
    assert.ok(tilt.pitch < 90 && tilt.pitch > 68);
    assert.equal(await page.evaluate(() => gameApp.state.game.round), 0);
    assert.equal(await page.locator('.money-bag').count(), 0);
    await page.waitForFunction(() => gameApp.state.visual.entry?.time > 1.0);
    assert.equal(await page.locator('.money-bag').count(), 2);
    assert.equal(await page.evaluate(() => gameApp.state.visual.entry.pitch), 68);
    await page.screenshot({ path: `/tmp/entry-${viewport.width}-landing.png` });
    await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
    assert.equal(await page.evaluate(() => gameApp.state.game.round), 1);
    assert.equal(await page.evaluate(() => gameApp.state.visual.entry), null);
    assert.equal(
      await canvas.evaluate((node) => node === document.getElementById('cpu-scene')),
      true,
    );
    assert.equal(await page.locator('.card-deck').count(), 2);
    assert.deepEqual(
      await page
        .locator('.card-deck')
        .evaluateAll((nodes) => nodes.map((node) => +node.dataset.count)),
      [36, 36],
    );
    assert.equal(await page.locator('#home-screen').isHidden(), true);
    assert.equal(await page.evaluate(() => document.querySelector('.zwrap').style.transform), '');
    await page.screenshot({ path: `/tmp/entry-${viewport.width}-done.png` });
    // Returning to home and continuing must preserve the saved game.
    const original = await page.evaluate(() => JSON.stringify(gameApp.state.game));
    assert.equal(await page.locator('#camera-pitch, .camera-controls').count(), 0);
    assert.equal(
      await page.evaluate(async () => (await import('/engine/camera.js')).cameraView().pitch),
      68,
    );
    await page.locator('#open-settings').click();
    await page.screenshot({ path: `/tmp/settings-${viewport.width}.png` });
    await page.locator('#return-home').click();
    assert.equal(await page.locator('#settings-screen').isVisible(), false);
    assert.equal(await page.locator('#home-screen').isVisible(), true);
    await page.reload();
    await page.evaluate(() => gameApp.ready());
    assert.equal(await page.locator('#enter-game').textContent(), '继续游戏');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#enter-game').click();
    await page.waitForFunction(() => !document.body.classList.contains('home-page'));
    assert.equal(await page.evaluate(() => JSON.stringify(gameApp.state.game)), original);
    await page.close();
    await recording.save();
  }
  assert.deepEqual(errors, []);
  console.log(
    'Entry sequence, 68° pitch, delayed props, first deal, resume and reduced motion passed on desktop and mobile.',
  );
} finally {
  await browser.close();
}
