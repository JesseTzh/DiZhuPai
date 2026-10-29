import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { FULL_HD, openRecording } from './video.mjs';
import { url } from './harness.mjs';
const browser = await chromium.launch({ channel: 'chrome' });
const recording = await openRecording(browser, 'shop-browser', {
  viewport: FULL_HD,
});
const page = recording.page;
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// 固定随机种子 dizhupai-347（harness.TEST_SEED）：第一轮货架恰好是经典三件套
// （frog/hand/dragon），之后每次补货同样可复现，无需再打补丁替换 Math.random。
async function endRound() {
  await page.evaluate(() => {
    const s = gameApp.state,
      g = s.game;
    g.phase = 'playing';
    g.turn = 0;
    g.hands[0] = [0];
    g.selected = [0];
    g.target = null;
    s.locked = false;
    gameApp.play();
  });
}
try {
  await page.goto(url({ page: 'game' }));
  await page.evaluate(() => gameApp.ready());
  await page.locator('[data-slot="0"] [data-slot-action="new"]').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  // The fixed URL seed stocks the counter with the classic trio deterministically.
  await endRound();
  await page.waitForFunction(() => document.body.classList.contains('clearing-table'));
  await page.screenshot({ path: 'test-results/shop-table-exit.png' });
  await page.waitForFunction(() => gameApp.state.game.phase === 'shop');
  await page.waitForTimeout(700);
  assert.equal(await page.locator('#shop').isVisible(), true);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.shopStock), [
    'frog',
    'hand',
    'dragon',
  ]);
  assert.equal(await page.locator('.toy-model').count(), 7);
  assert.equal(await page.locator('.toy-model:visible').count(), 3);
  assert.equal(await page.locator('[data-part^="finger-"]').count(), 5);
  await page.screenshot({ path: 'test-results/shop-desktop.png' });
  // the account plaque is gone; the topbar carries the coin balance instead
  assert.equal(await page.locator('.shop-wallet, .shop-coin').count(), 0);
  assert.equal(await page.locator('#current-coins').textContent(), '当前金币 500');
  assert.equal(await page.locator('#shop-result, .shop-heading h1, .owned-mark').count(), 0);
  assert.doesNotMatch(
    await page.locator('#shop').innerText(),
    /你的金币|悬停玩具|掌柜今日精选|好运玩具铺|胜场/,
  );
  assert.match(await page.locator('#shop-frame').textContent(), /鹅掌柜杂货铺/);
  for (const id of ['frog', 'hand', 'dragon']) {
    await page.locator(`[data-buy="${id}"]`).click();
    assert.equal(await page.locator(`#shop [data-item="${id}"]`).isVisible(), false);
    assert.equal(await page.locator(`[data-toy="${id}"]`).isVisible(), false);
    assert.equal(await page.locator(`[data-toy-stand="${id}"]`).isVisible(), false);
  }
  await page.screenshot({ path: 'test-results/shop-purchased.png' });
  assert.equal(await page.locator('#current-coins').textContent(), '当前金币 425');
  assert.equal(await page.locator('[data-buy="frog"]').isDisabled(), true);
  await page.locator('#leave-shop').click();
  await page.waitForFunction(() => gameApp.state.visual.dealTime > 2.38);
  assert.equal(await page.evaluate(() => gameApp.state.locked), true);
  assert.equal(await page.evaluate(() => gameApp.state.game.phase), 'dealing');
  await page.screenshot({ path: 'test-results/frog-wild-reveal.png' });
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  assert.equal(await page.evaluate(() => gameApp.state.game.round), 2);
  await page.waitForSelector('.wild-card-model');
  assert.equal(await page.locator('.wild-card-model').count(), 1);
  assert.equal(await page.locator('.center-label').count(), 0);
  assert.equal(await page.locator('#level-detail, .level-progress').count(), 0);
  assert.equal(await page.locator('.hand-card[aria-label*="赖子"]').count(), 1);
  assert.equal(await page.locator('.table-item').count(), 3);
  for (const id of ['frog', 'hand', 'dragon']) {
    await page.locator(`#table-item-${id}`).hover();
    assert.equal(await page.locator('#item-tooltip').isVisible(), true);
    assert.match(await page.locator('#item-tooltip').textContent(), /本场持续生效/);
  }
  await page.mouse.move(0, 0);
  assert.equal(await page.locator('#item-tooltip').isVisible(), false);
  assert.equal(await page.locator('#camera-pitch, .camera-controls').count(), 0);
  assert.equal(
    await page.evaluate(async () => (await import('/engine/camera.js')).cameraView().pitch),
    68,
  );
  await page.screenshot({ path: 'test-results/shop-items-in-play.png' });
  assert.equal(await page.locator('.wild-card-model').count(), 1);
  // the next visit restocks from the toys still missing
  await endRound();
  await page.waitForFunction(() => gameApp.state.game.phase === 'shop');
  const restock = await page.evaluate(() => gameApp.state.game.shopStock);
  assert.equal(restock.length, 3);
  assert.ok(restock.every((id) => !['frog', 'hand', 'dragon'].includes(id)));
  assert.equal(await page.locator('.shop-product:visible').count(), 3);
  assert.equal(await page.locator('.toy-model:visible').count(), 3);
  await page.screenshot({ path: 'test-results/shop-restocked.png' });
  await page.locator('#leave-shop').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  assert.equal(await page.evaluate(() => gameApp.state.game.round), 3);
  await page.locator('#table-item-frog').focus();
  assert.equal(await page.locator('#item-tooltip').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#item-tooltip').isVisible(), false);
  await endRound();
  await page.waitForFunction(() => gameApp.state.game.phase === 'shop');
  assert.match(await page.locator('#leave-shop').textContent(), /第 2 大关/);
  await page.locator('#leave-shop').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  assert.equal(await page.evaluate(() => gameApp.state.game.stage), 2);
  assert.equal(await page.evaluate(() => gameApp.state.game.items.length), 3);
  // Last round remains a match result and a fresh match clears its inventory.
  await page.evaluate(() => {
    gameApp.state.game.round = 9;
    gameApp.state.game.stage = 3;
    gameApp.state.game.substage = 3;
  });
  await endRound();
  await page.waitForTimeout(1700);
  assert.equal(await page.evaluate(() => gameApp.state.game.matchOver), true);
  assert.equal(await page.locator('#shop').isVisible(), false);
  await page.locator('#start-game').click();
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.items), []);
  assert.equal(await page.evaluate(() => gameApp.state.game.wildCard), null);
  assert.deepEqual(errors, []);
  console.log(
    'Shop browser flow passed: animated exit, all purchases, five fingers, frog wild model, stage change, match reset.',
  );
} finally {
  await browser.close();
  await recording.save();
}
