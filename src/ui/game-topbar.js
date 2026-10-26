import { ITEMS } from '../game/items.js';
import { STAGE_COUNT, ROUNDS_PER_STAGE } from '../game/state.js';
import { isMobileLandscape } from './device-mode.js';
import { renderPixelRatio } from '../engine/render-pixel-ratio.js';
import {
  drawBoard,
  drawIcon,
  drawGear,
  label,
  drawItemHint,
  stageAppearance,
} from './topbar-art.js';

const smooth = (t) => (t = Math.max(0, Math.min(1, t))) * t * (3 - 2 * t);

export function mountGameTopbar(stage, menu, state) {
  const bar = document.createElement('div');
  bar.className = 'game-topbar';
  bar.hidden = true;
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', '游戏状态');
  const canvas = document.createElement('canvas');
  canvas.id = 'topbar-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  // These nodes only provide semantics and hit areas. All visible pixels are painted on canvas.
  const info = document.createElement('span');
  info.className = 'sr-only';
  info.innerHTML = '<span id="level-label"></span><span id="current-coins"></span>';
  menu.replaceChildren();
  menu.classList.add('topbar-hit');
  const items = ITEMS.map((item) => {
    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'topbar-hit topbar-item';
    hit.dataset.item = item.id;
    hit.setAttribute('aria-label', `${item.name}：${item.description}`);
    hit.hidden = true;
    return hit;
  });
  bar.append(canvas, info, menu, ...items);
  stage.append(bar);
  const ctx = canvas.getContext('2d');
  const level = info.querySelector('#level-label');
  const balance = info.querySelector('#current-coins');
  let active = null,
    focused = null,
    previousKey;
  const place = (el, x, y, width, height) => {
    Object.assign(el.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
  };
  function paint() {
    const width = bar.clientWidth;
    if (!width) return;
    const sidebar = isMobileLandscape();
    const mobile = !sidebar && matchMedia('(max-width: 811px)').matches;
    const height = bar.clientHeight;
    const canvasWidth = sidebar ? width + 280 : width;
    const ratio = renderPixelRatio();
    const key = [
      width,
      height,
      sidebar,
      ratio,
      state.tableStyle,
      state.game.stage,
      state.game.substage,
      state.game.coins[0],
      state.game.items.join(','),
      active,
      focused,
    ].join('|');
    if (key === previousKey) return;
    previousKey = key;
    const pixels = Math.round(canvasWidth * ratio),
      rows = Math.round((height + (sidebar ? 0 : 130)) * ratio);
    if (canvas.width !== pixels || canvas.height !== rows) {
      canvas.width = pixels;
      canvas.height = rows;
    }
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${height + (sidebar ? 0 : 130)}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, height + 130);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawBoard(ctx, width, height, state.tableStyle, state.game.stage);
    const owned = ITEMS.filter((item) => state.game.items.includes(item.id));
    if (sidebar) {
      drawIcon(ctx, stageAppearance(state.game.stage).icon, 12, 12, 28);
      label(ctx, '关数', 44, 31, 10);
      label(ctx, `${state.game.stage}-${state.game.substage}`, 18, 62, 22, 800);
      drawIcon(ctx, 'coins', 12, 76, 28);
      label(ctx, '金币', 44, 95, 10);
      label(ctx, state.game.coins[0].toLocaleString('zh-CN'), 16, 124, 18, 800);
      const itemY = 142;
      const step = Math.min(36, (height - itemY - 56) / Math.max(1, Math.ceil(owned.length / 2)));
      for (const [i, item] of ITEMS.entries()) {
        const index = owned.indexOf(item),
          hit = items[i];
        hit.hidden = index < 0;
        if (index < 0) continue;
        const x = 10 + (index % 2) * 36,
          y = itemY + Math.floor(index / 2) * step;
        drawIcon(ctx, item.id, x, y, 28);
        place(hit, x - 2, y - 2, 34, step);
        if (focused === item.id) {
          ctx.strokeStyle = '#41538f';
          ctx.lineWidth = 1.3;
          ctx.strokeRect(x - 2, y - 2, 32, step);
        }
      }
      drawGear(ctx, (width - 28) / 2 - 3, height - 48, 28, focused === 'settings');
      place(menu, (width - 44) / 2 - 3, height - 56, 44, 44);
      const hint = owned.find((item) => item.id === active);
      if (hint) drawItemHint(ctx, hint, width + 4, 4, 260);
      return;
    }
    const statY = mobile ? 10 : 16;
    const coinX = mobile ? 113 : 168;
    const stageIcon = stageAppearance(state.game.stage);
    drawIcon(ctx, stageIcon.icon, 14, statY, 40);
    label(ctx, '关数', 59, statY + 11, 10);
    label(ctx, `${state.game.stage}-${state.game.substage}`, 59, statY + 35, 23, 800);
    drawIcon(ctx, 'coins', coinX, statY, 40);
    label(ctx, '当前金币', coinX + 45, statY + 11, 10);
    label(ctx, state.game.coins[0].toLocaleString('zh-CN'), coinX + 45, statY + 35, 23, 800);
    drawGear(ctx, width - 53, mobile ? 15 : 22, 32, focused === 'settings');
    place(menu, width - 59, mobile ? 9 : 16, 44, 44);
    const itemY = mobile ? 65 : 26;
    const itemX = mobile ? 20 : 330;
    const step = Math.min(mobile ? 56 : 68, (width - itemX - 20) / Math.max(1, owned.length));
    for (const [i, item] of ITEMS.entries()) {
      const index = owned.indexOf(item),
        hit = items[i];
      hit.hidden = index < 0;
      if (index < 0) continue;
      const x = itemX + index * step;
      drawIcon(ctx, item.id, x, itemY - 2, 34);
      place(hit, x, itemY - 5, step - 2, 40);
      if (focused === item.id) {
        ctx.fillStyle = '#fff4d6aa';
        ctx.beginPath();
        ctx.arc(x + 17, itemY + 15, 23, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#41538f';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x - 1, itemY - 4, step - 3, 38);
        ctx.setLineDash([]);
      }
    }
    const hint = ITEMS.find((item) => item.id === active && owned.includes(item));
    if (hint) {
      const boxWidth = Math.min(260, width - 18);
      const index = owned.indexOf(hint);
      const x = Math.min(width - boxWidth - 9, itemX + index * step);
      drawItemHint(ctx, hint, x, height + 6, boxWidth);
    }
  }
  function sync() {
    const { game, visual } = state;
    const entering = visual.entry;
    bar.hidden = !!visual.home && !entering;
    bar.inert = !!entering;
    const progress = entering ? smooth((entering.time - 0.16) / 0.72) : 1;
    bar.style.transform = isMobileLandscape()
      ? `translateX(${(-130 * (1 - progress)).toFixed(3)}px)`
      : `translateY(${(-150 * (1 - progress)).toFixed(3)}px)`;
    bar.dataset.entryProgress = progress.toFixed(4);
    bar.dataset.tableStyle = state.tableStyle;
    level.textContent = `第 ${game.stage} / ${STAGE_COUNT} 大关，第 ${game.substage} / ${ROUNDS_PER_STAGE} 小关`;
    balance.textContent = `当前金币 ${game.coins[0].toLocaleString('zh-CN')}`;
    if (bar.hidden) active = focused = null;
    paint();
  }
  for (const [i, hit] of items.entries()) {
    hit.addEventListener('pointerenter', () => {
      active = ITEMS[i].id;
      paint();
    });
    hit.addEventListener('pointerleave', () => {
      active = focused;
      paint();
    });
    hit.addEventListener('click', () => {
      active = active === ITEMS[i].id ? null : ITEMS[i].id;
      paint();
    });
  }
  for (const hit of [menu, ...items]) {
    hit.addEventListener('focus', () => {
      focused = hit.dataset.item || 'settings';
      active = hit.dataset.item || null;
      paint();
    });
    hit.addEventListener('blur', () => {
      focused = active = null;
      paint();
    });
  }
  bar.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      active = null;
      paint();
    }
  });
  new ResizeObserver(() => {
    previousKey = null;
    paint();
  }).observe(bar);
  addEventListener('render-settings-change', () => {
    previousKey = null;
    paint();
  });
  return sync;
}
