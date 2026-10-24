import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, deal, finishDeal, play } from '../src/game/state.js';
import { makeVisual } from '../src/game/scene.js';
import { sceneFrame, handPose } from '../src/game/scene-frame.js';
import { dealDuration, DEAL_DURATION, WILD_REVEAL_DURATION } from '../src/game/wild-reveal.js';

const state = () => ({ game: createGame(), visual: makeVisual(), pal: 'cobalt', cardNames: [] });
test('only the randomly chosen card lifts and changes model during the round opening', () => {
  const st = state();
  st.game.items = ['frog'];
  deal(st.game, () => 0.4);
  const id = st.game.wildCard;
  const rest = handPose(0, st.game.hands[0].indexOf(id), 18);
  const chosen = () => sceneFrame(st).cards.find((card) => card.options.act === `select-${id}`);
  assert.equal(dealDuration(st.game), DEAL_DURATION + WILD_REVEAL_DURATION);
  st.visual.dealTime = DEAL_DURATION;
  for (const key of Object.keys(rest)) assert.ok(Math.abs(chosen().pose[key] - rest[key]) < 1e-8);
  assert.equal(chosen().options.wild, false);
  st.visual.dealTime = DEAL_DURATION + 0.4;
  assert.ok(chosen().pose.z > rest.z + 50);
  assert.ok(chosen().pose.flip > 0 && chosen().pose.flip < Math.PI);
  assert.equal(chosen().options.wild, false);
  assert.equal(chosen().options.dynamic, true);
  assert.equal(sceneFrame(st).cards.filter((card) => card.options.revealing).length, 1);
  st.visual.dealTime = DEAL_DURATION + 0.75;
  assert.equal(chosen().options.wild, true);
  assert.ok(chosen().pose.flip > Math.PI);
  st.visual.dealTime = dealDuration(st.game);
  assert.ok(Math.abs(chosen().pose.z - rest.z) < 1e-8);
  assert.ok(Math.abs(chosen().pose.flip - Math.PI * 2) < 1e-8);
  finishDeal(st.game);
  assert.deepEqual(chosen().pose, rest);
  assert.equal(chosen().options.wild, true);
  st.game.turn = 0;
  assert.ok(play(st.game, 0, [id]).move);
  assert.equal(
    sceneFrame(st).cards.find((card) => card.id === id && !card.options.back).options.wild,
    true,
  );
});

test('ordinary deals keep their timing and the table has no remaining counts or center hints', () => {
  const st = state();
  for (const dealing of [false, true]) {
    if (dealing) deal(st.game);
    assert.equal(dealDuration(st.game), DEAL_DURATION);
    const frame = sceneFrame(st);
    assert.equal(
      frame.cards.some((card) => card.options.wild || card.options.revealing),
      false,
    );
    assert.equal(
      frame.labels.some((label) => /余牌|先出完|点击开始/.test(label.text)),
      false,
    );
    assert.equal(
      frame.labels.some((label) => label.cls.includes('center-label')),
      false,
    );
  }
});
