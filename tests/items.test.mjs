import test from 'node:test';
import assert from 'node:assert/strict';
import { cardDeck } from '../src/assets/cards/deck.js';
import { classify, rankOf, legalMoves, beats, chooseMove } from '../src/game/rules.js';
import {
  createGame,
  deal,
  finishDeal,
  play,
  pass,
  steal,
  enterShop,
  buyItem,
  ruleOptions,
} from '../src/game/state.js';
import { ITEMS } from '../src/game/items.js';
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
  const stock = [...g.shopStock];
  assert.equal(stock.length, 3);
  let spent = 0;
  for (const id of stock) {
    const response = buyItem(g, id);
    assert.equal(response.item.id, id);
    spent += response.item.price;
  }
  assert.equal(g.coins[0], 500 - spent);
  assert.ok(buyItem(g, stock[0]).error);
  assert.equal(g.coins[0], 500 - spent);
  assert.deepEqual(ruleOptions(g, 1), {});
  assert.ok(deal(g, () => 0.5));
  assert.ok(g.hands[0].includes(g.wildCard) === g.items.includes('frog'));
  assert.equal(g.items.length, 3);
  g.phase = 'over';
  const oldWild = g.wildCard;
  assert.ok(enterShop(g));
  assert.ok(g.shopStock.length <= 3);
  assert.ok(g.shopStock.every((id) => !g.items.includes(id)));
  assert.ok(deal(g, () => 0.9));
  if (g.wildCard != null) {
    assert.ok(g.hands[0].includes(g.wildCard));
    assert.ok(!g.hands[0].includes(oldWild));
  }
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

test('every visit restocks three random toys from the ones still missing', () => {
  const g = createGame();
  g.phase = 'over';
  assert.ok(enterShop(g, () => 0));
  assert.deepEqual(g.shopStock, ['frog', 'hand', 'dragon']);
  // a seeded roll picks from the tail instead
  g.items = ['frog', 'hand', 'dragon'];
  g.phase = 'over';
  assert.ok(enterShop(g, () => 0.99));
  assert.deepEqual(g.shopStock, ['mouse', 'mask', 'balance']);
  // fewer than three remain: the shelf holds what is left
  g.items = ['frog', 'hand', 'dragon', 'balance', 'mask'];
  g.phase = 'over';
  assert.ok(enterShop(g, () => 0));
  assert.deepEqual(g.shopStock, ['stamp', 'mouse']);
  // buying removes the toy from the shelf for the rest of the visit
  g.phase = 'shop';
  assert.ok(buyItem(g, 'stamp').item);
  assert.deepEqual(g.shopStock, ['mouse']);
  assert.ok(buyItem(g, 'stamp').error);
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
  assert.equal(classify([hand[0], hand[0]], options)?.type, 'pair');
  assert.equal(classify(cards(3, 4, 5, 6, 15), options), null);
  const g = createGame();
  g.items = ['frog', 'dragon'];
  g.phase = 'playing';
  g.hands = [hand, []];
  g.wildCard = hand[0];
  assert.ok(play(g, 0, hand).move);
});

test('the stamp lifts one card below the queen and the hand re-sorts around it', () => {
  const g = createGame();
  g.items = ['stamp'];
  assert.ok(deal(g, () => 0));
  assert.ok(g.stamp);
  assert.ok(rankOf(g.stamp.card) < 12);
  assert.equal(g.stamp.rank, rankOf(g.stamp.card) + 1);
  assert.ok(g.hands[0].includes(g.stamp.card));
  // the hand order honours the upgraded rank
  assert.deepEqual(
    g.hands[0],
    [...g.hands[0]].sort((a, b) => {
      const rank = (id) => (id === g.stamp.card ? g.stamp.rank : rankOf(id));
      return rank(b) - rank(a) || a - b;
    }),
  );
  // the stamped seven plays as an eight; without the item the same pair is invalid
  const seven = cards(7)[0],
    eight = cards(8)[0];
  const stamped = createGame();
  stamped.items = ['stamp'];
  stamped.phase = 'playing';
  stamped.stamp = { card: seven, rank: 8 };
  stamped.hands = [[seven, eight], []];
  assert.ok(play(stamped, 0, [seven, eight]).move);
  const plain = createGame();
  plain.phase = 'playing';
  plain.hands = [[seven, eight], []];
  assert.ok(play(plain, 0, [seven, eight]).error);
  // a hand without any card below the queen gets no stamp
  const high = createGame();
  high.items = ['stamp'];
  high.phase = 'over';
  high.round = 1;
  high.wins = [1, 0];
  high.decks = [
    cardDeck.filter((c) => rankOf(c.id) >= 12).map((c) => c.id),
    cardDeck.filter((c) => rankOf(c.id) < 12).map((c) => c.id),
  ];
  high.hands = [[], []];
  assert.ok(deal(high, () => 0.5));
  assert.equal(high.stamp, null);
});

