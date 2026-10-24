import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, deal } from '../src/game/state.js';
import { makeVisual } from '../src/game/scene.js';
import { sceneFrame } from '../src/game/scene-frame.js';
import { ModelCanvas } from '../src/game/model-canvas.js';
import { cardThickness } from '../src/cards/constants.js';
const state = () => ({ game: createGame(), visual: makeVisual(), pal: 'cobalt', cardNames: [] });
test('home draws only the shared table until entry props land', () => {
  const st = state();
  st.visual.home = true;
  assert.deepEqual(sceneFrame(st), { cards: [], bags: [], coins: [], labels: [] });
  st.visual.entry = { time: 0, pitch: 90 };
  assert.equal(sceneFrame(st).cards.length, 0);
  st.visual.entry.time = 1.3;
  assert.equal(sceneFrame(st).cards.filter((card) => card.options.deckCount).length, 2);
});
test('decks retain solid count-based thickness until exhausted', () => {
  const st = state();
  const decks = () => sceneFrame(st).cards.filter((card) => card.options.deckCount);
  assert.deepEqual(
    decks().map((card) => card.options.deckCount),
    [54, 54],
  );
  deal(st.game);
  assert.deepEqual(
    decks().map((card) => card.options.deckCount),
    [36, 36],
  );
  const thick = decks()[0].pose.thickness;
  st.game.decks[0].splice(0, 18);
  assert.equal(decks()[0].pose.thickness, thick / 2);
  for (const { pose, options } of decks()) {
    assert.equal(pose.thickness, options.deckCount * cardThickness);
    const g = ModelCanvas.prototype.cardGeometry(pose);
    const zs = [...g.A, ...g.B].map((point) => point[2]);
    assert.ok(Math.abs(Math.min(...zs) - 1) < 1e-9);
    assert.ok(Math.abs(Math.max(...zs) - 1 - pose.thickness * pose.scale) < 1e-9);
  }
  st.game.decks = [[], []];
  assert.equal(decks().length, 0);
});
