import { homeMarkup, mountHomeAnimation } from '../ui/home-art.js';
import { mountGameEntry } from '../ui/game-entry.js';
import { randomSeedString, SEED_MAX_LENGTH } from '../game/random.js';

export function mountNavigation({
  state,
  ui,
  audio,
  controller,
  session,
  settings,
  saves,
  catalogue,
  saveProgress,
}) {
  const home = document.createElement('main');
  home.id = 'home-screen';
  home.innerHTML = homeMarkup();
  document.body.append(home);
  const homeAnimation = mountHomeAnimation(home);
  let currentPage = null;
  // A ?seed= link shares a reproducible match: it only pre-fills the input for the next new game.
  const seedInput = home.querySelector('#seed-input');
  const urlSeed = new URLSearchParams(location.search)
    .get('seed')
    ?.trim()
    .slice(0, SEED_MAX_LENGTH);
  if (urlSeed) seedInput.value = urlSeed;
  seedInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    entry.start();
  });
  const entry = mountGameEntry({
    home,
    state,
    ui,
    onComplete: () => {
      if (session.activeSlot !== null) showPage('game');
      else {
        session.select(0);
        controller.newGame();
      }
    },
  });
  function openSettings() {
    settings.refresh();
    controller.stopComputer();
    settings.element.showModal();
  }
  settings.element.addEventListener('close', () => {
    controller.queueComputer();
    ui.render();
  });
  function showPage(page, updateHistory = true) {
    if (page === 'settings' && currentPage) {
      openSettings();
      return;
    }
    entry.cancel();
    const wantsSettings = page === 'settings';
    let next = ['game', 'saves'].includes(page) ? page : 'home';
    if (settings.element.open) settings.element.close();
    if (next === 'game' && session.activeSlot === null) next = 'saves';
    if (next === 'saves') {
      saveProgress();
      saves.open();
    }
    if (next !== 'game') audio.stopDeal();
    const isHome = next === 'home';
    if (isHome && currentPage !== 'home' && !state.game.round) {
      state.game.hands = [
        [0, 8, 16, 24, 32, 40, 48],
        [4, 12, 20, 28, 36, 44, 52],
      ];
    }
    state.visual.home = isHome;
    home.querySelector('.home-start-label').textContent = session.readSlots()[0].save
      ? '继续游戏'
      : '开始游戏';
    currentPage = next;
    controller.stopComputer();
    document.body.classList.toggle('home-page', isHome);
    document.body.classList.toggle('saves-page', next === 'saves');
    home.hidden = !isHome;
    homeAnimation.sync();
    saves.element.hidden = next !== 'saves';
    if (next === 'saves') document.getElementById('close-saves').focus({ preventScroll: true });
    if (next === 'game' && state.game.phase === 'dealing') audio.startDeal();
    controller.queueComputer();
    if (updateHistory) {
      const url = new URL(location.href);
      if (isHome) url.searchParams.delete('page');
      else url.searchParams.set('page', next);
      history.pushState({}, '', url);
    }
    ui.render();
    if (isHome) entry.syncHome();
    if (wantsSettings) openSettings();
  }
  for (const id of ['home-settings', 'open-settings'])
    document.getElementById(id).onclick = openSettings;
  document.getElementById('home-catalogue').onclick = () => catalogue.open();
  settings.element.querySelector('#return-home').onclick = () => {
    saveProgress();
    showPage('home');
  };
  settings.element.querySelector('#restart-game').onclick = () => {
    if (session.activeSlot === null) session.select(0);
    controller.newGame();
  };
  document.getElementById('enter-game').onclick = entry.start;
  document.getElementById('home-import').onclick = () => showPage('saves');
  document.getElementById('close-saves').onclick = () => showPage('home');
  addEventListener('popstate', () =>
    showPage(new URLSearchParams(location.search).get('page'), false),
  );
  // The seed for the next new match: the typed value, or a fresh shareable one.
  function nextSeed() {
    const value = seedInput.value.trim().slice(0, SEED_MAX_LENGTH);
    return value || randomSeedString();
  }
  return {
    showPage,
    homeAnimation,
    nextSeed,
    isGamePage: () => currentPage === 'game' && !settings.element.open,
  };
}
