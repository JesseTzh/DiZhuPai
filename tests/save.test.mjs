import test from 'node:test';
import assert from 'node:assert/strict';
import { cardDeck } from '../src/assets/cards/deck.js';
import { ITEMS } from '../src/game/items.js';
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
import { chooseMove, sortHand, rankOf } from '../src/game/rules.js';
import {
  loadSave,
  loadSaveSlots,
  SLOT_KEYS,
  parseSave,
  serializeSave,
  SAVE_KEY,
} from '../src/game/save.js';

const options = { tableStyle: 'planks', firstTable: 'marble', palette: 'cobalt' };
const save = (game) => serializeSave(game, options, new Date('2026-10-23T00:00:00Z'));
test('dealing resumes as a playable game, preserving decks and selection', () => {
  const game = createGame();
  deal(game, () => 0.5);
  const loaded = parseSave(save(game));
  assert.equal(loaded.game.phase, 'playing');
  assert.deepEqual(loaded.game.hands, game.hands);
  assert.deepEqual(loaded.game.decks, game.decks);
  assert.equal(loaded.firstTable, 'marble');
  finishDeal(game);
  game.selected = [game.hands[0][0]];
  assert.deepEqual(parseSave(save(game)).game, game);
});
test('round trips every move, pass, shop purchase and all nine rounds', () => {
  const game = createGame();
  let passes = 0;
  while (!game.matchOver) {
    assert.ok(deal(game));
    finishDeal(game);
    while (game.phase === 'playing') {
      const p = game.turn;
      const move = chooseMove(
        game.hands[p],
        game.target?.move,
        game.hands[1 - p].length,
        ruleOptions(game, p),
      );
      if (move) assert.ok(play(game, p, move.cards).move);
      else {
        pass(game, p);
        passes++;
      }
      const loaded = parseSave(save(game));
      assert.deepEqual(loaded.game.hands, game.hands);
      assert.deepEqual(loaded.game.coins, game.coins);
      assert.deepEqual(loaded.game.target, game.target);
      assert.deepEqual(loaded.game.history, game.history);
      assert.equal(
        loaded.game.phase,
        game.phase === 'over' && !game.matchOver ? 'shop' : game.phase,
      );
    }
    if (!game.matchOver) {
      enterShop(game);
      for (const id of game.shopStock) buyItem(game, id);
      assert.deepEqual(parseSave(save(game)).game.items, game.items);
    }
  }
  assert.ok(passes > 0);
  assert.equal(parseSave(save(game)).game.matchOver, true);
});
test('invalid imports are rejected before replacing any state', () => {
  const game = createGame();
  deal(game);
  const valid = JSON.parse(save(game));
  for (const modify of [
    (v) => {
      v.version = 99;
    },
    (v) => {
      v.game.hands[0] = Array.from({ length: 40 }, (_, i) => i % 54);
    },
    (v) => {
      v.game.hands[0][0] = 999;
    },
    (v) => {
      v.game.selected = [999];
    },
    (v) => {
      v.game.decks[0] = [];
    },
    (v) => {
      v.game.items = ['unknown'];
    },
    (v) => {
      v.game.coins[0] = -1;
    },
    (v) => {
      v.game.round = 12;
    },
    (v) => {
      v.game.target = { player: 1, cards: [0], move: {} };
    },
    (v) => {
      v.game.wildCard = 0;
    },
    (v) => {
      v.game.stamp = { card: v.game.hands[0][0], rank: 3 };
    },
    (v) => {
      v.game.shopStock = ['frog', 'frog', 'mask'];
    },
    (v) => {
      v.game.shopStock = ['frog', 'mask', 'balance'];
      v.game.items = ['balance'];
    },
    (v) => {
      v.tableStyle = 'unknown';
    },
    (v) => {
      v.game.matchOver = true;
    },
  ]) {
    const data = structuredClone(valid);
    modify(data);
    assert.throws(() => parseSave(JSON.stringify(data)));
  }
  assert.throws(() => parseSave('{bad json'));
  assert.throws(() => parseSave('a'.repeat(300000)));
  assert.throws(() => parseSave('null'));
});

