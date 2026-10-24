// Zoom and pan scale the complete scene with a CSS transform.
export function mountZoom({ controls = true } = {}) {
  const fig = document.getElementById('fig');
  if (!fig) return;
  const wrap = document.createElement('div');
  wrap.className = 'zwrap';
  fig.parentNode.insertBefore(wrap, fig);
  wrap.appendChild(fig);
  const chip = document.createElement('div');
  chip.className = 'zchip';
  chip.innerHTML =
    '<button class="zm" aria-label="Zoom out">−</button><button class="zp" aria-label="Reset zoom">100%</button><button class="zi" aria-label="Zoom in">+</button>';
  if (controls) wrap.appendChild(chip);
  let s = 1,
    tx = 0,
    ty = 0;
  const box = () => ({ w: fig.clientWidth, h: fig.clientHeight });
  const apply = () => {
    const { w, h } = box();
    s = Math.min(5, Math.max(1, s));
    if (s <= 1.001) {
      s = 1;
      tx = ty = 0;
    } else {
      tx = Math.min(0, Math.max(w - w * s, tx));
      ty = Math.min(0, Math.max(h - h * s, ty));
    }
    fig.style.transform = s === 1 ? '' : `translate(${tx}px,${ty}px) scale(${s})`;
    wrap.classList.toggle('on', s > 1);
    document.documentElement.classList.toggle(
      'zoomed',
      s > 1,
    ); /* desktop: nothing is cut off, the page just does not scroll while zoomed */
    chip.querySelector('.zp').textContent = Math.round(s * 100) + '%';
    grain();
  };
  // the paper grain is noise in drawing units: zoomed, it would blow up into blotches, so its frequency rises with the
  // zoom and it stays the same fine grain on screen (the fine-grain primitive is kept alive through resize)
  const grain = () => {
    const fl = document.getElementById('hand');
    if (!fl) return;
    const ts = [...fl.querySelectorAll('feTurbulence')];
    if (!ts.length) return;
    const g =
      ts.find((t) => t.getAttribute('result') === 'n1') ||
      ts.reduce((a, b) =>
        parseFloat(b.getAttribute('baseFrequency')) > parseFloat(a.getAttribute('baseFrequency'))
          ? b
          : a,
      );
    if (!g.dataset.f0) g.dataset.f0 = g.getAttribute('baseFrequency');
    const v = (parseFloat(g.dataset.f0) * s).toFixed(4);
    if (g.getAttribute('baseFrequency') !== v) g.setAttribute('baseFrequency', v);
  };
  const fd = document.getElementById('fdefs');
  if (fd) new MutationObserver(() => grain()).observe(fd, { childList: true, subtree: true });
  const zoomAt = (k, px, py) => {
    const s2 = Math.min(5, Math.max(1, s * k));
    tx = px - ((px - tx) * s2) / s;
    ty = py - ((py - ty) * s2) / s;
    s = s2;
    apply();
  };
  const local = (e) => {
    const r = wrap.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  wrap.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const [x, y] = local(e);
        zoomAt(
          Math.exp(-Math.max(-50, Math.min(50, e.deltaY)) * 0.006),
          x,
          y,
        ); /* a wheel notch ~1.35x, a pinch stays smooth */
      } else if (s > 1) {
        e.preventDefault();
        tx -= e.deltaX;
        ty -= e.deltaY;
        apply();
      }
    },
    { passive: false },
  );
  const center = () => {
    const { w, h } = box();
    return [w / 2, h / 2];
  };
  chip.querySelector('.zi').onclick = () => zoomAt(1.5, ...center());
  chip.querySelector('.zm').onclick = () => zoomAt(1 / 1.5, ...center());
  chip.querySelector('.zp').onclick = () => {
    s = 1;
    apply();
  };
  chip.addEventListener('pointerdown', (e) => e.stopPropagation());
  addEventListener('resize', apply);
}
