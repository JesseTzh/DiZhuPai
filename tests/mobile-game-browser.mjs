// 手机端对局走查:858×396 横屏(精确 19.5:9)+ 真实触控(page.tap),从发牌一路打到商店再进下一局。
// 视口全程固定,录像画布与视口一致,按手机横屏原尺寸满幅录制。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PHONE_LANDSCAPE, openRecording } from './video.mjs';
import { setTarget, url } from './harness.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const recording = await openRecording(browser, 'mobile-game-browser', {
  viewport: PHONE_LANDSCAPE,
  hasTouch: true,
});
const page = recording.page;
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const noHorizontalScroll = async () =>
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    '手机端不应出现横向滚动',
  );
// 状态栏应让出整块牌桌高度，操作按钮跟随剩余牌桌区域居中。
const checkMobileLayout = async () => {
  const bar = await page.locator('.game-topbar').boundingBox();
  const table = await page.locator('.zwrap').boundingBox();
  const play = await page.locator('#play-cards').boundingBox();
  const pass = await page.locator('#pass-turn').boundingBox();
  const actionRects = [pass, play];
  if (await page.locator('#steal-cards').isVisible()) {
    actionRects.push(await page.locator('#steal-cards').boundingBox());
  }
  const actionLeft = Math.min(...actionRects.map((rect) => rect.x));
  const actionRight = Math.max(...actionRects.map((rect) => rect.x + rect.width));
  const viewport = page.viewportSize();
  assert.ok(bar.height > bar.width * 2, '手机状态栏竖排');
  assert.ok(bar.x + bar.width <= table.x, '侧栏不遮挡牌桌');
  assert.ok(table.height >= viewport.height * 0.94, '牌桌充分利用屏幕高度');
  assert.ok(play.width < 112 && play.height < 52, '手机出牌按钮缩小');
  assert.ok(pass.width < 112 && pass.height < 52, '手机过牌按钮缩小');
  assert.ok(
    Math.abs((actionLeft + actionRight) / 2 - (table.x + table.width / 2)) < 2,
    '行动按钮在牌桌内居中',
  );
  for (const rect of [bar, table, ...actionRects]) {
    assert.ok(
      rect.x >= 0 &&
        rect.y >= 0 &&
        rect.x + rect.width <= viewport.width &&
        rect.y + rect.height <= viewport.height,
      '手机界面元素在屏幕内',
    );
  }
  await noHorizontalScroll();
};
const waitMyTurn = () =>
  page.waitForFunction(
    () =>
      gameApp.state.game.phase === 'shop' ||
      gameApp.state.game.phase === 'over' ||
      (!gameApp.state.locked && gameApp.state.game.turn === 0),
  );
try {
  await page.goto(url());
  await page.evaluate(() => gameApp.ready());
  const homeButton = await page.locator('#enter-game').boundingBox();
  assert.ok(homeButton.width < 190 && homeButton.height < 54, '手机主界面按钮缩小');
  await page.screenshot({ path: 'test-results/mobile-home.png' });
  await page.evaluate(() => localStorage.clear());
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
  await checkMobileLayout();
  // 手机端相机垂直俯视牌桌,手牌比桌面端大一档,整行仍在牌桌内、不压到屏幕底边。
  const camera = await page.evaluate(async () => (await import('/engine/camera.js')).cameraView());
  assert.deepEqual(camera, { pitch: 90, distance: 0 }, '手机端相机正对桌面');
  const handRow = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.hand-card')].map((el) =>
      el.getBoundingClientRect(),
    );
    return {
      left: Math.min(...cards.map((rect) => rect.left)),
      right: Math.max(...cards.map((rect) => rect.right)),
      bottom: Math.max(...cards.map((rect) => rect.bottom)),
      width: cards[0].width,
      height: cards[0].height,
    };
  });
  const table = await page.locator('.zwrap').boundingBox();
  const rowWidth = handRow.right - handRow.left;
  assert.ok(handRow.width > 60 && handRow.height > 85, '手机端手牌放大');
  assert.ok(handRow.left >= table.x && handRow.right <= table.x + table.width, '手牌整行在牌桌内');
  assert.ok(rowWidth >= table.width * 0.6, '手牌铺开利用牌桌宽度');
  assert.ok(handRow.bottom <= page.viewportSize().height - 12, '手牌不压屏幕底边');
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
  // 用全部道具检查窄屏侧栏，并在同一对局里改变尺寸验证重绘及点击区域。
  await page.evaluate(async () => {
    const { ITEMS } = await import('/game/items.js');
    gameApp.state.game.items = ITEMS.map((item) => item.id);
    gameApp.render();
  });
  for (const [width, height] of [
    [858, 396],
    [667, 375],
    [568, 320],
    [932, 430],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(
      () =>
        document.querySelector('.game-actions-canvas').clientWidth === innerWidth &&
        document.querySelector('.game-actions-canvas').width ===
          Math.round(innerWidth * devicePixelRatio),
    );
    // 小老鼠的收牌按钮只在电脑有桌面目标时出现。固定两种状态，避免电脑出牌时机
    // 决定测到哪种布局；居中与屏幕边界检查都应包含当前完整的行动按钮组。
    for (const target of [null, { type: 'single', main: 10, length: 1, name: '单张' }]) {
      await setTarget(page, target, [9]);
      assert.equal(await page.locator('#steal-cards').isVisible(), target !== null);
      await checkMobileLayout();
    }
    await page.locator('.topbar-item').last().focus();
    await page.screenshot({ path: `test-results/mobile-sidebar-${width}x${height}.png` });
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'Mobile gameplay passed: touch select/deselect, play, pass transfer, shop purchase and next round on an 858x396 landscape (19.5:9) viewport.',
  );
} finally {
  await browser.close();
  await recording.save();
}
