/* Retained sprites for a painter's-order Canvas scene.
 *
 * A part that looks the same as in the previous frame is painted once into its own
 * device-pixel canvas and then blitted at an integer offset. The sprite keeps the scene's
 * sub-pixel phase and source-over is associative, so the blit matches a direct paint;
 * only parts whose key repeats on consecutive frames pay for a sprite, so moving parts
 * cost nothing extra. A view change (camera, light, viewport, scale) drops every entry. */
const MARGIN = 2; // device pixels around the extent, for anti-aliased edges

export class SpriteCache {
  constructor() {
    this.view = null;
    this.live = new Map(); // key → { canvas, x, y, memo }
    this.seen = new Set(); // keys drawn directly in the previous frame
    this.used = new Set();
    this.pool = [];
  }
  // Start a frame; `view` must change whenever any cached pixel could change.
  begin(view) {
    if (view !== this.view) {
      this.view = view;
      for (const key of [...this.live.keys()]) this.evict(key);
      this.seen.clear();
    }
    this.used = new Set();
  }
  // Values derived from a part key (projected shadows, hit paths) live as long as its sprite.
  memo(key, name, compute) {
    if (key == null) return compute();
    let entry = this.live.get(key);
    if (!entry) this.live.set(key, (entry = { canvas: null, memo: new Map() }));
    this.used.add(key);
    if (!entry.memo.has(name)) entry.memo.set(name, compute());
    return entry.memo.get(name);
  }
  /* Paint one part. `extent` is [x0, y0, x1, y1] in view units, a function returning it
   * (evaluated only when a sprite is built), or null for the whole canvas. `paint(ctx)`
   * draws the part through the given context. */
  draw(painter, key, extent, paint) {
    const ctx = painter.ctx;
    if (key == null) return paint(ctx);
    this.used.add(key);
    let entry = this.live.get(key);
    if (!entry?.canvas && !this.seen.has(key)) {
      paint(ctx);
      this.seen.add(key);
      return;
    }
    if (!entry) this.live.set(key, (entry = { canvas: null, memo: new Map() }));
    if (!entry.canvas && !this.render(entry, ctx, extent, paint, painter)) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(entry.canvas, 0, 0, entry.w, entry.h, entry.x, entry.y, entry.w, entry.h);
    ctx.restore();
  }
  render(entry, ctx, extent, paint, painter) {
    const m = ctx.getTransform(),
      { width, height } = ctx.canvas;
    let x0 = 0,
      y0 = 0,
      x1 = width,
      y1 = height;
    if (extent) {
      if (typeof extent === 'function') extent = extent();
      const xs = [],
        ys = [];
      for (const [x, y] of [
        [extent[0], extent[1]],
        [extent[2], extent[1]],
        [extent[0], extent[3]],
        [extent[2], extent[3]],
      ]) {
        xs.push(m.a * x + m.c * y + m.e);
        ys.push(m.b * x + m.d * y + m.f);
      }
      x0 = Math.max(0, Math.floor(Math.min(...xs)) - MARGIN);
      y0 = Math.max(0, Math.floor(Math.min(...ys)) - MARGIN);
      x1 = Math.min(width, Math.ceil(Math.max(...xs)) + MARGIN);
      y1 = Math.min(height, Math.ceil(Math.max(...ys)) + MARGIN);
    }
    const w = x1 - x0,
      h = y1 - y0;
    if (!(w > 0 && h > 0)) return false;
    const canvas = this.take(w, h),
      sprite = canvas.getContext('2d');
    sprite.setTransform(1, 0, 0, 1, 0, 0);
    sprite.clearRect(0, 0, w, h);
    sprite.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
    sprite.lineJoin = ctx.lineJoin;
    sprite.lineCap = ctx.lineCap;
    painter.ctx = sprite;
    try {
      paint(sprite);
    } finally {
      painter.ctx = ctx;
    }
    Object.assign(entry, { canvas, x: x0, y: y0, w, h });
    return true;
  }
  // Reuse a released canvas that is large enough without wasting much of it.
  take(w, h) {
    const i = this.pool.findIndex(
      (c) => c.width >= w && c.height >= h && c.width * c.height <= 2 * w * h,
    );
    if (i >= 0) return this.pool.splice(i, 1)[0];
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }
  evict(key) {
    const entry = this.live.get(key);
    if (entry?.canvas && this.pool.length < 48) this.pool.push(entry.canvas);
    this.live.delete(key);
  }
  // Release parts that were not drawn this frame; remember direct paints for the next one.
  end() {
    for (const key of [...this.live.keys()]) if (!this.used.has(key)) this.evict(key);
    for (const key of [...this.seen]) if (!this.used.has(key)) this.seen.delete(key);
  }
  clear() {
    for (const key of [...this.live.keys()]) this.evict(key);
    this.seen.clear();
    this.pool.length = 0;
    this.view = null;
  }
}
