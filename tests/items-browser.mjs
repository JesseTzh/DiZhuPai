// 道具逐件走查:每件道具注入后都通过真实按钮触发效果,覆盖单元测试之外的 UI 接线。
// 七件道具各一节:赖子、三带二、大顺、印章、天平、口罩、小老鼠;道具规则只对玩家生效。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { cardDeck } from '../src/assets/cards/deck.js';
import { rankOf } from '../src/game/rules.js';
import { FULL_HD, openRecording } from './video.mjs';
import { injectItem, newGame, setHand, setTarget, url } from './harness.mjs';

// 与 items.test.mjs 相同的取牌辅助:按点数挑不重复的牌 id。
const cards = (...ranks) => {
  const used = new Set();
  return ranks.map((rank) => {
    const id = cardDeck.find((c) => rankOf(c.id) === rank && !used.has(c.id)).id;
    used.add(id);
    return id;
  });
};

const browser = await chromium.launch({ channel: 'chrome' });
const recording = await openRecording(browser, 'items-browser', { viewport: FULL_HD });
const page = recording.page;
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const selectionText = () => page.locator('#selection').textContent();
const targetMove = () => page.evaluate(() => gameApp.state.game.target?.move ?? null);
const targetPlayer = () => page.evaluate(() => gameApp.state.game.target?.player ?? null);
// 玩家出牌后回合会交给电脑并在 950ms 后自动行动;立刻把回合拨回玩家一侧,
// 让挂起的电脑定时器自查失效,断言期间桌面目标保持是我们的注入值。
const disarmCpu = () => page.evaluate(() => (gameApp.state.game.turn = 0));
// 每节从干净的一局开始,道具注入互不串扰。
const freshGame = async () => {
  await page.goto(url({ page: 'game' }));
  await page.evaluate(() => gameApp.ready());
  await newGame(page);
};
try {
  // 赖子:青蛙道具把一张手牌变成万能牌;赖子+6 组成对 6,恰好压过单张 5。
  await freshGame();
  await page.evaluate(() => {
    const game = gameApp.state.game;
    game.items = ['frog'];
    game.wildCard = 0;
    gameApp.render();
  });
  await setHand(page, [0, 5, 51]);
  assert.equal(await page.locator('.hand-card[aria-label*="赖子"]').count(), 1);
  await setTarget(page, { type: 'pair', main: 4, length: 2, name: '对子' }, [3, 16]);
  for (const id of [0, 5]) await page.evaluate((card) => gameApp.select(card), id);
  assert.match(await selectionText(), /已选 2 张 · 对子 · 赖子作 6/);
  await page.locator('#play-cards').click();
  await disarmCpu();
  assert.deepEqual(await targetMove(), {
    type: 'pair',
    main: 6,
    length: 2,
    name: '对子',
    wildRank: 6,
  });

  // 三带二:点数不同的两张单牌要靠 hand 道具才能挂上三张;无道具时出牌按钮禁用。
  await freshGame();
  const triplePair = cards(7, 7, 7, 3, 5);
  await setHand(page, triplePair);
  for (const id of triplePair) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  await injectItem(page, 'hand');
  await setHand(page, triplePair);
  for (const id of triplePair) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 5 张 · 三带二');
  await page.locator('#play-cards').click();
  await disarmCpu();
  assert.equal((await targetMove()).type, 'triplePair');

  // 大顺:四张连点数成顺;含 2 的四连(12,13,14,15)即便有道具也非法。
  await freshGame();
  const fourStraight = cards(10, 11, 12, 13);
  await setHand(page, [...fourStraight, ...cards(3)]);
  for (const id of fourStraight) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  await injectItem(page, 'dragon');
  await setHand(page, [...fourStraight, ...cards(3)]);
  for (const id of fourStraight) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 4 张 · 顺子');
  await page.locator('#play-cards').click();
  await disarmCpu();
  assert.deepEqual(await targetMove(), { type: 'straight', main: 13, length: 4, name: '顺子' });
  const withTwo = cards(12, 13, 14, 15);
  await setHand(page, [...withTwo, ...cards(3)]);
  for (const id of withTwo) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await page.locator('#play-cards').isEnabled(), false);

  // 印章:把 7 升成 8,与真 8 组成对 8;没有印章时同样的两张不成立。
  await freshGame();
  const seven = cards(7)[0],
    eight = cards(8)[0];
  await setHand(page, [seven, eight, ...cards(3)]);
  for (const id of [seven, eight]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  await page.evaluate(
    (stamp) => {
      const game = gameApp.state.game;
      game.items = ['stamp'];
      game.stamp = stamp;
      gameApp.render();
    },
    { card: seven, rank: 8 },
  );
  await setHand(page, [seven, eight, ...cards(3)]);
  for (const id of [seven, eight]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 2 张 · 对子');
  await page.locator('#play-cards').click();
  await disarmCpu();
  assert.deepEqual(await targetMove(), { type: 'pair', main: 8, length: 2, name: '对子' });

  // 天平:同点对子也能压过电脑的对子,桌面目标回到玩家手里。
  await freshGame();
  const eights = cards(8, 8);
  await setHand(page, [...eights, ...cards(3, 4)]);
  await setTarget(page, { type: 'pair', main: 8, length: 2, name: '对子' }, cards(8, 8));
  for (const id of eights) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  await injectItem(page, 'balance');
  await setHand(page, [...eights, ...cards(3, 4)]);
  for (const id of eights) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 2 张 · 对子');
  await page.locator('#play-cards').click();
  await disarmCpu();
  assert.equal(await targetPlayer(), 0);
  assert.equal((await targetMove()).main, 8);

  // 口罩:本小局第一次过牌免费,金币纹丝不动;第二次过牌按点数差收费 10 金币。
  await freshGame();
  await injectItem(page, 'mask');
  await page.evaluate(() => {
    gameApp.state.game.freePassUsed = false;
    gameApp.render();
  });
  await setHand(page, [12, 25]);
  const coinsBefore = await page.evaluate(() => [...gameApp.state.game.coins]);
  await setTarget(page, { type: 'single', main: 10, length: 1, name: '单张' }, [9]);
  await page.locator('#pass-turn').click();
  assert.equal(await page.evaluate(() => gameApp.state.game.freePassUsed), true);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.coins), coinsBefore);
  assert.equal(await page.evaluate(() => gameApp.state.game.history.at(-1).amount), 0);
  // 免费过牌不锁动画,但 950ms 后电脑会接牌;把回合拨回玩家再注入第二次过牌。
  await disarmCpu();
  await setTarget(page, { type: 'single', main: 10, length: 1, name: '单张' }, [35]);
  await page.locator('#pass-turn').click();
  await page.waitForFunction(() => !gameApp.state.locked);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.coins), [
    coinsBefore[0] - 10,
    Infinity,
  ]);
  assert.equal(await page.evaluate(() => gameApp.state.game.history.at(-1).amount), 10);

  // 小老鼠:把电脑的出牌收回手牌,一局一次,按钮随之隐藏。
  await freshGame();
  await injectItem(page, 'mouse');
  await page.evaluate(() => {
    gameApp.state.game.stealUsed = false;
    gameApp.render();
  });
  await setHand(page, [51]);
  await setTarget(page, { type: 'single', main: 10, length: 1, name: '单张' }, [48]);
  assert.equal(await page.locator('#steal-cards').isVisible(), true);
  await page.locator('#steal-cards').click();
  await page.waitForFunction(() => !gameApp.state.locked);
  assert.equal(await page.evaluate(() => gameApp.state.game.stealUsed), true);
  assert.equal(await page.evaluate(() => gameApp.state.game.target), null);
  assert.ok(await page.evaluate(() => gameApp.state.game.hands[0].includes(48)));
  assert.equal(await page.locator('#steal-cards').isVisible(), false);

  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('Items browser flow passed: frog, hand, dragon, stamp, balance, mask, mouse.');
} finally {
  await browser.close();
  await recording.save();
}
