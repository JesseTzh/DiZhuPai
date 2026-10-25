// 玩法规则走查:通过公开 UI(gameApp.select/play/pass 与真实按钮)驱动具体牌型,
// 覆盖单元测试之外的 UI 接线——按钮禁用、选牌标签、赖子替身、免费过牌与收牌道具。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { FULL_HD, openRecording } from './video.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const recording = await openRecording(browser, 'gameplay-browser', { viewport: FULL_HD });
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
// 把玩家手牌换成已知牌并按当前规则重排,便于精确断言牌型。
const setHand = (ids) =>
  page.evaluate(async (cards) => {
    const { sortHand } = await import('/game/rules.js');
    const game = gameApp.state.game;
    game.hands[0] = sortHand([...cards], { stamp: game.stamp });
    game.selected = [];
    gameApp.render();
  }, ids);
// 造一个来自电脑的桌面目标并把回合交还玩家;传 null 即自由出牌。
const setTarget = (move, cards = []) =>
  page.evaluate(
    (setup) => {
      const state = gameApp.state,
        game = state.game;
      game.phase = 'playing';
      game.turn = 0;
      game.target = setup ? { player: 1, move: setup.move, cards: setup.cards } : null;
      game.last = setup ? { player: 1, type: 'play', move: setup.move, cards: setup.cards } : null;
      state.locked = false;
      gameApp.render();
    },
    move ? { move, cards } : null,
  );
