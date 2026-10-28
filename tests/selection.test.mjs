import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, play } from '../src/game/state.js';
import { classify, legalMoves, chooseMove } from '../src/game/rules.js';
import { selectedHandIndices, selectHandIndices } from '../src/game/selection.js';

test('同牌面的两张手牌可独立选取、取消与恢复提示选牌', () => {
  const game = createGame();
  game.hands[0] = [2, 2, 15];
  selectHandIndices(game, [1], true);
  assert.deepEqual(game.selected, [2]);
  assert.deepEqual(selectedHandIndices(game), [1]);
  selectHandIndices(game, [0, 1, 1], true);
  assert.deepEqual(game.selected, [2, 2]);
  selectHandIndices(game, [0], false);
  assert.deepEqual(selectedHandIndices(game), [1]);
  game.selected = [2, 2];
  assert.deepEqual(selectedHandIndices(game), [0, 1]);
  game.selected = [];
  assert.deepEqual(selectedHandIndices(game), []);
});

test('重复牌组成对子、三张和炸弹，提示与实际出牌张数一致', () => {
  for (const [count, type] of [
    [2, 'pair'],
    [3, 'triple'],
    [4, 'bomb'],
  ]) {
    const cards = Array(count).fill(2);
    assert.equal(classify(cards)?.type, type);
    assert.ok(legalMoves(cards).some((move) => move.type === type));
    assert.deepEqual(chooseMove(cards, null).cards, cards);
  }
  const game = createGame();
  game.phase = 'playing';
  game.hands = [[2, 2, 2, 15], [3]];
  const before = JSON.stringify(game);
  assert.ok(play(game, 0, [2, 2, 2, 2]).error);
  assert.equal(JSON.stringify(game), before);
  assert.equal(play(game, 0, [2, 2]).move.type, 'pair');
  assert.deepEqual(game.hands[0], [2, 15]);
  assert.deepEqual(game.target.cards, [2, 2]);
});
