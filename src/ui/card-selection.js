import { selectedHandIndices } from '../game/selection.js';

export function bindCardSelection(game, { canAct, selectCards }) {
  const figure = document.getElementById('fig');
  const hitContext = document.createElement('canvas').getContext('2d');
  let gesture = null;
  let suppressClick = false;

  // 固定按下时的命中区域，选牌抬升与重绘不会改变本次划选路径。
  figure.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || gesture) return;
      const card = event.target.closest('.hand-card');
      if (!card || !canAct()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = Number(card.dataset.handIndex);
      const hits = [...figure.querySelectorAll('.hand-card')].reverse().map((node) => {
        const path = node.querySelector('path');
        return {
          id: Number(node.dataset.handIndex),
          path: new Path2D(path.getAttribute('d')),
          inverse: path.getScreenCTM().inverse(),
        };
      });
      suppressClick = false;
      gesture = {
        pointerId: event.pointerId,
        hand: game.hands[0],
        hits,
        selected: !selectedHandIndices(game).includes(id),
        visited: new Set([id]),
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
      };
      selectCards([id], gesture.selected);
    },
    true,
  );

  function sweep(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (!canAct() || game.hands[0] !== gesture.hand) {
      gesture = null;
      return;
    }
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
    const crossed = [];
    // 补齐相邻事件之间的路径，快速横划也能选中中间的牌。
    for (let i = 1; i <= steps; i++) {
      const point = new DOMPoint(gesture.x + (dx * i) / steps, gesture.y + (dy * i) / steps);
      const hit = gesture.hits.find(({ path, inverse }) => {
        const local = point.matrixTransform(inverse);
        return hitContext.isPointInPath(path, local.x, local.y);
      });
      if (!hit || gesture.visited.has(hit.id)) continue;
      gesture.visited.add(hit.id);
      crossed.push(hit.id);
    }
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    if (crossed.length) selectCards(crossed, gesture.selected);
  }

  window.addEventListener('pointermove', (event) => {
    if (gesture && event.pointerId === gesture.pointerId) {
      if (!(event.buttons & 1)) {
        gesture = null;
        return;
      }
      sweep(event);
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    sweep(event);
    if (!gesture) return;
    suppressClick =
      gesture.visited.size > 1 ||
      Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 4;
    gesture = null;
  });
  const cancel = () => {
    gesture = null;
    suppressClick = false;
  };
  window.addEventListener('pointercancel', () => {
    suppressClick = !!gesture;
    gesture = null;
  });
  window.addEventListener('blur', cancel);
  window.addEventListener('pointerdown', cancel, true);
  // 在空白处松手也保留划选结果，避免随后的 click 清空选牌。
  window.addEventListener(
    'click',
    (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
}
