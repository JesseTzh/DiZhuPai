import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  deal,
  finishDeal,
  play,
  pass,
  enterShop,
  buyItem,
  ruleOptions,
} from '../src/game/state.js';
import { chooseMove } from '../src/game/rules.js';
import { deriveRng, randomSeedString, gameRandom } from '../src/game/random.js';
import { parseSave, serializeSave } from '../src/game/save.js';

const options = { tableStyle: 'planks', firstTable: 'marble', palette: 'cobalt' };

// 用同一套确定性的电脑决策跑完整一场：双方出牌都走 chooseMove，逛店按给定清单购买，
// 记录每一局的发牌、万能牌/印章、货架与最终结算，供两次重放逐项比对。
function playMatch(seed, purchases = []) {
  const game = createGame(seed);
  const trace = [];
  while (!game.matchOver) {
    assert.ok(deal(game));
    trace.push({
      hands: structuredClone(game.hands),
      decks: structuredClone(game.decks),
      wildCard: game.wildCard,
      stamp: game.stamp,
    });
    finishDeal(game);
    while (game.phase === 'playing') {
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
    if (!game.matchOver) {
      enterShop(game);
      trace.push({ stock: [...game.shopStock] });
      for (const id of game.shopStock) if (purchases.includes(id)) buyItem(game, id);
    }
  }
  trace.push({ wins: [...game.wins], coins: [...game.coins], matchWinner: game.matchWinner });
  return trace;
}

test('the same seed replays an identical match: deals, wilds, stamps, stock and outcome', () => {
  assert.deepEqual(playMatch('dizhupai-replay'), playMatch('dizhupai-replay'));
});

test('the replay stays identical with item purchases and their rule effects active', () => {
  const purchases = ['frog', 'hand', 'stamp', 'mask', 'mouse'];
  const first = playMatch('dizhupai-replay', purchases),
    second = playMatch('dizhupai-replay', purchases);
  assert.deepEqual(first, second);
  // 赖子与印章确实生效过，随机流的消耗路径覆盖了道具分支。
  assert.ok(first.some((step) => step.wildCard !== null));
  assert.ok(first.some((step) => step.stamp !== null));
});

test('a different seed deals a different match', () => {
  const first = playMatch('dizhupai-alpha'),
    second = playMatch('dizhupai-beta');
  assert.notDeepEqual(first[0].hands, second[0].hands);
  assert.notDeepEqual(first, second);
});

test('an explicit random source still overrides the seed', () => {
  const seeded = createGame('seed-one'),
    other = createGame('seed-two');
  deal(seeded, () => 0.5);
  deal(other, () => 0.5);
  assert.deepEqual(seeded.hands, other.hands);
});

test('deriveRng streams are deterministic, labelled and bounded', () => {
  const sample = (rng) => Array.from({ length: 8 }, () => rng());
  const deal = sample(deriveRng('seed', 'deal', 1));
  assert.deepEqual(deal, sample(deriveRng('seed', 'deal', 1)));
  assert.notDeepEqual(deal, sample(deriveRng('seed', 'deal', 2)));
  assert.notDeepEqual(deal, sample(deriveRng('seed', 'shop', 1)));
  assert.ok(deal.every((value) => value >= 0 && value < 1));
});

test('gameRandom falls back to Math.random only without a seed', () => {
  assert.equal(gameRandom(createGame(), 'deal'), Math.random);
  const game = createGame('fixed');
  assert.deepEqual(
    Array.from({ length: 5 }, gameRandom(game, 'deal')),
    Array.from({ length: 5 }, deriveRng('fixed', 'deal', 0)),
  );
});

test('randomSeedString mints short shareable seeds', () => {
  const first = randomSeedString(),
    second = randomSeedString();
  assert.match(first, /^[0-9a-z]{8}$/);
  assert.notEqual(first, second);
});

test('saves carry the seed so a restored match keeps its random stream', () => {
  const game = createGame('repro-1');
  deal(game);
  const text = serializeSave(game, options, new Date('2026-10-23T00:00:00Z'));
  assert.equal(parseSave(text).game.seed, 'repro-1');

  // 旧存档没有 seed 字段：照常读取，退回真随机。
  const legacy = JSON.parse(text);
  delete legacy.game.seed;
  const restored = parseSave(JSON.stringify(legacy));
  assert.equal(restored.game.seed, null);

  // 存档读回后继续走完接下来的局，随机序列与原地续玩一致。
  const replay = createGame('repro-2');
  deal(replay);
  const continued = parseSave(
    serializeSave(replay, options, new Date('2026-10-23T00:00:00Z')),
  ).game;
  for (const g of [replay, continued]) {
    finishDeal(g);
    g.phase = 'over';
  }
  deal(replay);
  deal(continued);
  assert.deepEqual(continued.hands, replay.hands);
});

test('save validation rejects malformed seeds', () => {
  const game = createGame('repro-1');
  deal(game);
  const base = JSON.parse(serializeSave(game, options, new Date('2026-10-23T00:00:00Z')));
  for (const seed of [123, '', '   ', 'x'.repeat(33), ['array']])
    assert.throws(() => {
      base.game.seed = seed;
      parseSave(JSON.stringify(base));
    }, /存档/);
});