test('stamp, free pass, mouse take and the featured shelf survive a save round trip', () => {
  const game = createGame();
  game.items = ['stamp', 'mask', 'mouse', 'balance'];
  game.coins = [50, Infinity];
  // a CPU-led round: the mouse steals the opening play
  game.phase = 'over';
  game.round = 1;
  game.wins = [1, 0];
  // round two continues each player's own deck with 36 cards still to come
  game.decks = [
    Array.from({ length: 36 }, (_, i) => i + 18),
    Array.from({ length: 36 }, (_, i) => i + 18),
  ];
  assert.ok(deal(game));
  assert.ok(game.stamp);
  finishDeal(game);
  const loaded = parseSave(save(game));
  assert.deepEqual(loaded.game.stamp, game.stamp);
  assert.deepEqual(loaded.game.hands[0], game.hands[0]);
  assert.equal(loaded.game.freePassUsed, false);
  assert.equal(loaded.game.stealUsed, false);
  play(game, 1, chooseMove(game.hands[1], null, game.hands[0].length).cards);
  assert.ok(steal(game, 0).cards);
  play(game, 0, [game.hands[0].at(-1)]);
  play(game, 1, chooseMove(game.hands[1], game.target?.move, game.hands[0].length).cards);
  assert.equal(pass(game, 0).amount, 0);
  const spent = parseSave(save(game)).game;
  assert.equal(spent.stealUsed, true);
  assert.equal(spent.freePassUsed, true);
  assert.deepEqual(spent.hands[0], game.hands[0]);
  // the shelf round trips on a properly finished round; older saves without a
  // shelf are restocked while loading
  const shopper = createGame();
  assert.ok(deal(shopper));
  finishDeal(shopper);
  // the computer holds the tall cards and leads until its hand runs out
  const all = Array.from({ length: 54 }, (_, i) => i);
  const tallHand = sortHand(
    cardDeck
      .filter((c) => rankOf(c.id) > 10)
      .map((c) => c.id)
      .slice(0, 18),
  );
  shopper.hands = [sortHand(all.filter((id) => !tallHand.includes(id)).slice(0, 18)), tallHand];
  shopper.decks = [
    all.filter((id) => !shopper.hands[0].includes(id)),
    all.filter((id) => !tallHand.includes(id)),
  ];
  let guard = 0;
  while (shopper.phase === 'playing' && guard++ < 120) {
    if (shopper.turn === 0) {
      // the player leads one low single, then passes forever
      if (shopper.target) pass(shopper, 0);
      else play(shopper, 0, [shopper.hands[0].at(-1)]);
    } else {
      const move = chooseMove(shopper.hands[1], shopper.target?.move, shopper.hands[0].length);
      if (move) play(shopper, 1, move.cards);
      else pass(shopper, 1);
    }
  }
  assert.equal(shopper.phase, 'over');
  assert.ok(enterShop(shopper));
  assert.deepEqual(parseSave(save(shopper)).game.shopStock, shopper.shopStock);
  const legacy = JSON.parse(save(shopper));
  delete legacy.game.shopStock;
  delete legacy.game.freePassUsed;
  delete legacy.game.stealUsed;
  const old = parseSave(JSON.stringify(legacy)).game;
  assert.ok(Array.isArray(old.shopStock));
  assert.equal(old.freePassUsed, false);
  assert.equal(old.stealUsed, false);
});

