import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { openRecording, videoName } from './video.mjs';
const browser = await chromium.launch({ channel: 'chrome' });
const recording = await openRecording(browser, videoName(), {
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = recording.page;
const base = process.env.TEST_URL || 'http://127.0.0.1:5173/';
// 固定随机种子：发牌与商店刷新完全可复现，测试结果不再随运行漂移。
const home = () => {
  const target = new URL(base);
  target.searchParams.set('seed', 'dizhupai-347');
  return target.href;
};
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const slot = (i, action) => page.locator(`[data-slot="${i}"] [data-slot-action="${action}"]`);
const goHome = async () => {
  await page.locator('#open-settings').click();
  await page.locator('#return-home').click();
};
try {
  await mkdir('test-results', { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(home());
  await page.evaluate(() => gameApp.ready());
  await page.evaluate(() => gameApp.homeAnimation.ready);
  const firstWave = await page.evaluate(() => gameApp.homeAnimation.snapshot());
  assert.ok(
    firstWave.every((coin) => coin.mode === 'falling'),
    'three coins drop together',
  );
  assert.equal(new Set(firstWave.map((coin) => coin.id)).size, 3);
  assert.ok(
    Math.max(...firstWave.map((coin) => coin.y)) - Math.min(...firstWave.map((coin) => coin.y)) < 1,
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(await page.locator('#home-screen button').count(), 4);
  await page.locator('#home-import').click();
  assert.equal(await page.locator('.save-slot').count(), 1);
  await page.locator('#close-saves').click();
  assert.equal(await page.locator('#home-screen h1').textContent(), '地主牌');
  assert.match(await page.locator('.home-rocket').getAttribute('href'), /performance.html/);
  await page.screenshot({ path: 'test-results/new-home-desktop.png' });
  await page.waitForFunction(() =>
    gameApp.homeAnimation.snapshot().some((coin) => coin.mode === 'flying'),
  );
  const flight = await page.evaluate(() =>
    gameApp.homeAnimation.snapshot().find((coin) => coin.mode === 'flying'),
  );
  assert.ok(flight.vx > 0 && flight.vy < 0, 'the strike sends the coin up and toward the sack');
  const arrivalX = flight.fromX + flight.vx * flight.duration;
  const arrivalY = flight.fromY + flight.vy * flight.duration + 310 * flight.duration ** 2;
  assert.ok(arrivalX > 690 && arrivalX < 710, 'the arc ends inside the sack mouth');
  assert.ok(arrivalY > 265 && arrivalY < 295, 'the arc ends at the side-view rim height');
  assert.ok(flight.vy + 620 * flight.duration > 0, 'the coin descends into the sack');
  await page.waitForFunction(
    () => gameApp.homeAnimation.metrics.strikesByCard.every((count) => count >= 2),
    null,
    { timeout: 30000 },
  );
  assert.ok(await page.evaluate(() => gameApp.homeAnimation.metrics.contacts > 0));
  await page.waitForFunction(() => gameApp.homeAnimation.metrics.deposits >= 6);
  assert.equal(await page.locator('#home-cards image').count(), 3);
  assert.match(await page.locator('#home-bag image').getAttribute('href'), /^data:image\/png/);
  console.log('Physics', await page.evaluate(() => gameApp.homeAnimation.metrics));
  await page.screenshot({ path: 'test-results/new-home-animation.png' });
  await page.locator('#home-settings').click();
  assert.equal(await page.locator('#settings-screen [id*="save"]').count(), 0);
  assert.equal(
    await page
      .locator('#settings-screen [role="switch"], #settings-screen [role="radiogroup"]')
      .count(),
    2,
  );
  await page.locator('#close-settings').click();
  await page.locator('#home-catalogue').click();
  assert.ok(await page.locator('#item-catalogue').evaluate((el) => el.open));
  assert.equal(await page.locator('#item-catalogue .catalogue-card').count(), 7);
  assert.equal(await page.locator('#item-catalogue .catalogue-card svg').count(), 7);
  assert.equal(await page.locator('#item-catalogue .catalogue-owned').count(), 0);
  await page.screenshot({ path: 'test-results/item-catalogue.png' });
  await page.locator('#close-catalogue').click();
  assert.ok(await page.locator('#item-catalogue').evaluate((el) => !el.open));
  await page.evaluate(() => gameApp.state.game.items.push('frog'));
  await page.locator('#home-catalogue').click();
  assert.equal(await page.locator('#item-catalogue .catalogue-owned').count(), 1);
  await page.evaluate(() => gameApp.state.game.items.pop());
  await page.locator('#close-catalogue').click();
  assert.ok(await page.locator('#item-catalogue').evaluate((el) => !el.open));
  await page.locator('#enter-game').click();
  assert.ok(await page.locator('#saves-screen').isHidden(), 'start skips save selection');
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  await page.evaluate(() => gameApp.select(gameApp.state.game.hands[0][0]));
  const original = await page.evaluate(() => structuredClone(gameApp.state.game));
  await goHome();
  await page.locator('#enter-game').click();
  assert.deepEqual(await page.evaluate(() => gameApp.state.game), original);
  await goHome();
  await page.locator('#home-import').click();
  assert.equal(await page.locator('.save-slot').count(), 1);
  await page.screenshot({ path: 'test-results/single-save-desktop.png' });
  const downloadEvent = page.waitForEvent('download');
  await slot(0, 'export').click();
  const download = await downloadEvent;
  const { readFile } = await import('node:fs/promises');
  const backup = await readFile(await download.path(), 'utf8');
  await slot(0, 'import').click();
  await page.locator('#save-file').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{invalid'),
  });
  await page.waitForFunction(() =>
    document.getElementById('save-status').textContent.includes('导入失败'),
  );
  assert.equal(await slot(0, 'resume').count(), 1);
  await page.locator('#save-file').setInputFiles({
    name: 'save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await page.locator('#cancel-import').click();
  assert.ok(await page.locator('#saves-screen').isVisible());
  assert.deepEqual(await page.evaluate(() => gameApp.state.game), original);
  await slot(0, 'import').click();
  await page.locator('#save-file').setInputFiles({
    name: 'save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await page.locator('#confirm-import').click();
  await page.waitForFunction(() => !document.body.classList.contains('saves-page'));
  assert.deepEqual(await page.evaluate(() => gameApp.state.game), original);
  await goHome();
  await page.locator('#home-import').click();
  await slot(0, 'delete').click();
  assert.equal(await slot(0, 'resume').count(), 1);
  await slot(0, 'delete').click();
  assert.equal(await slot(0, 'new').count(), 1);
  await slot(0, 'import').click();
  await page.locator('#save-file').setInputFiles({
    name: 'save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await page.waitForFunction(() => !document.body.classList.contains('saves-page'));
  await page.reload();
  await page.evaluate(() => gameApp.ready());
  assert.deepEqual(await page.evaluate(() => gameApp.state.game), original);
  await goHome();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const frames = await page.evaluate(() => gameApp.homeAnimation.metrics.frames);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => gameApp.homeAnimation.metrics.frames), frames);
  assert.deepEqual(errors, []);
  console.log(
    'Home, physics contacts/strikes, single save, direct start/resume, export/import, invalid input, delete confirmation, reload, settings separation, item catalogue passed.',
  );
} finally {
  await browser.close();
  await recording.save();
}
