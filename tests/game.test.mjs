import test from 'node:test';
import assert from 'node:assert/strict';
import { cardDeck } from '../src/assets/cards/deck.js';
import { rankOf, classify, beats, legalMoves, chooseMove } from '../src/game/rules.js';
import { createGame, deal, finishDeal, play, pass } from '../src/game/state.js';
import { passCost, cardPoints } from '../src/game/economy.js';
const cards = (...ranks) => {
  const used = new Set();
  return ranks.map((rank) => {
    const c = cardDeck.find((c) => rankOf(c.id) === rank && !used.has(c.id));
    assert.ok(c, `rank ${rank}`);
    used.add(c.id);
    return c.id;
  });
};
const type = (ranks, name) => assert.equal(classify(cards(...ranks))?.type, name);
test('all supported Dou Dizhu shapes, ace limits, wings and invalid selections', () => {
  for (const [r, n] of [
    [[3], 'single'],
    [[15, 15], 'pair'],
    [[6, 6, 6], 'triple'],
    [[9, 9, 9, 3], 'tripleSingle'],
    [[9, 9, 9, 3, 3], 'triplePair'],
    [[10, 11, 12, 13, 14], 'straight'],
    [[3, 3, 4, 4, 5, 5], 'pairs'],
    [[3, 3, 3, 4, 4, 4], 'plane'],
    [[3, 3, 3, 4, 4, 4, 5, 5], 'planeSingle'],
    [[3, 3, 3, 4, 4, 4, 5, 5, 6, 6], 'planePair'],
    [[8, 8, 8, 8, 3, 3], 'fourSingle'],
    [[8, 8, 8, 8, 3, 3, 4, 4], 'fourPair'],
    [[8, 8, 8, 8], 'bomb'],
    [[16, 17], 'rocket'],
  ])
    type(r, n);
  for (const ranks of [
    [11, 12, 13, 14, 15],
    [3, 3, 4, 4],
    [3, 4, 6, 7, 8],
    [3, 3, 3, 4, 4, 4, 16, 17],
    [3, 3, 3, 4, 4, 4, 5, 5, 5, 5],
  ])
    assert.equal(classify(cards(...ranks)), null);
  assert.equal(classify([]), null);
  assert.equal(classify([1, 1])?.type, 'pair');
  assert.equal(classify([-1]), null);
});
test('comparison enforces shapes and lengths; bombs and rocket override ordinary cards', () => {
  const move = (...r) => classify(cards(...r));
  assert.ok(beats(move(4), move(3)));
  assert.ok(!beats(move(4, 4), move(3)));
  assert.ok(!beats(move(3, 4, 5, 6, 7, 8), move(3, 4, 5, 6, 7)));
  assert.ok(beats(move(3, 3, 3, 3), move(15, 15)));
  assert.ok(beats(move(16, 17), move(15, 15, 15, 15)));
  assert.ok(!beats(move(16, 17), move(16, 17)));
  assert.ok(!beats(move(15), move(16, 17)));
});
test('independent decks deal 18 unique cards each and retain 36 cards each', () => {
  const g = createGame();
  assert.deepEqual(g.coins, [500, Infinity]);
  assert.ok(deal(g, () => 0.5));
  for (let p = 0; p < 2; p++) {
    assert.equal(new Set(g.hands[p]).size, 18);
    assert.equal(g.decks[p].length, 36);
    assert.equal(new Set([...g.hands[p], ...g.decks[p]]).size, 54);
  }
  assert.deepEqual(g.hands[0], g.hands[1]);
  assert.ok(!deal(g));
  finishDeal(g);
  assert.equal(g.turn, 0);
});
test('illegal actions do not mutate state; pass pays the point difference and restores free lead', () => {
  const g = createGame();
  deal(g);
  finishDeal(g);
  const before = JSON.stringify(g);
  assert.ok(pass(g, 0).error);
  assert.ok(play(g, 1, [g.hands[1][0]]).error);
  assert.ok(play(g, 0, []).error);
  assert.equal(JSON.stringify(g), before);
  const id = g.hands[0][0];
  assert.ok(play(g, 0, [id]).move);
  assert.equal(g.turn, 1);
  assert.equal(g.hands[0].length, 17);
  const cost = cardPoints(id);
  assert.equal(pass(g, 1).amount, cost);
  assert.deepEqual(g.coins, [500 + cost, Infinity]);
  assert.equal(g.turn, 0);
  assert.equal(g.target, null);
  assert.ok(pass(g, 0).error);
});
test('three stages each consume independent full decks across three rounds', () => {
  const game = createGame();
  let shuffleCalls = 0;
  const random = () => {
    shuffleCalls++;
    return 0.5;
  };
  let dealt = [[], []];
  for (let round = 1; round <= 9; round++) {
    if ((round - 1) % 3 === 0) dealt = [[], []];
    const remaining = game.decks.map((deck) => [...deck]);
    assert.ok(deal(game, random));
    assert.equal(game.stage, Math.ceil(round / 3));
    assert.equal(game.substage, ((round - 1) % 3) + 1);
    assert.equal(shuffleCalls, Math.ceil(round / 3) * 106);
    for (let player = 0; player < 2; player++) {
      assert.equal(game.hands[player].length, 18);
      assert.equal(game.decks[player].length, (3 - game.substage) * 18);
      if (game.substage > 1)
        assert.deepEqual(new Set(game.hands[player]), new Set(remaining[player].slice(0, 18)));
      dealt[player].push(...game.hands[player]);
      assert.equal(new Set(dealt[player]).size, game.substage * 18);
      if (game.substage === 3) assert.equal(new Set(dealt[player]).size, 54);
    }
    finishDeal(game);
    assert.equal(game.turn, (round - 1) % 2);
    game.hands[game.turn] = cards(3);
    assert.ok(play(game, game.turn, cards(3)).move);
    assert.equal(game.matchOver, round === 9);
  }
  assert.deepEqual(game.wins, [5, 4]);
  assert.equal(game.matchWinner, 0);
  const completed = JSON.stringify(game);
  assert.equal(deal(game, random), false);
  assert.equal(JSON.stringify(game), completed);
  const fresh = createGame();
  assert.equal(fresh.round, 0);
  assert.equal(fresh.stage, 1);
  assert.equal(fresh.substage, 1);
  assert.equal(fresh.matchOver, false);
});
test('final match winner follows total wins even if the other player wins the last round', () => {
  const game = createGame();
  game.round = 8;
  game.phase = 'over';
  game.decks = [cards(3), cards(4)];
  game.wins = [2, 6];
  deal(game);
  finishDeal(game);
  play(game, 0, game.hands[0]);
  assert.equal(game.winner, 0);
  assert.equal(game.matchWinner, 1);
  assert.equal(game.matchOver, true);
});
test('empty hand wins; next deal retains balances and alternates lead; bankruptcy cannot redeal', () => {
  const g = createGame();
  deal(g);
  finishDeal(g);
  g.hands[0] = cards(3);
  g.coins = [511, Infinity];
  play(g, 0, g.hands[0]);
  assert.equal(g.winner, 0);
  assert.equal(g.phase, 'over');
  deal(g);
  finishDeal(g);
  assert.equal(g.turn, 1);
  assert.deepEqual(g.coins, [511, Infinity]);
  g.target = { player: 0, move: classify(cards(17)), cards: cards(17) };
  g.turn = 0;
  g.target.player = 1;
  g.coins = [2, Infinity];
  assert.equal(pass(g, 0).amount, 2);
  assert.deepEqual(g.coins, [0, Infinity]);
  assert.equal(g.matchWinner, 1);
  assert.ok(!deal(g));
});
test('generated choices cover every legal shape in representative hands', () => {
  for (const hand of [
    cards(3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8, 16, 17),
    cards(3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 6, 6, 7, 8),
  ]) {
    const generated = new Set(legalMoves(hand).map((m) => `${m.type}/${m.length}/${m.main}`));
    for (let bits = 1; bits < 2 ** hand.length; bits++) {
      const subset = hand.filter((_, i) => bits & (1 << i)),
        m = classify(subset);
      if (m) assert.ok(generated.has(`${m.type}/${m.length}/${m.main}`), subset.join());
    }
  }
});
test('100 complete computer-vs-computer games terminate with legal moves and unlimited computer coins', () => {
  let seed = 99;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let round = 0; round < 100; round++) {
    const g = createGame();
    deal(g, random);
    finishDeal(g);
    let turns = 0;
    while (g.phase === 'playing') {
      assert.ok(++turns < 150);
      const p = g.turn,
        m = chooseMove(g.hands[p], g.target?.move, g.hands[1 - p].length);
      const res = m ? play(g, p, m.cards) : pass(g, p);
      assert.ok(!res.error, res.error);
      assert.ok(Number.isSafeInteger(g.coins[0]) && g.coins[0] >= 0);
      assert.equal(g.coins[1], Infinity);
    }
    assert.ok(g.winner === 0 || g.winner === 1);
    assert.ok(g.matchWinner != null || g.hands[g.winner].length === 0);
  }
});

