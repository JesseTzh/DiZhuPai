import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { FULL_HD, openRecording } from './video.mjs';
import { url } from './harness.mjs';
const base = process.env.TEST_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ channel: 'chrome' });
const recording = await openRecording(browser, 'ui-pages', {
  viewport: FULL_HD,
});
const page = recording.page;
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await mkdir('test-results', { recursive: true });
const fit = async () =>
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
    'No page scrolling',
  );
try {
  await page.goto(url());
  await page.evaluate(() => gameApp.ready());
  assert.ok(await page.locator('#home-screen').isVisible());
  await page.screenshot({ path: 'test-results/home-desktop.png' });
  await fit();
  await page.locator('#home-settings').click();
  await page.waitForFunction(() => !gameApp.audio.music.paused);
  assert.ok(await page.locator('#settings-screen').isVisible());
  const version = page.locator('#settings-screen canvas.settings-version');
  assert.ok(await version.isVisible());
  assert.match(
    await version.getAttribute('aria-label'),
    /^Version:(dev-test|\d{6}-\d{4}-[a-f0-9]{7}-(prod|test))$/,
  );
  assert.ok(
    await version.evaluate((canvas) =>
      [...canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data].some(
        (value, index) => index % 4 === 3 && value > 0,
      ),
    ),
  );
  assert.equal(await page.locator('[data-scale="1"]').getAttribute('aria-checked'), 'true');
  await page.locator('[data-scale="2"]').click();
  await page.locator('#sound-enabled').click();
  assert.equal(await page.evaluate(() => gameApp.audio.muted), true);
  await page.locator('#music-enabled').click();
  assert.equal(await page.evaluate(() => gameApp.audio.musicMuted), true);
  await page.screenshot({ path: 'test-results/settings-desktop.png' });
  await page.reload();
  await page.evaluate(() => gameApp.ready());
  assert.equal(await page.locator('[data-scale="2"]').getAttribute('aria-checked'), 'true');
  assert.equal(await page.evaluate(() => gameApp.audio.muted), true);
  assert.equal(await page.evaluate(() => gameApp.audio.musicMuted), true);
  assert.equal(await page.evaluate(() => gameApp.audio.music.paused), true);
  await page.locator('#home-settings').click();
  await page.locator('[data-scale="1"]').click();
  await page.locator('#sound-enabled').click();
  assert.equal(await page.evaluate(() => gameApp.audio.muted), false);
  await page.locator('#music-enabled').click();
  assert.equal(await page.evaluate(() => gameApp.audio.musicMuted), false);
  await page.waitForFunction(() => !gameApp.audio.music.paused);
  await page.locator('#close-settings').click();
  await page.locator('#enter-game').click();
  await page.waitForFunction(() => gameApp.state.visual.dealTime > 0.5);
  assert.equal(await page.evaluate(() => gameApp.audio.tracks[0].loop), true);
  await page.waitForFunction(() => !gameApp.audio.music.paused);
  assert.deepEqual(
    await page.evaluate(() =>
      gameApp.audio.musicTracks.map((track) => new URL(track.src).pathname.split('/').pop()),
    ),
    ['theme-1.m4a', 'theme-2.m4a'],
  );
  // 第一首结束后应切换到第二首继续播放。
  await page.evaluate(() => {
    gameApp.audio.music.pause();
    gameApp.audio.music.dispatchEvent(new Event('ended'));
  });
  await page.waitForFunction(
    () =>
      !gameApp.audio.music.paused &&
      new URL(gameApp.audio.music.src).pathname.endsWith('/theme-2.m4a'),
  );
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  assert.deepEqual(
    await page.evaluate(() => ({
      loop: gameApp.audio.tracks[0].loop,
      paused: gameApp.audio.tracks[0].paused,
    })),
    { loop: false, paused: true },
  );
  // 九小局的关卡推进、整场结算与新一场由 longplay-browser 用真实 UI 覆盖。
  // Settings changes apply without recreating or resetting the current deal.
  const hands = await page.evaluate(() => gameApp.state.game.hands);
  await page.locator('#open-settings').click();
  await page.locator('[data-scale="2"]').click();
  await page.locator('#close-settings').click();
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.hands), hands);
  await page.waitForFunction(() => document.getElementById('cpu-scene').width === innerWidth * 2);
  await page.locator('#open-settings').click();
  await page.locator('[data-scale="1"]').click();
  await page.locator('#close-settings').click();
  // Force a substantial balance transfer to inspect the actual sack easing in both directions.
  const bags = await page.evaluate(async () => {
    const { state } = gameApp;
    const { stepVisual } = await import('/game/scene.js');
    state.game.coins = [450, Infinity];
    state.visual.transfer = {
      from: 0,
      amount: 50,
      before: [500, Infinity],
      start: state.visual.time,
    };
    const before = state.visual.bags.map((bag) => bag.fillShow);
    for (let i = 0; i < 180; i++) stepVisual(state, 1 / 60);
    gameApp.render();
    return { before, after: state.visual.bags.map((bag) => bag.fillShow) };
  });
  assert.ok(bags.after[0] < bags.before[0]);
  assert.equal(bags.after[1], bags.before[1]);
  await page.screenshot({ path: 'test-results/sack-balance.png' });
  // 小视口的适配检查在 responsive-browser;录像视口全程保持全高清不切换。
  await page.evaluate(() => gameApp.render());
  await fit();
  assert.ok(await page.locator('#play-cards, #pass-turn').first().isVisible());
  // The Canvas renderer retains both sack palettes after a fresh page load.
  await page.evaluate(() => localStorage.clear());
  await page.goto(url({ page: 'game' }));
  await page.evaluate(() => gameApp.ready());
  assert.equal(await page.locator('#cpu-scene').count(), 1);
  assert.equal(await page.locator('#gpu-scene').count(), 0);
  assert.equal(
    await page.locator('.money-bag[data-player="0"]').getAttribute('data-palette'),
    'cobalt',
  );
  assert.equal(
    await page.locator('.money-bag[data-player="1"]').getAttribute('data-palette'),
    'tomato',
  );
  await page.locator('[data-slot="0"] [data-slot-action="new"]').click();
  await page.waitForFunction(() => gameApp.state.visual.dealTime > 0.4);
  await page.locator('#open-settings').click();
  // 发牌音效只循环约 2.1s 动画时间；慢速 CI 上 Playwright 点击的动作稳定性等待
  // 可能耗尽余量使发牌提前结束（loop 复位），因此开关用页面内同步点击完成。
  await page.evaluate(() => document.getElementById('sound-enabled').click());
  assert.equal(await page.evaluate(() => gameApp.audio.tracks[0].paused), true);
  await page.evaluate(() => document.getElementById('sound-enabled').click());
  assert.equal(await page.evaluate(() => gameApp.audio.tracks[0].loop), true);
  await page.evaluate(() => document.getElementById('music-enabled').click());
  assert.equal(await page.evaluate(() => gameApp.audio.music.paused), true);
  await page.evaluate(() => document.getElementById('music-enabled').click());
  await page.waitForFunction(() => !gameApp.audio.music.paused);
  await page.locator('#return-home').click();
  assert.equal(await page.evaluate(() => gameApp.audio.tracks[0].loop), false);
  assert.equal(await page.evaluate(() => gameApp.audio.music.paused), false);
  await page.goto(new URL('performance.html', base).href);
  await page.evaluate(() => performanceApp.ready());
  await page.waitForFunction(() => performanceApp.metrics.samples > 4);
  assert.equal(await page.locator('[data-animation]').count(), 6);
  assert.ok(await page.evaluate(() => performanceApp.metrics.history.length > 0));
  await page.screenshot({ path: 'test-results/performance-desktop.png' });
  for (const type of ['deal', 'play', 'transfer', 'bags', 'physics', 'selection']) {
    await page.locator(`[data-animation="${type}"]`).uncheck();
    const before = await page.evaluate((id) => performanceApp.clocks[id], type);
    await page.waitForTimeout(120);
    assert.equal(
      await page.evaluate((id) => performanceApp.clocks[id], type),
      before,
      `${type} freezes independently`,
    );
    await page.locator(`[data-animation="${type}"]`).check();
  }
  await page.locator('#pause-all').click();
  const before = await page.evaluate(() => ({ ...performanceApp.clocks }));
  await page.waitForTimeout(800);
  assert.deepEqual(await page.evaluate(() => performanceApp.clocks), before);
  assert.equal(await page.evaluate(() => performanceApp.metrics.redrawsPerSecond), 0);
  // Manual adjustments remain usable while the animation clocks are paused.
  await page.locator('.table-settings > summary').click();
  await page.locator('[data-table="walnut"]').click();
  assert.equal(await page.locator('[data-table="walnut"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#stress-sound').click();
  assert.equal(await page.locator('#stress-sound').getAttribute('aria-pressed'), 'true');
  await page.locator('#stress-sound').click();
  assert.equal(await page.locator('#vreset, #vspin, [data-animation="camera"]').count(), 0);
  assert.deepEqual(await page.evaluate(() => performanceApp.clocks), before);
  await page.locator('.table-settings > summary').click();
  const sampleCount = await page.evaluate(() => performanceApp.metrics.samples);
  await page.locator('#reset-metrics').click();
  assert.ok((await page.evaluate(() => performanceApp.metrics.samples)) < sampleCount);
  await page.locator('#pause-all').click();
  await page.waitForFunction((value) => performanceApp.clocks.transfer > value, before.transfer);
  await page.locator('#density').selectOption('4');
  await page.waitForFunction(() => performanceApp.state.visual.transfer.amount === 20);
  // Observe a complete physics cycle: rain, spill, bounces and spin-down all render.
  await page.waitForFunction(
    () =>
      performanceApp.physics.some((bag) =>
        bag.coins.some((coin) => ['fly', 'settle', 'rest'].includes(coin.mode)),
      ),
    { timeout: 15000 },
  );
  assert.equal(errors.length, 0, errors.join('\n'));
  await writeFile(
    'test-results/ui-pages-report.json',
    JSON.stringify({ passed: true, bags, errors }, null, 2),
  );
  console.log(
    'Home, settings persistence, looping audio, sacks, animation toggles, FPS and physics passed.',
  );
} finally {
  await browser.close();
  await recording.save();
}
