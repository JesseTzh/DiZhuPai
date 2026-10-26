import { P } from '../engine/camera.js';
import { world } from '../game/table.js';

export const ENTRY_DURATION = 1.36;
const clamp = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => (t = clamp(t)) * t * (3 - 2 * t);

// Keep one canvas and one table model mounted from home through gameplay.
export function mountGameEntry({ home, state, ui, onComplete }) {
  const wrap = document.querySelector('.zwrap');
  const svg = document.getElementById('fig');
  const backdrop = home.querySelector('.home-table');
  let generation = 0;
  let running = false;
  let syncFrame = 0;
  function cancel() {
    generation++;
    running = false;
    state.visual.entry = null;
    home.inert = false;
    document.body.classList.remove('game-entering');
    wrap.style.removeProperty('transform');
    wrap.style.removeProperty('transform-origin');
  }
  // Map a world point to screen coordinates from the SVG's own viewBox instead of
  // getScreenCTM(): the latter can lag one style flush behind, and on phones the
  // rotate sequence is exactly when the viewport, safe-area insets and viewBox are
  // all still being rewritten. Everything here is read in one pass.
  function screenPoint(u, v, rect) {
    const vb = svg.viewBox.baseVal;
    const scale = Math.min(rect.width / vb.width, rect.height / vb.height),
      left = rect.left + (rect.width - vb.width * scale) / 2,
      top = rect.top + (rect.height - vb.height * scale) / 2;
    const [x, y] = P(...world(u, v, -1));
    return [left + (x - vb.x) * scale, top + (y - vb.y) * scale];
  }
  const CORNERS = [
    [-365, -265],
    [365, 265],
  ];
  function homeTransform() {
    const target = backdrop.getBoundingClientRect(),
      rect = wrap.getBoundingClientRect(),
      corners = CORNERS.map(([u, v]) => screenPoint(u, v, rect));
    const sx = (target.width * 730) / 768 / (corners[1][0] - corners[0][0]);
    const sy = (target.height * 530) / 585 / (corners[1][1] - corners[0][1]);
    const tx =
      target.left + (target.width * 22) / 768 - rect.left - (corners[0][0] - rect.left) * sx;
    const ty = target.top + (target.height * 12) / 585 - rect.top - (corners[0][1] - rect.top) * sy;
    return { sx, sy, tx, ty };
  }
  // What the framing depends on. Rotating a phone changes these in several steps
  // (viewport, safe-area insets, the rotated home composition), so a pass that
  // sees a different signature asks for one more.
  function layoutSignature() {
    const target = backdrop.getBoundingClientRect(),
      rect = wrap.getBoundingClientRect(),
      vb = svg.viewBox.baseVal;
    return [
      target.left,
      target.top,
      target.width,
      target.height,
      rect.left,
      rect.top,
      rect.width,
      rect.height,
      vb.width,
      vb.height,
    ]
      .map((value) => value.toFixed(2))
      .join('|');
  }
  function syncHome() {
    if (running || !state.visual.home) return null;
    wrap.style.removeProperty('transform');
    ui.render();
    const { sx, sy, tx, ty } = homeTransform();
    wrap.style.transformOrigin = '0 0';
    wrap.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sx + ',' + sy + ')';
    return layoutSignature();
  }
  // Coalesce bursts of resize/orientation events. A phone reports a rotation in
  // several steps (viewport, then safe-area insets, sometimes the dynamic viewport
  // last), so keep reframing while the layout keeps changing, then check once more
  // after the transition has surely ended.
  const LATE_SYNCS = [180, 600];
  let lateTimers = [];
  function scheduleSyncHome() {
    cancelAnimationFrame(syncFrame);
    lateTimers.forEach(clearTimeout);
    lateTimers = [];
    let signature = null;
    const settle = () => {
      const started = performance.now();
      const step = () => {
        if (!state.visual.home || running) {
          syncFrame = 0;
          return;
        }
        const next = syncHome(),
          changed = next === null || next !== signature;
        signature = next;
        if (changed && performance.now() - started < 800) syncFrame = requestAnimationFrame(step);
        else syncFrame = 0;
      };
      step();
    };
    settle();
    lateTimers = LATE_SYNCS.map((delay) => setTimeout(settle, delay));
  }
  const ready = ui.ready().then(scheduleSyncHome);
  const observer = new ResizeObserver(() => scheduleSyncHome());
  observer.observe(backdrop);
  observer.observe(wrap);
  addEventListener('resize', scheduleSyncHome);
  addEventListener('orientationchange', scheduleSyncHome);
  visualViewport?.addEventListener('resize', scheduleSyncHome);
  svg.addEventListener('cpu-resize', scheduleSyncHome);
  async function start() {
    if (running) return;
    await ready;
    if (running || !state.visual.home) return;
    cancelAnimationFrame(syncFrame);
    running = true;
    const token = ++generation;
    wrap.style.removeProperty('transform');
    ui.render();
    // Measured against the home framing: the first entry frame reproduces it
    // exactly (the phone layout interpolates from the same wide frame).
    const { sx, sy, tx, ty } = homeTransform();
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
    // Deferred: a page switch relayouts the backdrop in the same task.
    syncHome: scheduleSyncHome,
    get running() {
      return running;
    },
  };
}
