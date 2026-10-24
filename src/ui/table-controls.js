import { ITEMS } from '../game/items.js';

export function mountTableControls(stage, state) {
  const tooltip = document.createElement('div');
  tooltip.id = 'item-tooltip';
  tooltip.className = 'item-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  stage.append(tooltip);
  let active = null;
  const hide = () => {
    active = null;
    tooltip.hidden = true;
  };
  const show = (target, x, y) => {
    const item = ITEMS.find((item) => item.id === target.dataset.item);
    if (!item) return;
    active = target;
    tooltip.innerHTML = `<strong>${item.toy} · ${item.name}</strong><span>${item.description}</span><small>已拥有 · ${state.game.phase === 'shop' ? '下一小局生效' : '本场持续生效'}</small>`;
    tooltip.hidden = false;
    const rect = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(innerWidth - rect.width - 8, x + 14))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(innerHeight - rect.height - 8, y - rect.height - 12))}px`;
  };
  stage.addEventListener('pointerover', (event) => {
    const target = event.target.closest?.('.table-item');
    if (target && target !== active) show(target, event.clientX, event.clientY);
    else if (!target) hide();
  });
  stage.addEventListener('pointerleave', hide);
  stage.addEventListener('focusin', (event) => {
    const target = event.target.closest?.('.table-item');
    if (!target) return hide();
    const rect = target.getBoundingClientRect();
    show(target, rect.x + rect.width / 2, rect.y);
  });
  stage.addEventListener('focusout', hide);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
  return {
    sync: (visible) => {
      if (!visible || !active?.isConnected) hide();
    },
  };
}
