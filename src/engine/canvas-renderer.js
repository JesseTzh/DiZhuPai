/** Load one Canvas renderer and replay the latest state after its artwork is ready.
 * `host` (the figure) lends its frame driver, so the backend never runs its own loop. */
export function createCanvasRenderer(art, svg, load, host) {
  let backend,
    current,
    disposed = false;
  svg.dataset.renderer = 'pending';
  const draw = (state, material) => {
    current = [state, material];
    if (!disposed) backend?.draw(state, material);
  };
  draw.ready = (async () => {
    const module = await load();
    if (disposed) return;
    const next = await module.createRenderer(art, svg, host);
    if (disposed) {
      next.dispose?.();
      return;
    }
    backend = next;
    svg.dataset.renderer = 'cpu';
    if (current) backend.draw(...current);
  })();
  draw.dispose = (event) => {
    if (event?.persisted) return;
    disposed = true;
    backend?.dispose?.();
    removeEventListener('pagehide', draw.dispose);
  };
  addEventListener('pagehide', draw.dispose);
  return draw;
}