test('saves from before the new items load with derived per-round flags', () => {
  const game = createGame();
  deal(game);
  const legacy = JSON.parse(save(game));
  delete legacy.game.shopStock;
  delete legacy.game.stamp;
  delete legacy.game.freePassUsed;
  delete legacy.game.stealUsed;
  const old = parseSave(JSON.stringify(legacy)).game;
  assert.deepEqual(old.hands, game.hands);
  assert.equal(old.stamp, null);
  assert.equal(old.freePassUsed, false);
  assert.equal(old.stealUsed, false);
  assert.equal(old.shopStock, null);
});
test('missing, corrupted and inaccessible browser storage do not crash loading', () => {
  assert.deepEqual(loadSave({ getItem: () => null }), { save: null, error: null });
  assert.ok(loadSave({ getItem: () => '{' }).error);
  assert.ok(
    loadSave({
      getItem: () => {
        throw new Error('denied');
      },
    }).error,
  );
  const game = createGame();
  deal(game);
  assert.equal(
    loadSave({
      getItem: (key) => {
        assert.equal(key, SAVE_KEY);
        return save(game);
      },
    }).save.game.phase,
    'playing',
  );
});

test('bankruptcy during a coin transfer restores the final balance and match result', () => {
  const game = createGame();
  deal(game);
  finishDeal(game);
  game.coins = [1, Infinity];
  play(game, 0, [game.hands[0].at(-1)]);
  const reply = chooseMove(game.hands[1], game.target.move);
  assert.ok(reply);
  play(game, 1, reply.cards);
  pass(game, 0);
  const restored = parseSave(save(game)).game;
  assert.equal(restored.phase, 'over');
  assert.equal(restored.matchWinner, 1);
  assert.equal(restored.turn, 1);
  assert.deepEqual(restored.coins, [0, Infinity]);
});

