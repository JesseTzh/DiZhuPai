import test from 'node:test';
import assert from 'node:assert/strict';
import { cardDeck } from '../src/assets/cards/deck.js';
import { classify, rankOf, legalMoves, beats, chooseMove } from '../src/game/rules.js';
import {
  createGame,
  deal,
  finishDeal,
  play,
  enterShop,
  buyItem,
  ruleOptions,
} from '../src/game/state.js';
const cards = (...ranks) => {
  const used = new Set();
  return ranks.map((rank) => {
    const id = cardDeck.find((c) => rankOf(c.id) === rank && !used.has(c.id)).id;
    used.add(id);
    return id;
  });
};
test('shop purchases are atomic, unique, affordable and scoped to a match', () => {
  const g = createGame();
  assert.ok(buyItem(g, 'frog').error);
  g.phase = 'over';
  assert.ok(enterShop(g));
  assert.ok(buyItem(g, 'missing').error);
  for (const id of ['frog', 'hand', 'dragon']) assert.equal(buyItem(g, id).item.id, id);
  assert.equal(g.coins[0], 25);
  assert.ok(buyItem(g, 'frog').error);
  assert.equal(g.coins[0], 25);
  assert.deepEqual(ruleOptions(g, 1), {});
  assert.ok(deal(g, () => 0.5));
  assert.ok(g.hands[0].includes(g.wildCard));
  assert.equal(g.items.length, 3);
  g.phase = 'over';
  const oldWild = g.wildCard;
  assert.ok(enterShop(g));
  assert.ok(deal(g, () => 0.9));
  assert.ok(g.hands[0].includes(g.wildCard));
  assert.ok(!g.hands[0].includes(oldWild));
  assert.deepEqual(createGame().items, []);
  const poor = createGame();
  poor.phase = 'shop';
  poor.coins[0] = 19;
  assert.ok(buyItem(poor, 'frog').error);
  assert.deepEqual(poor.items, []);
  assert.equal(poor.coins[0], 19);
  poor.phase = 'over';
  poor.matchOver = true;
  assert.equal(enterShop(poor), false);
});

test('buying an item that empties the player wallet ends the match immediately', () => {
  const g = createGame();
  g.phase = 'shop';
  g.coins[0] = 20;
  const response = buyItem(g, 'frog');
  assert.equal(response.item.id, 'frog');
  assert.deepEqual(g.coins, [0, 100]);
  assert.equal(g.phase, 'over');
  assert.equal(g.matchOver, true);
  assert.equal(g.matchWinner, 1);
  assert.equal(g.winner, 1);
  assert.equal(g.wins[1], 1);
});
test('three with two different singles shares the triplePair comparison and is player-only', () => {
  const hand = cards(7, 7, 7, 3, 5);
  assert.equal(classify(hand), null);
  const move = classify(hand, { looseTriple: true });
  assert.equal(move.type, 'triplePair');
  assert.ok(beats(move, classify(cards(6, 6, 6, 4, 4))));
  assert.ok(legalMoves(hand, null, { looseTriple: true }).some((m) => m.cards.length === 5));
  const g = createGame();
  g.items = ['hand'];
  g.phase = 'playing';
  g.hands = [hand, hand];
  assert.ok(play(g, 0, hand).move);
  g.phase = 'playing';
  g.turn = 1;
  assert.ok(play(g, 1, hand).error);
});
test('short straights still exclude two and jokers and require equal response length', () => {
  const hand = cards(10, 11, 12, 13),
    options = { shortStraight: true };
  assert.equal(classify(hand), null);
  assert.equal(classify(hand, options).type, 'straight');
  assert.equal(classify(cards(12, 13, 14, 15), options), null);
  assert.equal(classify(cards(13, 14, 16, 17), options), null);
  assert.ok(!beats(classify(hand, options), classify(cards(3, 4, 5, 6, 7))));
  assert.equal(chooseMove(hand, null, 18, options).cards.length, 4);
});
test('one physical wild card fills shapes, responds to target and never becomes a joker', () => {
  const hand = cards(3, 5, 6, 7),
    options = { wildCard: cards(3)[0], shortStraight: true };
  assert.equal(classify(hand, options).type, 'straight');
  assert.equal(classify(hand, options).wildRank, 4);
  const target = classify(cards(10, 10));
  const pair = cards(3, 11);
  assert.equal(classify(pair, options, target).main, 11);
  assert.ok(legalMoves(pair, target, options).some((m) => m.type === 'pair'));
  assert.equal(classify(cards(3, 17), options), null);
  assert.equal(classify([hand[0], hand[0]], options), null);
  assert.equal(classify(cards(3, 4, 5, 6, 15), options), null);
  const g = createGame();
  g.items = ['frog', 'dragon'];
  g.phase = 'playing';
  g.hands = [hand, []];
  g.wildCard = hand[0];
  assert.ok(play(g, 0, hand).move);
});
