import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, deal, finishDeal, play, ruleOptions } from '../src/game/state.js';
import { makeVisual } from '../src/game/scene.js';
import { sceneFrame, handPose } from '../src/game/scene-frame.js';
import {
  dealDuration,
  DEAL_DURATION,
  WILD_REVEAL_DURATION,
  STAMP_REVEAL_DURATION,
  stampStart,
} from '../src/game/wild-reveal.js';
import { rankOf } from '../src/game/rules.js';

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

test('the stamped card flips mid-deal and settles into its upgraded slot', () => {
  const st = state();
  st.game.items = ['stamp'];
  assert.ok(deal(st.game, () => 0));
  const stamp = st.game.stamp;
  assert.ok(stamp);
  const oldIndex = [...st.game.hands[0]]
    .slice()
    .sort((a, b) => rankOf(b) - rankOf(a) || a - b)
    .indexOf(stamp.card);
  const newIndex = st.game.hands[0].indexOf(stamp.card);
  const chosen = () =>
    sceneFrame(st).cards.find((card) => card.options.act === `select-${stamp.card}`);
  assert.equal(dealDuration(st.game), DEAL_DURATION + STAMP_REVEAL_DURATION);
  // dealt to its natural spot with its original face showing
  st.visual.dealTime = stampStart(st.game) - 0.1;
  const before = chosen();
  assert.equal(before.options.stampFace, null);
  assert.equal(before.options.name.includes(' · 印章'), false);
  // mid-flip: airborne, face already turned over to the upgraded rank
  st.visual.dealTime = stampStart(st.game) + STAMP_REVEAL_DURATION * 0.45;
  const mid = chosen();
  assert.equal(mid.options.stampFace, stamp.card + 1);
  assert.ok(mid.options.name.includes(' · 印章'));
  assert.ok(mid.pose.flip > 0.5);
  assert.ok(mid.pose.z > handPose(0, newIndex, 18).z);
  assert.equal(mid.options.dynamic, true);
  // settled: the upgraded face stays and the card sits at its new slot
  st.visual.dealTime = dealDuration(st.game);
  const done = chosen();
  assert.equal(done.options.stampFace, stamp.card + 1);
  const rest = handPose(0, newIndex, 18);
  for (const key of ['u', 'v', 'z', 'scale'])
    assert.ok(Math.abs(done.pose[key] - rest[key]) < 1e-6, `${key} settles`);
  assert.ok(Math.abs(done.pose.flip - Math.PI * 2) < 1e-6);
  assert.equal(done.options.dynamic, false);
  finishDeal(st.game);
  assert.equal(chosen().options.stampFace, stamp.card + 1);
  // the stamped card plays as its upgraded rank on the table too
  st.game.turn = 0;
  assert.ok(play(st.game, 0, [stamp.card]).move);
  const played = sceneFrame(st).cards.find((card) => card.id === stamp.card && !card.options.back);
  assert.equal(played.options.stampFace, stamp.card + 1);
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
