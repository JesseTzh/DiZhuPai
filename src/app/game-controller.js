import { createGame, deal, finishDeal, play, pass, ruleOptions, enterShop } from '../game/state.js';
import { chooseMove, legalMoves, sortHand } from '../game/rules.js';
import { makeVisual, handPose, stepVisual, DEAL_DURATION } from '../game/scene.js';
import { TRANSFER_DURATION, coinScatterSeed } from '../game/transfer.js';
import { dealDuration } from '../game/wild-reveal.js';
import { TABLES } from '../game/table.js';

export function createGameController({
  state,
  ui,
  audio,
  preferences,
  isGamePage,
  syncTableChoices,
  onRestore,
  onNew,
  onShopTransition,
  onShopOpen,
}) {
  const { game, visual } = state;
  let aiTimer = null,
    epoch = 0,
    hintIndex = 0,
    visualRunning = false;
  const sound = (index) => audio.play(index);
  function animate() {
    if (visualRunning) return;
    visualRunning = true;
    ui.animate((dt) => {
      const active = stepVisual(state, dt);
      if (!active) visualRunning = false;
      return active;
    });
  }
  function canAct() {
    return isGamePage() && game.phase === 'playing' && game.turn === 0 && !state.locked;
  }
  function resetVisual() {
    Object.assign(visual, makeVisual(), { dealTime: DEAL_DURATION });
    visual.bags.forEach((bag, p) => {
      bag.count = Math.min(40, game.coins[p] / 5);
      bag.fillShow = bag.count / 40;
    });
  }
  function restoreProgress(save) {
    epoch++;
    clearTimeout(aiTimer);
    audio.stopDeal();
    Object.assign(game, save.game);
    preferences.firstTable = save.firstTable;
    state.tableStyle = save.tableStyle;
    state.pal = save.palette;
    state.locked = false;
    state.shopTransition = false;
    hintIndex = 0;
    resetVisual();
    onShopTransition(false);
    syncTableChoices();
    onRestore();
  }
  function openShop() {
    const token = epoch;
    state.shopTransition = true;
    state.locked = true;
    let elapsed = 0;
    ui.animate((dt) => {
      if (token !== epoch) return false;
      elapsed += dt;
      if (elapsed > 0.55) onShopTransition(true);
      if (elapsed < 1.45) return true;
      enterShop(game);
      state.shopTransition = false;
      state.locked = false;
      onShopTransition(false);
      onShopOpen();
      return false;
    });
  }
  function select(id) {
    if (!canAct()) return;
    game.selected = game.selected.includes(id)
      ? game.selected.filter((c) => c !== id)
      : [...game.selected, id];
    ui.render();
  }
  function clearSelection() {
    game.selected = [];
    ui.render();
  }
  function hint() {
    if (!canAct()) return;
    const best = chooseMove(
      game.hands[0],
      game.target?.move,
      game.hands[1].length,
      ruleOptions(game),
    );
    if (!best) {
      clearSelection();
      ui.flash('没有能压过的牌，可以过牌');
      return;
    }
    const moves = legalMoves(game.hands[0], game.target?.move, ruleOptions(game)).sort(
      (a, b) => a.main - b.main,
    );
    const choices = [best, ...moves.filter((m) => m.cards.join() !== best.cards.join())];
    game.selected = choices[hintIndex++ % choices.length].cards;
    ui.render();
  }
  function start() {
    if (state.locked || !['ready', 'over', 'shop'].includes(game.phase)) return;
    clearTimeout(aiTimer);
    const token = ++epoch;
    if (game.matchOver) {
      Object.assign(game, createGame());
      resetVisual();
      state.tableStyle = preferences.firstTable;
    }
    if (game.round === 0) preferences.firstTable = state.tableStyle;
    if (!deal(game)) return;
    state.tableStyle =
      TABLES[
        (TABLES.findIndex((table) => table.id === preferences.firstTable) + game.stage - 1) %
          TABLES.length
      ].id;
    syncTableChoices();
    hintIndex = 0;
    state.locked = true;
    visual.dealTime = 0;
    visual.playTime = 2;
    visual.transfer = null;
    visual.spill = null;
    if (game.substage === 1) sound(2);
    setTimeout(() => {
      if (token === epoch && game.phase === 'dealing' && isGamePage()) audio.startDeal();
    }, 220);
    ui.animate((dt) => {
      if (token !== epoch) return false;
      visual.dealTime += dt;
      if (visual.dealTime >= dealDuration(game)) {
        audio.stopDeal();
        finishDeal(game);
        state.locked = false;
        queueComputer();
        return false;
      }
      return true;
    });
    ui.render();
  }
  function afterPlay(p, cards) {
    const before = [...game.hands[p]],
      ordered = sortHand(cards);
    const response = play(game, p, cards);
    if (response.error) {
      ui.flash(response.error);
      return false;
    }
    hintIndex = 0;
    visual.playTime = 0;
    visual.playFrom = ordered.map((id) => handPose(p, before.indexOf(id), before.length));
    sound(1);
    animate();
    ui.render();
    queueComputer();
    return true;
  }
  function playerPlay() {
    if (canAct()) afterPlay(0, [...game.selected]);
  }
  function afterPass(p) {
    const before = [...game.coins];
    const response = pass(game, p);
    if (response.error) {
      ui.flash(response.error);
      return;
    }
    const token = epoch;
    hintIndex = 0;
    state.locked = true;
    visual.spill = null;
    visual.transfer = {
      from: p,
      amount: response.amount,
      start: visual.time,
      before,
      scatterSeed: coinScatterSeed(),
    };
    visual.bags[p].punchT = 0;
    visual.bags[1 - p].squash = 0.04;
    sound(1);
    animate();
    ui.render();
    // Unlock only after the coins finish their physical path; reset/new-game cannot race a pending turn.
    const end = visual.time + TRANSFER_DURATION;
    ui.animate(() => {
      if (token !== epoch) return false;
      if (visual.time < end) return true;
      state.locked = false;
      queueComputer();
      return false;
    });
  }
  function pokeBag() {
    if (!isGamePage() || state.locked || game.phase === 'shop' || visual.spill) return;
    visual.spill = {
      from: 0,
      amount: 5,
      start: visual.time,
      decorative: true,
      scatterSeed: coinScatterSeed(),
    };
    visual.bags[0].punchT = 0;
    sound(1);
    animate();
    ui.render();
  }
  function playerPass() {
    if (canAct()) afterPass(0);
  }
  function queueComputer() {
    clearTimeout(aiTimer);
    if (!isGamePage() || game.phase !== 'playing' || game.turn !== 1 || state.locked) return;
    const token = epoch;
    aiTimer = setTimeout(() => {
      if (
        !isGamePage() ||
        token !== epoch ||
        game.phase !== 'playing' ||
        game.turn !== 1 ||
        state.locked
      )
        return;
      const move = chooseMove(game.hands[1], game.target?.move, game.hands[0].length);
      if (move) afterPlay(1, move.cards);
      else afterPass(1);
    }, 950);
  }

  function stopComputer() {
    clearTimeout(aiTimer);
  }
  function newGame() {
    epoch++;
    stopComputer();
    audio.stopDeal();
    Object.assign(game, createGame());
    resetVisual();
    state.locked = false;
    state.shopTransition = false;
    onShopTransition(false);
    onNew();
    start();
  }
  return {
    canAct,
    start,
    select,
    clearSelection,
    hint,
    playerPlay,
    playerPass,
    pokeBag,
    queueComputer,
    openShop,
    restoreProgress,
    newGame,
    stopComputer,
  };
}
