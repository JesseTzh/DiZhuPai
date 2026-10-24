import { mountZoom } from './zoom.js';

/** Page layout previously injected by the standalone-page generator. */
export function mountEnhancements() {
  mountZoom();
  const wrap = document.querySelector('.zwrap');
  const switches = document.querySelector('.vset');
  if (switches) wrap.after(switches);
  wrap.append(document.getElementById('toast'));

  const fig = document.getElementById('fig');
  const fit = () => {
    fig.style.maxHeight = '';
    const extra = document.documentElement.scrollHeight - fig.clientHeight;
    const room = innerHeight - extra - 12;
    if (room < fig.clientHeight) fig.style.maxHeight = Math.max(320, room) + 'px';
  };
  addEventListener('load', () => requestAnimationFrame(fit));
  addEventListener('resize', fit);
  setTimeout(fit, 400);
}