const selectionText = () => page.locator('#selection').textContent();
const targetMove = () => page.evaluate(() => gameApp.state.game.target?.move ?? null);
try {
  await page.goto(url({ page: 'game' }));
  await page.evaluate(() => gameApp.ready());
  await page.locator('[data-slot="0"] [data-slot-action="new"]').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'playing');
  // 自由出牌回合:没选牌时出牌/过牌都不可用。
  assert.equal(await page.evaluate(() => gameApp.state.game.target), null);
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  assert.equal(await page.locator('#pass-turn').isEnabled(), false);
  assert.equal(await selectionText(), '');
  // 顺子:三到七,五张不同花色;打出后桌面目标就是这手顺子。
  await setHand([2, 16, 30, 44, 6, 12, 25]);
  for (const id of [2, 16, 30, 44, 6]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 5 张 · 顺子');
  await page.locator('#play-cards').click();
  assert.deepEqual(await targetMove(), { type: 'straight', main: 7, length: 5, name: '顺子' });
  assert.equal(await page.evaluate(() => gameApp.state.game.selected.length), 0);
  assert.equal(await page.evaluate(() => gameApp.state.game.hands[0].length), 2);
  // 压牌:用更大的对子盖住电脑的对子。
  await setHand([12, 25, 51, 2, 15]);
  await setTarget({ type: 'pair', main: 10, length: 2, name: '对子' }, [9, 22]);
  for (const id of [12, 25]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 2 张 · 对子');
  await page.locator('#play-cards').click();
  assert.equal((await targetMove()).main, 13);
  // 压不过:更小的对子让出牌按钮禁用,直接调用 play 也会被规则拒绝。
  await setHand([2, 15, 12, 25]);
  await setTarget({ type: 'pair', main: 15, length: 2, name: '对子' }, [1, 14]);
  for (const id of [2, 15]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 2 张 · 对子');
  assert.equal(await page.locator('#play-cards').isEnabled(), false);
  const beforeReject = await page.evaluate(() => ({
    hand: [...gameApp.state.game.hands[0]],
    target: gameApp.state.game.target?.move,
    selected: [...gameApp.state.game.selected],
  }));
  await page.evaluate(() => gameApp.play());
  assert.deepEqual(
    await page.evaluate(() => ({
      hand: [...gameApp.state.game.hands[0]],
      target: gameApp.state.game.target?.move,
      selected: [...gameApp.state.game.selected],
    })),
    beforeReject,
    '压不过的出牌被整单拒绝',
  );
  // 炸弹与王炸:四张九压过单张 2,王炸再压过炸弹(留一张余牌,避免提前清空获胜)。
  await setHand([8, 21, 34, 47, 52, 53, 51]);
  await setTarget({ type: 'single', main: 15, length: 1, name: '单张' }, [1]);
  for (const id of [8, 21, 34, 47]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 4 张 · 炸弹');
  await page.locator('#play-cards').click();
  assert.equal((await targetMove()).type, 'bomb');
  await page.evaluate(() => {
    const state = gameApp.state;
    state.locked = false;
    state.game.turn = 0;
    state.game.target = {
      player: 1,
      move: { type: 'bomb', main: 14, length: 4, name: '炸弹' },
      cards: [0, 13, 26, 39],
    };
    gameApp.render();
  });
  for (const id of [52, 53]) await page.evaluate((card) => gameApp.select(card), id);
  assert.equal(await selectionText(), '已选 2 张 · 王炸');
  await page.locator('#play-cards').click();
  assert.equal((await targetMove()).type, 'rocket');
  // 赖子:青蛙道具把一张手牌变成万能牌;赖子+6 组成对 6,恰好压过单张 5。
  await page.evaluate(() => {
    const game = gameApp.state.game;
    game.items = ['frog'];
    game.wildCard = 0;
    gameApp.render();
  });
  await setHand([0, 5, 51]);
  assert.equal(await page.locator('.hand-card[aria-label*="赖子"]').count(), 1);
  await setTarget({ type: 'pair', main: 4, length: 2, name: '对子' }, [3, 16]);
  for (const id of [0, 5]) await page.evaluate((card) => gameApp.select(card), id);
  assert.match(await selectionText(), /已选 2 张 · 对子 · 赖子作 6/);
  await page.locator('#play-cards').click();
  assert.deepEqual(await targetMove(), {
    type: 'pair',
    main: 6,
    length: 2,
    name: '对子',
    wildRank: 6,
  });
  // 口罩:本小局第一次过牌免费,金币纹丝不动。
  await page.evaluate(() => {
    const game = gameApp.state.game;
    game.items = ['mask'];
    game.freePassUsed = false;
    gameApp.render();
  });
  await setHand([12, 25]);
  const coinsBefore = await page.evaluate(() => [...gameApp.state.game.coins]);
  await setTarget({ type: 'single', main: 10, length: 1, name: '单张' }, [9]);
  await page.locator('#pass-turn').click();
  assert.equal(await page.evaluate(() => gameApp.state.game.freePassUsed), true);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.coins), coinsBefore);
  assert.equal(await page.evaluate(() => gameApp.state.game.history.at(-1).amount), 0);
  // 第二次过牌收费 5 金币,钱袋动画结束前回合处于锁定。
  await setTarget({ type: 'single', main: 10, length: 1, name: '单张' }, [35]);
  await page.locator('#pass-turn').click();
  await page.waitForFunction(() => !gameApp.state.locked);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.coins), [
    coinsBefore[0] - 5,
    coinsBefore[1] + 5,
  ]);
  assert.equal(await page.evaluate(() => gameApp.state.game.history.at(-1).amount), 5);
  // 小老鼠:把电脑的出牌收回手牌,一局一次,按钮随之隐藏。
  await page.evaluate(() => {
    const game = gameApp.state.game;
    game.items = ['mouse'];
    game.stealUsed = false;
    gameApp.render();
  });
  await setHand([51]);
  await setTarget({ type: 'single', main: 10, length: 1, name: '单张' }, [48]);
  assert.equal(await page.locator('#steal-cards').isVisible(), true);
  await page.locator('#steal-cards').click();
  await page.waitForFunction(() => !gameApp.state.locked);
  assert.equal(await page.evaluate(() => gameApp.state.game.stealUsed), true);
  assert.equal(await page.evaluate(() => gameApp.state.game.target), null);
  assert.ok(await page.evaluate(() => gameApp.state.game.hands[0].includes(48)));
  assert.equal(await page.locator('#steal-cards').isVisible(), false);
  // 只剩一张牌时打出即获胜,胜场入账并进入商店。
  await page.evaluate(() => {
    const state = gameApp.state,
      game = state.game;
    game.hands[0] = [47];
    game.selected = [];
    game.wildCard = null;
    game.phase = 'playing';
    game.turn = 0;
    game.target = null;
    state.locked = false;
    gameApp.render();
  });
  await page.evaluate(() => gameApp.select(47));
  await page.locator('#play-cards').click();
  await page.waitForFunction(() => gameApp.state.game.phase === 'over');
  assert.equal(await page.evaluate(() => gameApp.state.game.winner), 0);
  assert.deepEqual(await page.evaluate(() => gameApp.state.game.wins), [1, 0]);
  assert.match(await page.evaluate(() => gameApp.state.game.message), /你赢了这一局/);
  await page.waitForFunction(() => gameApp.state.game.phase === 'shop');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    'Gameplay browser flow passed: straights, pairs, rejected beats, bomb, rocket, wild substitution, free pass, paid pass, steal and win-to-shop.',
  );
} finally {
  await browser.close();
  await recording.save();
}
