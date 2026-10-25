// 手机端对局走查:858×396 横屏(精确 19.5:9)+ 真实触控(page.tap),从发牌一路打到商店再进下一局。
// 视口全程固定,录像画布与视口一致,按手机横屏原尺寸满幅录制。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PHONE_LANDSCAPE, openRecording } from './video.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const recording = await openRecording(browser, 'mobile-game-browser', {
  viewport: PHONE_LANDSCAPE,
  hasTouch: true,
});
const page = recording.page;
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
// 固定随机种子：发牌与商店刷新完全可复现，测试结果不再随运行漂移。
const url = (params = {}) => {
  const target = new URL(process.env.TEST_URL || 'http://127.0.0.1:5173/');
  target.searchParams.set('seed', 'dizhupai-347');
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, String(value));
  return target.href;
};
const noHorizontalScroll = async () =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    '手机端不应出现横向滚动',
  );
const waitMyTurn = () =>
  page.waitForFunction(
    () =>
      gameApp.state.game.phase === 'shop' ||
      gameApp.state.game.phase === 'over' ||
      (!gameApp.state.locked && gameApp.state.game.turn === 0),
  );
try {
  await page.goto(url({ page: 'game' }));
  await page.evaluate(() => gameApp.ready());
  // 手机端判定走查:触屏与横屏两个能力媒体查询都命中,竖屏提示保持隐藏。
  assert.equal(
    await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches),
    true,
    '触屏判定',
  );
  assert.equal(
    await page.evaluate(() => matchMedia('(orientation: landscape)').matches),
    true,
    '横屏判定',
  );
  assert.equal(await page.locator('#rotate-hint').isVisible(), false, '横屏下无竖屏提示');
  await page.tap('[data-slot="0"] [data-slot-action="new"]');
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  assert.ok(await page.locator('.game-topbar').isVisible());
  assert.equal(await page.locator('.hand-card').count(), 18);
  await page.screenshot({ path: 'test-results/mobile-dealt.png' });
  // 触控选牌:点选最右侧一张(扇形手牌中它压在最上层),再点一次取消,最后保持单选。
  const card = page.locator('.hand-card').last();
  const cardId = await card.getAttribute('data-card');
  await card.tap();
  assert.equal(await page.evaluate(() => gameApp.state.game.selected.length), 1);
  await card.tap();
  assert.equal(await page.evaluate(() => gameApp.state.game.selected.length), 0);
  await card.tap();
  assert.equal(await page.evaluate(() => gameApp.state.game.selected.length), 1);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.selected), [Number(cardId)]);
  await noHorizontalScroll();
  // 单张直接可出;电脑应手后把回合交回来。
  await page.tap('#play-cards');
  await waitMyTurn();
  await page.screenshot({ path: 'test-results/mobile-played.png' });
  // 造一个电脑目标,触控过牌触发 5 金币转移。
  const coins = await page.evaluate(() => [...gameApp.state.game.coins]);
  await page.evaluate(() => {
    const state = gameApp.state,
      game = state.game;
    game.phase = 'playing';
    game.turn = 0;
    game.target = {
      player: 1,
      move: { type: 'single', main: 10, length: 1, name: '单张' },
      cards: [9],
    };
    game.last = { player: 1, type: 'play', move: game.target.move, cards: [9] };
    state.locked = false;
    gameApp.render();
  });
  await page.tap('#pass-turn');
  await page.waitForFunction(() => !gameApp.state.locked);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.coins), [
    coins[0] - 5,
    coins[1] + 5,
  ]);
  await waitMyTurn();
  // 收官:直接打出最后一张牌进商店,触控购买并进入下一局。
  await page.evaluate(() => {
    const state = gameApp.state,
      game = state.game;
    game.phase = 'playing';
    game.turn = 0;
    game.hands[0] = [47];
    game.selected = [];
    game.target = null;
    state.locked = false;
    gameApp.render();
  });
  await page.evaluate(() => gameApp.select(47));
  await page.tap('#play-cards');
  await page.waitForFunction(() => gameApp.state.game.phase === 'shop');
  assert.ok(await page.locator('#shop').isVisible());
  await noHorizontalScroll();
  await page.screenshot({ path: 'test-results/mobile-shop.png' });
  const beforePurchase = await page.evaluate(() => gameApp.state.game.coins[0]);
  await page.tap('[data-buy="frog"]');
  assert.equal(await page.evaluate(() => gameApp.state.game.items.includes('frog')), true);
  assert.equal(await page.evaluate(() => gameApp.state.game.coins[0]), beforePurchase - 20);
  await page.tap('#leave-shop');
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  assert.equal(await page.evaluate(() => gameApp.state.game.round), 2);
  assert.equal(await page.locator('.wild-card-model').count(), 1);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'Mobile gameplay passed: touch select/deselect, play, pass transfer, shop purchase and next round on an 858x396 landscape (19.5:9) viewport.',
  );
} finally {
  await browser.close();
  await recording.save();
}
