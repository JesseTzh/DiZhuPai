import { P } from '../engine/camera.js';
import { world } from '../game/table.js';

export const ENTRY_DURATION = 1.36;
const clamp = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => (t = clamp(t)) * t * (3 - 2 * t);

// Keep one canvas and one table model mounted from home through gameplay.
export function mountGameEntry({ home, state, ui, onComplete }) {
  const wrap = document.querySelector('.zwrap');
  const svg = document.getElementById('fig');
  let generation = 0;
  let running = false;
  function cancel() {
    generation++;
    running = false;
    state.visual.entry = null;
    home.inert = false;
    document.body.classList.remove('game-entering');
    wrap.style.removeProperty('transform');
    wrap.style.removeProperty('transform-origin');
  }
  function homeTransform() {
    const target = home.querySelector('.home-table').getBoundingClientRect();
    const matrix = svg.getScreenCTM();
    const corners = [
      [-365, -265],
      [365, 265],
    ].map(([u, v]) => {
      const [x, y] = P(...world(u, v, -1));
      return new DOMPoint(x, y).matrixTransform(matrix);
    });
    const rect = wrap.getBoundingClientRect();
    const sx = (target.width * 730) / 768 / (corners[1].x - corners[0].x);
    const sy = (target.height * 530) / 585 / (corners[1].y - corners[0].y);
    const tx =
      target.left + (target.width * 22) / 768 - rect.left - (corners[0].x - rect.left) * sx;
    const ty = target.top + (target.height * 12) / 585 - rect.top - (corners[0].y - rect.top) * sy;
    return { sx, sy, tx, ty };
  }
  function syncHome() {
    if (running || !state.visual.home) return;
    wrap.style.removeProperty('transform');
    ui.render();
    const { sx, sy, tx, ty } = homeTransform();
    wrap.style.transformOrigin = '0 0';
    wrap.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sx + ',' + sy + ')';
  }
  const ready = ui.ready().then(syncHome);
  const observer = new ResizeObserver(() => syncHome());
  observer.observe(home.querySelector('.home-table'));
  async function start() {
    if (running) return;
    await ready;
    if (running || !state.visual.home) return;
    wrap.style.removeProperty('transform');
    ui.render();
    const { sx, sy, tx, ty } = homeTransform();
    running = true;
    const token = ++generation;
    state.visual.entry = { time: 0, pitch: 90 };
    home.inert = true;
    document.body.classList.add('game-entering');
    wrap.style.transformOrigin = '0 0';
    const update = (time) => {
      const t = ease((time - 0.16) / 0.56);
      state.visual.entry.time = time;
      state.visual.entry.pitch = 90 - 22 * t;
      wrap.style.transform = `translate(${tx * (1 - t)}px,${ty * (1 - t)}px) scale(${sx + (1 - sx) * t},${sy + (1 - sy) * t})`;
    };
    update(0);
    ui.render();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    ui.animate((dt) => {
      if (token !== generation) return false;
      const time = reduced ? ENTRY_DURATION : state.visual.entry.time + dt;
      update(Math.min(time, ENTRY_DURATION));
      if (time < ENTRY_DURATION) return true;
      cancel();
      onComplete();
      return false;
    });
  }
  return {
    start,
    cancel,
    syncHome,
    get running() {
      return running;
    },
  };
}
