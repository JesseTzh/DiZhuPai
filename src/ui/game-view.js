import { settingsIcon } from './home-art.js';
import { STAGE_COUNT, ROUNDS_PER_STAGE, ruleOptions, buyItem } from '../game/state.js';
import { classify, beats } from '../game/rules.js';
import { TABLES } from '../game/table.js';
import { mountShop } from '../shop/view.js';
import { mountTableControls } from './table-controls.js';

export function mountGameView({ state, ui, actions: controller, isGamePage }) {
  const { game } = state;
  const stage = document.querySelector('.stage');
  const menu = document.createElement('button');
  menu.id = 'open-settings';
  menu.className = 'table-settings-button';
  menu.setAttribute('aria-label', '设置');
  menu.innerHTML = settingsIcon();
  stage.append(menu);
  const progress = document.createElement('div');
  progress.className = 'level-progress';
  progress.innerHTML = '<strong id="level-label"></strong><span id="level-detail"></span>';
  stage.append(progress);
  const status = document.createElement('div');
  status.className = 'turn-bar';
  status.innerHTML =
    '<span class="turn-dot"></span><span id="game-message" role="status" aria-live="polite"></span><span id="selection"></span>';
  const actions = document.getElementById('btns');
  actions.classList.add('game-actions');
  stage.append(status, actions);
  const buttons = [...actions.querySelectorAll('button')];
  buttons.forEach((b, i) => (b.id = ['start-game', 'play-cards', 'pass-turn'][i]));
  buttons[1].classList.add('primary');
  buttons[0].classList.add('primary');
  const tableControls = mountTableControls(stage, state);
  const syncShop = mountShop(
    stage,
    (id) => {
      const response = buyItem(game, id);
      document.getElementById('shop-notice').textContent =
        response.error || `已购买${response.item.name}，下一小局开始生效`;
      ui.render();
      return response;
    },
    controller.start,
  );
  const result = document.createElement('section');
  result.id = 'result';
  result.hidden = true;
  result.setAttribute('aria-live', 'polite');
  stage.append(result);
  function sync() {
    const inShop = game.phase === 'shop';
    document.body.classList.toggle('shop-open', inShop);
    syncShop(game, inShop);
    tableControls.sync(!inShop && isGamePage() && !state.shopTransition);
    const active = controller.canAct(),
      move = classify(game.selected, ruleOptions(game), game.target?.move),
      valid = beats(move, game.target?.move);
    buttons[0].parentElement.hidden = !['ready', 'over'].includes(game.phase) || state.locked;
    buttons[0].textContent =
      game.phase === 'ready'
        ? '开始发牌'
        : game.matchOver
          ? '新一场 · 100 金币'
          : game.substage === ROUNDS_PER_STAGE
            ? `进入第 ${game.stage + 1} 大关`
            : `下一小关 · ${game.stage}-${game.substage + 1}`;
    const table = TABLES.find((choice) => choice.id === state.tableStyle);
    document.getElementById('level-label').textContent =
      `第 ${game.stage} / ${STAGE_COUNT} 大关 · 第 ${game.substage} / ${ROUNDS_PER_STAGE} 小关`;
    document.getElementById('level-detail').textContent =
      `${table.name} · 胜场 ${game.wins[0]} : ${game.wins[1]}`;
    buttons.slice(1).forEach((b) => {
      b.parentElement.hidden = game.phase !== 'playing' && game.phase !== 'dealing';
      b.disabled = !active;
    });
    buttons[1].disabled = !active || !valid;
    buttons[2].disabled = !active || !game.target;
    document.getElementById('game-message').textContent = state.shopTransition
      ? '收起牌桌，玩具铺营业中…'
      : state.locked && game.phase !== 'dealing'
        ? '金币结算中'
        : game.message;
    status.classList.toggle('your-turn', active);
    status.classList.toggle('is-busy', game.phase === 'dealing' || game.turn === 1);
    document.getElementById('selection').textContent = game.selected.length
      ? `已选 ${game.selected.length} 张${move ? ' · ' + move.name + (move.wildRank ? ` · 赖子作 ${{ 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' }[move.wildRank] || move.wildRank}` : '') : ' · 请选择有效牌型'}`
      : active
        ? game.target
          ? '跟牌或过牌'
          : '自由出牌'
        : '';
    result.hidden = game.phase !== 'over' || state.locked;
    if (!result.hidden) {
      const winner = game.matchOver ? game.matchWinner : game.winner;
      const next =
        game.substage === ROUNDS_PER_STAGE
          ? '本大关完成，下一大关换桌并重新洗牌。'
          : `下一小关继续从余牌发出18张，不重新洗牌。`;
      result.innerHTML = `<span class="eyebrow">${game.matchOver ? '本场结束' : `第 ${game.stage}-${game.substage} 小关结束`}</span><strong>${winner === 0 ? '你赢了！' : '电脑获胜'}</strong><span>${game.matchOver ? game.message : next}</span><span>胜场 ${game.wins[0]} : ${game.wins[1]}</span><div>你 ${game.coins[0]} <small>金币</small><em>/</em>电脑 ${game.coins[1]} <small>金币</small></div>`;
    }
  }
  return {
    sync,
    menu,
    shopTransition(active) {
      document.body.classList.toggle('clearing-table', active);
    },
    shopOpened() {
      document.getElementById('shop-notice').textContent = '';
      requestAnimationFrame(() =>
        document.getElementById('leave-shop').focus({ preventScroll: true }),
      );
    },
  };
}