test('single save migrates the old active slot once and preserves old backups', () => {
  const game = createGame();
  deal(game);
  finishDeal(game);
  const legacy = save(game);
  const oldKey = `${SAVE_KEY}-slot-3`;
  const data = new Map([
    ['dizhupai-active-slot', '2'],
    [oldKey, legacy],
    [`${SAVE_KEY}-slot-1`, '{broken'],
  ]);
  const storage = {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  const slots = loadSaveSlots(storage);
  assert.equal(slots.length, 1);
  assert.deepEqual(SLOT_KEYS, [SAVE_KEY]);
  assert.deepEqual(slots[0].save.game, game);
  assert.equal(data.get(SAVE_KEY), legacy);
  assert.equal(data.get(oldKey), legacy);
  data.set(oldKey, '{broken');
  assert.deepEqual(loadSaveSlots(storage)[0].save.game, game);
  data.delete(SAVE_KEY);
  data.set(oldKey, legacy);
  assert.equal(loadSaveSlots(storage)[0].save, null, 'deleted saves must not migrate again');
});

test('single save preserves existing progress and falls back from a damaged old active slot', () => {
  const game = createGame();
  deal(game);
  const legacy = save(game);
  const data = new Map([
    [SAVE_KEY, legacy],
    [`${SAVE_KEY}-slot-1`, '{broken'],
  ]);
  const storage = {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
  };
  assert.deepEqual(loadSaveSlots(storage)[0].save.game, parseSave(legacy).game);
  data.delete(SAVE_KEY);
  data.set('dizhupai-active-slot', '0');
  data.set(`${SAVE_KEY}-slot-2`, legacy);
  assert.deepEqual(loadSaveSlots(storage)[0].save.game, parseSave(legacy).game);
});
test('failed migration keeps the original save and reports storage errors', () => {
  const game = createGame();
  deal(game);
  const data = new Map([[`${SAVE_KEY}-slot-1`, save(game)]]);
  const storage = {
    getItem: (key) => data.get(key) || null,
    setItem() {
      throw new Error('quota');
    },
    removeItem: (key) => data.delete(key),
  };
  assert.match(loadSaveSlots(storage)[0].error, /旧存档迁移失败/);
  assert.ok(data.has(`${SAVE_KEY}-slot-1`));
  assert.ok(
    loadSaveSlots({
      getItem() {
        throw new Error('denied');
      },
    }).every((slot) => slot.error),
  );
});

test('小老鼠道具获得的重复牌可选取、出牌并恢复存档', () => {
  const game = createGame();
  game.items = ['mouse'];
  game.coins = [500 - ITEMS.find((item) => item.id === 'mouse').price, Infinity];
  deal(game, () => 0.5);
  finishDeal(game);
  const id = game.hands[0].at(-1);
  assert.ok(play(game, 0, [id]).move);
  const reply = game.hands[1].find(
    (card) => rankOf(card) > rankOf(id) && game.hands[0].includes(card),
  );
  assert.notEqual(reply, undefined);
  assert.ok(play(game, 1, [reply]).move);
  assert.ok(steal(game).cards);
  game.selected = [reply, reply];
  assert.deepEqual(parseSave(save(game)).game.selected, [reply, reply]);
  const invalid = JSON.parse(save(game));
  invalid.game.selected.push(reply);
  assert.throws(() => parseSave(JSON.stringify(invalid)));
  assert.ok(play(game, 0, game.selected).move);
  const restored = parseSave(save(game)).game;
  assert.deepEqual(restored.hands, game.hands);
  assert.deepEqual(restored.target.cards, [reply, reply]);
});

test('无限金币和超过旧上限的余额可往返存档', () => {
  const game = createGame();
  deal(game, () => 0.5);
  finishDeal(game);
  game.coins[0] = 1200;
  play(game, 0, [game.hands[0].at(-1)]);
  pass(game, 1);
  assert.deepEqual(parseSave(save(game)).game.coins, game.coins);
  assert.equal(JSON.parse(save(game)).game.coins[1], 'unlimited');
});

test('旧存档保留玩家余额，并将电脑余额迁移为无限', () => {
  const game = createGame();
  deal(game, () => 0.5);
  const legacy = JSON.parse(save(game));
  legacy.version = 1;
  legacy.game.coins = [95, 105];
  assert.deepEqual(parseSave(JSON.stringify(legacy)).game.coins, [95, Infinity]);
});

test('普通过牌不会消耗未持有的口罩', () => {
  const game = createGame();
  deal(game, () => 0.5);
  finishDeal(game);
  play(game, 0, [game.hands[0].at(-1)]);
  const reply = chooseMove(game.hands[1], game.target.move);
  play(game, 1, reply.cards);
  pass(game, 0);
  assert.equal(parseSave(save(game)).game.freePassUsed, false);
});

test('旧版固定费用历史在迁移后仍可重复保存，并在发牌时清除兼容标记', () => {
  const game = createGame();
  deal(game, () => 0.5);
  finishDeal(game);
  play(game, 0, [game.hands[0].at(-1)]);
  pass(game, 1);
  const legacy = JSON.parse(save(game));
  legacy.version = 1;
  legacy.game.coins = [105, 95];
  legacy.game.last.amount = 5;
  legacy.game.history.at(-1).amount = 5;
  const migrated = parseSave(JSON.stringify(legacy)).game;
  assert.equal(migrated.legacyHistoryLength, 2);
  assert.deepEqual(parseSave(save(migrated)).game, migrated);
  migrated.phase = 'over';
  deal(migrated, () => 0.5);
  assert.equal(migrated.legacyHistoryLength, 0);
});

test('合法牌型的零差值过牌可存档，并且不产生口罩使用记录', () => {
  const game = createGame();
  deal(game, () => 0.5);
  finishDeal(game);
  const lead = cardDeck
    .filter((card) => rankOf(card.id) === 6)
    .slice(0, 2)
    .map((card) => card.id);
  const reply = cardDeck.filter((card) => rankOf(card.id) === 3).map((card) => card.id);
  for (const [player, played] of [lead, reply].entries()) {
    const rest = cardDeck.map((card) => card.id).filter((id) => !played.includes(id));
    game.hands[player] = [...played, ...rest.slice(0, 18 - played.length)];
    game.decks[player] = rest.slice(18 - played.length);
  }
  assert.ok(play(game, 0, lead).move);
  assert.ok(play(game, 1, reply).move);
  assert.equal(pass(game, 0).amount, 0);
  const restored = parseSave(save(game)).game;
  assert.equal(restored.freePassUsed, false);
  assert.deepEqual(restored.coins, [500, Infinity]);
});
