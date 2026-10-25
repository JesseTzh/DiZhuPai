import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { openRecording } from './video.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const recording = await openRecording(browser, 'interactions-browser', {
  viewport: { width: 1280, height: 900 },
});
const page = recording.page;
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
// 固定随机种子：发牌与商店刷新完全可复现，测试结果不再随运行漂移。
const withSeed = (params = {}) => {
  const target = new URL(process.env.TEST_URL || 'http://127.0.0.1:5173/');
  target.searchParams.set('seed', 'dizhupai-347');
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, String(value));
  return target.href;
};
// 悬停进度按帧推进（dt 封顶 32ms），慢速 CI 渲染器上 80ms 的动画需要更多真实时间，
// 所以等待 data-hover 到位而不是固定延时。
const hoverDone = (id) =>
  page.waitForFunction(
    (card) =>
      [...document.querySelectorAll('.hand-card')].some(
        (node) => node.dataset.card === card && node.dataset.hover === '1.000',
      ),
    id,
  );
try {
  await page.goto(withSeed());
  await page.evaluate(() => gameApp.ready());
  await page.evaluate(() => {
    window.hoverSounds = 0;
    const hover = gameApp.audio.hover;
    gameApp.audio.hover = (index) => {
      if (index === 3) window.hoverSounds++;
      return hover(index);
    };
  });
  await page.locator('#enter-game').hover();
  assert.equal(await page.evaluate(() => window.hoverSounds), 1);
  const url = page.url();
  await page.locator('#home-settings').click();
  assert.equal(page.url(), url);
  assert.equal(await page.locator('#settings-screen').evaluate((node) => node.open), true);
  assert.equal(await page.locator('#home-screen').isVisible(), true);
  assert.equal(
    await page
      .locator('#settings-screen [role="switch"], #settings-screen [role="radiogroup"]')
      .count(),
    2,
  );
  await page.locator('#sound-enabled').click();
  assert.equal(await page.evaluate(() => gameApp.audio.muted), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#settings-screen').evaluate((node) => node.open), false);
  await page.locator('#enter-game').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  assert.equal(await page.locator('#hint, #clear-selection, .zchip, .table-menu').count(), 0);
  // The game topbar paints its gear on canvas, so only a labelled hit area remains.
  assert.equal(await page.locator('#open-settings.topbar-hit').count(), 1);
  assert.equal(await page.locator('#open-settings').getAttribute('aria-label'), '设置');
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(120);
    const cards = page.locator('.hand-card');
    const order = await cards.evaluateAll((nodes) => nodes.map((n) => n.dataset.card));
    const card = cards.nth(4);
    const cardId = await card.getAttribute('data-card');
    const resting = await card.locator('path').getAttribute('d');
    const box = await card.boundingBox();
    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    await hoverDone(cardId);
    assert.equal(await card.locator('path').getAttribute('d'), resting);
    assert.deepEqual(await cards.evaluateAll((nodes) => nodes.map((n) => n.dataset.card)), order);
    await card.dispatchEvent('pointerdown', { button: 0 });
    assert.equal(await page.evaluate(() => gameApp.state.game.selected.length), 1);
    assert.deepEqual(await cards.evaluateAll((nodes) => nodes.map((n) => n.dataset.card)), order);
    await page.mouse.click(3, 100);
    assert.equal(await page.evaluate(() => gameApp.state.game.selected.length), 0);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(120);
    assert.equal(await card.locator('path').getAttribute('d'), resting);
    // A stationary pointer at the lower edge used to alternate hover on/off every frame.
    const edgeCard = cards.last(),
      edgeBox = await edgeCard.boundingBox();
    await page.mouse.move(edgeBox.x + edgeBox.width / 2, edgeBox.y + edgeBox.height - 2);
    await hoverDone(await edgeCard.getAttribute('data-card'));
    const edgePath = await edgeCard.locator('path').getAttribute('d');
    for (let sample = 0; sample < 6; sample++) {
      await page.waitForTimeout(80);
      assert.equal(await edgeCard.getAttribute('data-hover'), '1.000');
      assert.equal(await edgeCard.locator('path').getAttribute('d'), edgePath);
    }
    await page.mouse.move(0, 0);
    const before = await page.evaluate(() => structuredClone(gameApp.state.game));
    await page.locator('.money-bag[data-player="0"]').click();
    await page.waitForFunction(
      () =>
        gameApp.state.visual.spill &&
        gameApp.state.visual.time - gameApp.state.visual.spill.start > 0.4,
    );
    assert.equal(await page.evaluate(() => gameApp.state.visual.transfer), null);
    await page.screenshot({ path: `test-results/bag-spill-${width}.png` });
    await page.waitForFunction(() => !gameApp.state.visual.spill);
    assert.deepEqual(await page.evaluate(() => gameApp.state.game), before);
    await page.locator('#open-settings').click();
    await page.locator('[data-scale="1"]').click();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-scale="1.5"]').getAttribute('aria-checked'), 'true');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('[data-scale="1"]').getAttribute('aria-checked'), 'true');
    await page.screenshot({ path: `test-results/settings-modal-${width}.png` });
    await page.mouse.click(1, 1);
    assert.equal(await page.locator('#settings-screen').evaluate((node) => node.open), false);
    assert.equal(await page.locator('#pass-turn').isEnabled(), !!before.target);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('render-scale')), '1');
  assert.deepEqual(errors, []);
  console.log(
    'Hover audio, stable card order, empty table deselection, decorative bag spill, modal settings and desktop layout passed.',
  );
} finally {
  await browser.close();
  await recording.save();
}
