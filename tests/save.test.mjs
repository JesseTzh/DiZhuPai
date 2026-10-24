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
      for (const id of ['frog', 'hand', 'dragon']) buyItem(game, id);
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
      v.game.hands[0][1] = v.game.hands[0][0];
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
  game.coins = [195, 5];
  play(game, 0, [game.hands[0][0]]);
  pass(game, 1);
  const restored = parseSave(save(game)).game;
  assert.equal(restored.phase, 'over');
  assert.equal(restored.matchWinner, 0);
  assert.equal(restored.turn, 0);
  assert.deepEqual(restored.coins, [200, 0]);
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