test('过牌按本轮双方最后出牌总点数的绝对差扣费', () => {
  const g = createGame();
  g.phase = 'playing';
  g.hands = [cards(7, 7, 12), cards(10, 10, 13)];
  play(g, 0, cards(7, 7));
  play(g, 1, cards(10, 10));
  assert.equal(passCost(g), 6);
  assert.equal(pass(g, 0).amount, 6);
  assert.deepEqual(g.coins, [494, Infinity]);
  play(g, 1, cards(13));
  assert.equal(passCost(g), 13);
});

test('点数覆盖普通牌、A、2和双王，出牌大小保持原规则', () => {
  for (let rank = 3; rank <= 17; rank++)
    assert.equal(cardPoints(cards(rank)[0]), { 16: 18, 17: 20 }[rank] ?? rank);
  const g = createGame();
  g.phase = 'playing';
  g.hands = [cards(16, 3), cards(17, 4)];
  play(g, 0, cards(16));
  play(g, 1, cards(17));
  assert.equal(pass(g, 0).amount, 2);
});

test('只取最近一次出牌，跨牌型计算绝对差，零差值不会扣费', () => {
  const g = createGame();
  g.phase = 'playing';
  g.hands = [cards(14, 14, 15, 15, 3), cards(3, 3, 3, 3, 4)];
  play(g, 0, cards(14, 14));
  play(g, 1, cards(3, 3, 3, 3));
  assert.equal(passCost(g), 16);
  assert.equal(pass(g, 0).amount, 16);
  g.turn = 0;
  g.target = { player: 1, cards: cards(10, 10) };
  g.history = [
    { type: 'play', player: 0, cards: cards(3) },
    { type: 'play', player: 1, cards: cards(4) },
    { type: 'play', player: 0, cards: cards(7, 13) },
  ];
  assert.equal(passCost(g), 0);
  assert.equal(pass(g, 0).amount, 0);
  assert.equal(g.freePassUsed, false);
});
