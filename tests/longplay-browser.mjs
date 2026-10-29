// 长程对局:固定种子下用真实 UI(hint 按钮 + 出牌/过牌)打完整场 9 小局,
// 逐局与 Node 侧纯逻辑参考模拟比对。hint 的首选与电脑决策同源(chooseMove),
// 同种子下浏览器整场重放应当与规则层模拟完全一致——这是对"固定种子可复现"
// 与"UI 接线不改写对局结果"的双重回归。
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  createGame,
  deal,
  enterShop,
  finishDeal,
  pass,
  play,
  ruleOptions,
} from '../src/game/state.js';
import { chooseMove } from '../src/game/rules.js';
import { FULL_HD, openRecording } from './video.mjs';
import { newGame, url } from './harness.mjs';

// 长程对局专用种子：覆盖九小局和整场结算。
const LONGPLAY_SEED = 'dizhupai-longplay';

// 参考实现:双方都走 chooseMove(与页面 hint 首选/电脑完全同源),不购物、不注入,
// 记录每小局的胜者、胜场与金币,作为浏览器整场游玩的断言基准。
function simulateMatch(seed) {
  const game = createGame(seed);
  const rounds = [];
  while (!game.matchOver) {
    if (!deal(game)) throw new Error('参考模拟未打满 9 小局');
    finishDeal(game);
    let guard = 0;
    while (game.phase === 'playing') {
      if (guard++ > 500) throw new Error('参考模拟卡在出牌循环');
      const p = game.turn;
      const move = chooseMove(
        game.hands[p],
        game.target?.move,
        game.hands[1 - p].length,
        ruleOptions(game, p),
      );
      if (move) play(game, p, move.cards);
      else pass(game, p);
    }
    rounds.push({
      round: game.round,
      winner: game.winner,
      wins: [...game.wins],
      coins: [...game.coins],
      matchOver: game.matchOver,
      matchWinner: game.matchWinner,
    });
    if (!game.matchOver) assert.ok(enterShop(game));
  }
  return rounds;
}

const reference = simulateMatch(LONGPLAY_SEED);
assert.equal(reference.length, 9, '参考模拟应打满 9 小局');
assert.equal(reference.at(-1).matchOver, true);

const browser = await chromium.launch({ channel: 'chrome' });
const recording = await openRecording(browser, 'longplay-browser', { viewport: FULL_HD });
const page = recording.page;
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(url({ page: 'game', seed: LONGPLAY_SEED }));
  await page.evaluate(() => gameApp.ready());
  await newGame(page);
  for (const expected of reference) {
    // 每回合只提示一次:hint 首选即 chooseMove,出牌/过牌后 hintIndex 归零,
    // 因此整场的玩家决策与参考模拟逐手一致;动画锁与电脑回合由等待条件自然跳过。
    let finished = false;
    for (let moves = 0; moves < 120 && !finished; moves++) {
      await page.waitForFunction(
        () =>
          ['over', 'shop'].includes(gameApp.state.game.phase) ||
          (!gameApp.state.locked &&
            gameApp.state.game.phase === 'playing' &&
            gameApp.state.game.turn === 0),
      );
      if (await page.evaluate(() => gameApp.state.game.phase !== 'playing')) {
        finished = true;
        break;
      }
      await page.evaluate(() => gameApp.hint());
      if (await page.locator('#play-cards').isEnabled()) await page.locator('#play-cards').click();
      else await page.locator('#pass-turn').click();
    }
    assert.equal(finished, true, `第 ${expected.round} 小局未在限定步数内结束`);
    const actual = await page.evaluate(() => ({
      round: gameApp.state.game.round,
      winner: gameApp.state.game.winner,
      wins: [...gameApp.state.game.wins],
      coins: [...gameApp.state.game.coins],
      matchOver: gameApp.state.game.matchOver,
      matchWinner: gameApp.state.game.matchWinner,
    }));
    assert.deepEqual(actual, expected, `第 ${expected.round} 小局与参考模拟不一致`);
    if (!expected.matchOver) {
      await page.waitForFunction(() => gameApp.state.game.phase === 'shop');
      await page.locator('#leave-shop').click();
    }
  }
  // 整场终局：玩家余额非负，电脑金币无限，胜场之和为 9。
  const final = reference.at(-1);
  assert.equal(await page.evaluate(() => gameApp.state.game.matchWinner), final.matchWinner);
  assert.equal(final.wins[0] + final.wins[1], 9);
  assert.ok(final.coins[0] >= 0);
  assert.equal(final.coins[1], Infinity);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(
    `Longplay browser flow passed: 9 rounds replayed exactly from seed ${LONGPLAY_SEED} ` +
      `(match winner ${final.matchWinner}, coins ${final.coins.join('/')}).`,
  );
} finally {
  await browser.close();
  await recording.save();
}
