import { ROUNDS_PER_STAGE, ruleOptions, buyItem } from '../game/state.js';
import { classify, beats } from '../game/rules.js';
import { hasItemRule } from '../game/items.js';
import { mountShop } from '../shop/view.js';
import { mountTableControls } from './table-controls.js';
import { mountGameTopbar } from './game-topbar.js';
import { isMobileLandscape } from './device-mode.js';
import { layoutFor } from '../game/scene-layout.js';

export function mountGameView({ state, ui, actions: controller, isGamePage }) {
  const { game } = state;
  const stage = document.querySelector('.stage');
  const menu = document.createElement('button');
  menu.id = 'open-settings';
  menu.className = 'table-settings-button';
  menu.setAttribute('aria-label', '设置');
  const syncTopbar = mountGameTopbar(stage, menu, state);
  const status = document.createElement('div');
  status.className = 'turn-bar';
  status.innerHTML =
    '<span class="turn-dot"></span><span id="game-message" role="status" aria-live="polite"></span><span id="selection"></span>';
  const actions = document.getElementById('btns');
  actions.classList.add('game-actions');
  const actionCanvas = document.createElement('canvas');
  actionCanvas.className = 'game-actions-canvas';
  actionCanvas.setAttribute('aria-hidden', 'true');
  stage.append(status, actionCanvas, actions);
  const actionCtx = actionCanvas.getContext('2d');
  const figure = document.getElementById('fig');
  let hoveredAction = null;
  const paintActions = () => {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    if (!w || !h) return;
    const ratio = window.devicePixelRatio || 1;
    actionCanvas.width = Math.round(w * ratio);
    actionCanvas.height = Math.round(h * ratio);
    actionCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    actionCtx.clearRect(0, 0, w, h);
    if (!['playing', 'dealing'].includes(game.phase)) return;
    const mobile = isMobileLandscape();
    const layout = layoutFor(mobile);
    const scale = layout.actionScale;
    const viewport = figure.parentElement;
    const left = mobile ? viewport.offsetLeft : 0;
    const availableWidth = mobile ? viewport.clientWidth : w;
    // The SVG letterboxes its viewBox inside the element; map the renderer's
    // viewBox-space anchor through that same fit so the pills sit between the
    // played cards and the hand at every aspect ratio.
    const box = figure.viewBox.baseVal;
    const viewScale = Math.min(
      viewport.clientWidth / box.width,
      viewport.clientHeight / box.height,
    );
    const contentTop = viewport.offsetTop + (viewport.clientHeight - box.height * viewScale) / 2;
    const center = Number(figure.dataset.actionCenter);
    const rowGap = Number(figure.dataset.actionGap) * viewScale;
    const handTop = contentTop + (center + rowGap / 2) * viewScale;
    const actionY = figure.dataset.actionCenter
      ? // Never sit on the hand: where the gap between the played row and the hand
        // is tiny, overlap the played cards instead, which are not interactive.
        Math.min(contentTop + center * viewScale - 21 * scale, handTop - 47 * scale - 2)
      : h * 0.6;
    const draw = (position, width, fill, text, icon, disabled, hovered) => {
      const lift = hovered && !disabled ? -3 : 0;
      const x = 0,
        y = 0;
      actionCtx.save();
      actionCtx.translate(left + position * scale, actionY);
      actionCtx.scale(scale, scale);
      actionCtx.translate(0, lift);
      const cut = 8;
      const path = () => {
        actionCtx.beginPath();
        actionCtx.moveTo(x + cut, y);
        actionCtx.lineTo(x + width - cut, y);
        actionCtx.lineTo(x + width, y + cut);
        actionCtx.lineTo(x + width, y + 42 - cut);
        actionCtx.lineTo(x + width - cut, y + 42);
        actionCtx.lineTo(x + cut, y + 42);
        actionCtx.lineTo(x, y + 42 - cut);
        actionCtx.lineTo(x, y + cut);
        actionCtx.closePath();
      };
      actionCtx.fillStyle = '#41538f';
      actionCtx.translate(3, 5);
      path();
      actionCtx.fill();
      actionCtx.translate(-3, -5);
      actionCtx.fillStyle = disabled ? '#d9d1c0' : fill;
      path();
      actionCtx.fill();
      actionCtx.strokeStyle = '#231e16';
      actionCtx.lineWidth = 2;
      actionCtx.stroke();
      actionCtx.strokeStyle = disabled ? '#b8ad9a' : '#fff4d6';
      actionCtx.lineWidth = 1;
      actionCtx.globalAlpha = 0.8;
      actionCtx.beginPath();
      actionCtx.moveTo(x + 8, y + 7);
      actionCtx.lineTo(x + width - 8, y + 7);
      actionCtx.lineTo(x + width - 7, y + 35);
      actionCtx.lineTo(x + 7, y + 35);
      actionCtx.closePath();
      actionCtx.stroke();
      actionCtx.globalAlpha = 1;
      actionCtx.fillStyle = disabled ? '#8b8377' : '#231e16';
      actionCtx.font = "700 13px ui-monospace, 'PingFang SC', sans-serif";
      actionCtx.textAlign = 'center';
      actionCtx.fillText(text, x + width / 2 + 8, y + 26);
      actionCtx.strokeStyle = disabled ? '#8b8377' : '#231e16';
      actionCtx.lineWidth = 1.5;
      actionCtx.beginPath();
      if (icon === 'play') {
        actionCtx.moveTo(x + 16, y + 14);
        actionCtx.lineTo(x + 16, y + 29);
        actionCtx.lineTo(x + 25, y + 21.5);
      } else if (icon === 'steal') {
        actionCtx.arc(x + 19, y + 21, 7, Math.PI * 0.6, Math.PI * 1.9);
        actionCtx.moveTo(x + 13.5, y + 15.5);
        actionCtx.lineTo(x + 13, y + 22);
        actionCtx.lineTo(x + 19.5, y + 21);
      } else {
        actionCtx.moveTo(x + 13, y + 15);
        actionCtx.lineTo(x + 25, y + 27);
        actionCtx.moveTo(x + 25, y + 15);
        actionCtx.lineTo(x + 13, y + 27);
      }
      actionCtx.stroke();
      actionCtx.restore();
    };
    const gap = 14;
    const passW = 112,
      playW = 112,
      stealW = 96;
    // The mouse button only takes space while the opponent's play sits on the table.
    const stealShown = buttons[3] && buttons[3].style.display !== 'none';
    const total = passW + playW + gap + (stealShown ? stealW + gap : 0);
    const x = (availableWidth / scale - total) / 2;
    const hitY = actionY - 5 * scale;
    let cursor = x;
    if (stealShown) {
      draw(
        cursor,
        stealW,
        '#cdd3de',
        '收牌',
        'steal',
        buttons[3]?.disabled,
        hoveredAction === 'steal',
      );
      Object.assign(buttons[3].style, {
        left: `${left + cursor * scale}px`,
        top: `${hitY}px`,
        width: `${stealW * scale}px`,
        height: `${52 * scale}px`,
      });
      cursor += stealW + gap;
    }
    draw(cursor, passW, '#fff4d6', '过牌', 'pass', buttons[2]?.disabled, hoveredAction === 'pass');
    Object.assign(buttons[2].style, {
      left: `${left + cursor * scale}px`,
      top: `${hitY}px`,
      width: `${passW * scale}px`,
      height: `${52 * scale}px`,
    });
    cursor += passW + gap;
    draw(cursor, playW, '#93d3b0', '出牌', 'play', buttons[1]?.disabled, hoveredAction === 'play');
    Object.assign(buttons[1].style, {
      left: `${left + cursor * scale}px`,
      top: `${hitY}px`,
      width: `${playW * scale}px`,
      height: `${52 * scale}px`,
    });
  };
  new ResizeObserver(paintActions).observe(stage);
  figure.addEventListener('scene-layout', paintActions);
  const buttons = [...actions.querySelectorAll('button')];
  buttons.forEach((b, i) => (b.id = ['start-game', 'play-cards', 'pass-turn', 'steal-cards'][i]));
  buttons[1].classList.add('primary');
  buttons[0].classList.add('primary');
  for (const b of [buttons[1], buttons[2], buttons[3]]) {
    if (!b) continue;
    b.addEventListener('pointerenter', () => {
      hoveredAction = b.id === 'play-cards' ? 'play' : b.id === 'pass-turn' ? 'pass' : 'steal';
      paintActions();
    });
    b.addEventListener('pointerleave', () => {
      hoveredAction = null;
      paintActions();
    });
  }
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
    // The shop overlay and its hidden canvas belong to the game page only: on home the
    // same canvas paints the title board, so a lingering shop phase must not hide it.
    const inShop = game.phase === 'shop' && !state.visual.home;
    document.body.classList.toggle('shop-open', inShop);
    // Leaving mid shop-transition must drop the table slide at once: syncHome measures
    // the canvas through getScreenCTM, and the clearing translate would bake itself in.
    if (state.visual.home) document.body.classList.remove('clearing-table');
    syncShop(game, inShop);
    tableControls.sync(!inShop && isGamePage() && !state.shopTransition);
    const active = controller.canAct(),
      move = classify(game.selected, ruleOptions(game), game.target?.move),
      valid = beats(move, game.target?.move, ruleOptions(game));
    buttons[0].parentElement.hidden = !['ready', 'over'].includes(game.phase) || state.locked;
    buttons[0].textContent =
      game.phase === 'ready'
        ? '开始发牌'
        : game.matchOver
          ? '新一场 · 100 金币'
          : game.substage === ROUNDS_PER_STAGE
            ? `进入第 ${game.stage + 1} 大关`
            : `下一小关 · ${game.stage}-${game.substage + 1}`;
    buttons.slice(1).forEach((b) => {
      b.parentElement.hidden = game.phase !== 'playing' && game.phase !== 'dealing';
      b.disabled = !active;
    });
    // The mouse button only takes space while the opponent's play sits on the table.
    buttons[3].style.display =
      game.phase === 'playing' &&
      hasItemRule(game, 'stealPlay') &&
      !game.stealUsed &&
      game.target?.player === 1
        ? ''
        : 'none';
    syncTopbar(game);
    buttons[1].disabled = !active || !valid;
    buttons[2].disabled = !active || !game.target;
    buttons[3].disabled = !active;
    paintActions();
    document.getElementById('game-message').textContent = state.shopTransition
      ? '收起牌桌，杂货铺营业中…'
      : state.locked && game.phase !== 'dealing'
        ? '金币结算中'
        : game.message === '轮到你出牌'
          ? ''
          : game.message;
    status.classList.toggle('your-turn', active);
    status.classList.toggle('is-busy', game.phase === 'dealing' || game.turn === 1);
    document.getElementById('selection').textContent = game.selected.length
      ? `已选 ${game.selected.length} 张${move ? ' · ' + move.name + (move.wildRank ? ` · 赖子作 ${{ 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' }[move.wildRank] || move.wildRank}` : '') : ' · 请选择有效牌型'}`
      : '';
    status.hidden =
      !document.getElementById('game-message').textContent &&
      !document.getElementById('selection').textContent;
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
      document.body.classList.toggle('clearing-table', active && !state.visual.home);
    },
    shopOpened() {
      document.getElementById('shop-notice').textContent = '';
      requestAnimationFrame(() =>
        document.getElementById('leave-shop').focus({ preventScroll: true }),
      );
    },
  };
}