test('buying an item that empties the player wallet ends the match immediately', () => {
  const g = createGame();
  g.phase = 'shop';
  g.coins[0] = 20;
  const response = buyItem(g, 'frog');
  assert.equal(response.item.id, 'frog');
  assert.deepEqual(g.coins, [0, Infinity]);
  assert.equal(g.phase, 'over');
  assert.equal(g.matchOver, true);
  assert.equal(g.matchWinner, 1);
  assert.equal(g.winner, 1);
  assert.equal(g.wins[1], 1);
});

test('the balance scale beats equal responses for the holder only', () => {
  const eights = cards(8, 8),
    options = { equalBeat: true };
  const target = classify(eights);
  assert.ok(beats(classify(eights), target, options));
  assert.ok(!beats(classify(eights), target));
  assert.ok(legalMoves(eights, target, options).length > 0);
  assert.equal(legalMoves(eights, target, {}).length, 0);
  const g = createGame();
  g.items = ['balance'];
  g.phase = 'playing';
  g.turn = 1;
  g.hands = [
    [...eights, ...cards(3, 4)],
    [...cards(8, 8), ...cards(5, 6)],
  ];
  assert.ok(play(g, 1, g.hands[1].slice(0, 2)).move);
  assert.ok(play(g, 0, g.hands[0].slice(0, 2)).move);
  assert.equal(g.target.player, 0);
  assert.deepEqual(ruleOptions(g, 1), {});
});

test('the mask makes the first pass of each round free and charges the rest', () => {
  const g = createGame();
  g.items = ['mask'];
  g.phase = 'playing';
  g.turn = 1;
  g.hands = [cards(3, 4), [...cards(5, 6), ...cards(7, 8)]];
  play(g, 1, g.hands[1].slice(0, 1));
  assert.equal(pass(g, 0).amount, 0);
  assert.deepEqual(g.coins, [500, Infinity]);
  assert.equal(g.freePassUsed, true);
  play(g, 1, g.hands[1].slice(0, 1));
  assert.equal(pass(g, 0).amount, 6);
  assert.deepEqual(g.coins, [494, Infinity]);
  // a new round restores the cover
  g.phase = 'over';
  assert.ok(deal(g));
  assert.equal(g.freePassUsed, false);
});

test('the mouse takes the opponent play once per round and the same player leads', () => {
  const g = createGame();
  g.items = ['mouse'];
  g.phase = 'playing';
  g.turn = 1;
  g.hands = [cards(3, 4, 5), [...cards(8, 8, 8), ...cards(9, 10)]];
  const played = g.hands[1].slice(0, 3);
  assert.ok(play(g, 1, played).move);
  assert.ok(steal(g, 0).cards);
  assert.deepEqual(g.history.at(-1), { type: 'steal', player: 0, cards: played });
  assert.equal(g.target, null);
  assert.equal(g.turn, 0);
  assert.equal(g.stealUsed, true);
  assert.ok(played.every((id) => g.hands[0].includes(id)));
  assert.equal(g.hands[0].length, 6);
  // once per round: the next CPU play stays where it is
  g.turn = 1;
  play(g, 1, g.hands[1].slice(0, 1));
  assert.ok(steal(g, 0).error);
  // stealing needs an opponent play on the table
  const fresh = createGame();
  fresh.items = ['mouse'];
  fresh.phase = 'playing';
  fresh.hands = [cards(3), cards(4)];
  assert.ok(steal(fresh, 0).error);
  g.phase = 'over';
  assert.ok(deal(g));
  assert.equal(g.stealUsed, false);
});

test('a stolen twin of a held card coexists and each play consumes one copy', () => {
  const eight = cards(8)[0],
    nine = cards(9)[0];
  const g = createGame();
  g.items = ['mouse'];
  g.phase = 'playing';
  g.turn = 1;
  // independent decks: both players hold their own copy of the same eight
  g.hands = [
    [eight, nine],
    [eight, ...cards(3, 4)],
  ];
  assert.ok(play(g, 1, [eight]).move);
  assert.ok(steal(g, 0).cards);
  assert.equal(g.hands[0].filter((id) => id === eight).length, 2);
  // playing the eight consumes one copy and leaves the twin behind
  assert.ok(play(g, 0, [eight]).move);
  assert.equal(g.hands[0].filter((id) => id === eight).length, 1);
  assert.ok(g.hands[0].includes(nine));
});

test('every registered item carries a rule the shop and topbar can render', () => {
  for (const item of ITEMS) {
    assert.ok(item.id && item.name && item.price > 0 && item.description);
    assert.ok(
      [
        'wildCard',
        'looseTriple',
        'shortStraight',
        'stampUp',
        'equalBeat',
        'freePass',
        'stealPlay',
      ].includes(item.rule),
    );
  }
});
