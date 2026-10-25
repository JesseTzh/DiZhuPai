import { mountFigure } from './engine/figure.js';
import { cardDeck, cardIds } from './cards/constants.js';
import { createGame, PASS_COST } from './game/state.js';
import { createGameRenderer, makeVisual, DEAL_DURATION } from './game/scene.js';
import { createSounds } from './game/sound.js';
import { mountShell } from './ui/controls.js';
import { mountZoom } from './ui/zoom.js';
import { mountSettings } from './ui/settings-screen.js';
import { mountItemCatalogue } from './ui/item-catalogue.js';
import { mountGameView } from './ui/game-view.js';
import { bindGameKeyboard } from './ui/game-keyboard.js';
import { mountSaveScreen } from './ui/save-screen.js';
import { createSaveSession } from './app/save-session.js';
import { createGameController } from './app/game-controller.js';
import { mountNavigation } from './app/navigation.js';

addEventListener('error', (event) => {
  document.documentElement.dataset.errors =
    (document.documentElement.dataset.errors || '') + event.message + ';';
});
const session = createSaveSession(localStorage);
const saved = session.initialSave;
const game = saved?.game || createGame(),
  visual = makeVisual();
visual.dealTime = game.round ? DEAL_DURATION : 0;
visual.bags.forEach((bag, player) => {
  bag.count = Math.min(40, game.coins[player] / 5);
  bag.fillShow = bag.count / 40;
});
const state = {
  game,
  visual,
  tableStyle: saved?.tableStyle || 'planks',
  pal: saved?.palette || 'cobalt',
  hoverShadow: localStorage.getItem('card-hover-shadow') !== 'off',
  locked: false,
  cardNames: cardDeck.map((card) => card.name),
};
const preferences = { firstTable: saved?.firstTable || state.tableStyle };
const saveOptions = () => ({
  tableStyle: state.tableStyle,
  firstTable: preferences.firstTable,
  palette: state.pal,
});
const audio = createSounds();
let controller, navigation;
const isGamePage = () => navigation?.isGamePage() || false;
const ui = mountFigure({
  fig: '01',
  title: '地主牌',
  credit: false,
  size: [650, 650, 80],
  center: [0, 0],
  palette: 'cobalt',
  inkScale: 0.7,
  state,
  renderer: createGameRenderer,
  acts: {
    ...Object.fromEntries(cardIds.map((id) => [`select-${id}`, () => controller.select(id)])),
    'poke-bag': () => controller.pokeBag(),
  },
  buttons: [
    { label: '开始发牌', onClick: () => controller.start() },
    { label: '出牌', onClick: () => controller.playerPlay() },
    { label: `过牌 · ${PASS_COST} 金币`, onClick: () => controller.playerPass() },
    { label: '收牌', onClick: () => controller.playerSteal() },
  ],
});
mountShell(ui, { palette: '玩家配色', swatches: ['芥末黄', null, '薄荷绿', '钴蓝', '玫瑰粉'] });
mountZoom({ controls: false });
document.body.classList.add('game-page');
document.documentElement.classList.toggle('hover-shadows', state.hoverShadow);
document.getElementById('fig').setAttribute('role', 'group');
controller = createGameController({
  state,
  ui,
  audio,
  preferences,
  isGamePage,
  syncTableChoices: () => settings.syncTableChoices(),
  onRestore: () => {
    settings.refresh();
    navigation.showPage('game');
  },
  onNew: () => navigation.showPage('game'),
  onShopTransition: (active) => view.shopTransition(active),
  onShopOpen: () => view.shopOpened(),
});
const view = mountGameView({ state, ui, actions: controller, isGamePage });
const settings = mountSettings({ state, ui, audio });
const catalogue = mountItemCatalogue({ state });
const saves = mountSaveScreen({
  session,
  exportSlot: (index) => session.export(index, game, saveOptions()),
  onNew: controller.newGame,
  onRestore: controller.restoreProgress,
});
const saveProgress = () => {
  session.save(game, saveOptions());
  saves.syncStatus();
};
navigation = mountNavigation({
  state,
  ui,
  audio,
  controller,
  session,
  settings,
  saves,
  catalogue,
  menu: view.menu,
  saveProgress,
});
bindGameKeyboard(game, controller);
document.querySelector('.stage').addEventListener('click', (event) => {
  if (
    isGamePage() &&
    !event.target.closest('button, a, input, select, [data-act], #result, .shop-panel')
  )
    controller.clearSelection();
});
document.addEventListener('pointerover', (event) => {
  const target = event.target.closest?.('#home-screen button, #home-screen a, [data-card]');
  if (target && !target.contains(event.relatedTarget)) audio.hover(3);
});

const draw = ui.render;
ui.render = () => {
  draw();
  if (game.phase === 'over' && !game.matchOver && !state.locked && !state.shopTransition)
    controller.openShop();
  view.sync();
  saveProgress();
};
addEventListener('pagehide', saveProgress);
navigation.showPage(new URLSearchParams(location.search).get('page'), false);
window.gameApp = {
  state,
  audio,
  homeAnimation: navigation.homeAnimation,
  render: () => ui.render(),
  start: controller.start,
  select: controller.select,
  hint: controller.hint,
  play: controller.playerPlay,
  pass: controller.playerPass,
  ready: () => ui.ready(),
};
