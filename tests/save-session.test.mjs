import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveSession } from '../src/app/save-session.js';
import { createGame, deal, finishDeal } from '../src/game/state.js';
import { parseSave, SLOT_KEYS, SAVE_KEY, serializeSave } from '../src/game/save.js';

const options = { tableStyle: 'planks', firstTable: 'planks', palette: 'cobalt' };
function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
function game() {
  const value = createGame();
  deal(value);
  finishDeal(value);
  return value;
}

test('save session uses one save, restores it, and rejects other slots', () => {
  const store = storage();
  const first = game();
  store.setItem(SAVE_KEY, serializeSave(first, options));
  const session = createSaveSession(store);
  assert.deepEqual(session.initialSave.game, first);
  assert.equal(session.readSlots().length, 1);
  assert.equal(session.activeSlot, 0);
  assert.throws(() => session.select(1), /仅支持一个存档/);
  assert.throws(() => session.import(1, session.initialSave), /仅支持一个存档/);
  assert.throws(() => session.delete(1), /仅支持一个存档/);
  const second = game();
  session.save(second, options);
  assert.deepEqual(createSaveSession(store).initialSave.game, second);
  assert.deepEqual(parseSave(session.export(0, second, options)).game, second);
  session.delete(0);
  assert.equal(session.activeSlot, null);
  session.save(second, options);
  assert.equal(store.getItem(SAVE_KEY), null);
  assert.equal(createSaveSession(store).initialSave, null);
});

test('failed writes are retried and failed imports leave the active slot intact', () => {
  const store = storage();
  const session = createSaveSession(store);
  const value = game();
  session.select(0);
  const setItem = store.setItem;
  store.setItem = () => {
    throw new Error('quota');
  };
  session.save(value, options);
  assert.match(session.status, /本地保存失败/);
  assert.throws(() => session.import(0, parseSave(serializeSave(value, options))), /quota/);
  assert.equal(session.activeSlot, 0);
  store.setItem = setItem;
  session.save(value, options);
  assert.deepEqual(parseSave(store.getItem(SLOT_KEYS[0])).game, value);
  assert.match(session.status, /已自动保存/);
  store.getItem = () => {
    throw new Error('blocked');
  };
  assert.doesNotThrow(() => createSaveSession(store));
});
