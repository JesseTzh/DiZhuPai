import { P, Dv, hasPerspective } from './camera.js';
import { tone, toneI, facing, SH, SHADOW_K, SHADOW_LEN } from './shading.js';
import { hull } from './math.js';
import { INK, SHADOW } from './palette.js';
import { renderPixelRatio } from './render-pixel-ratio.js';

// Canvas projection, visibility, lighting and painter's ordering.
export class CPUCanvas {
  // Paint shared game models into a standalone canvas without touching the scene camera.
  static forContext(ctx) {
    const painter = Object.create(this.prototype);
    Object.assign(painter, {
      ctx,
      origin: [0, 0],
      axes: [Dv(1, 0, 0), Dv(0, 1, 0), Dv(0, 0, 1)],
    });
    return painter;
  }
  constructor(svg) {
    this.svg = svg;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'cpu-scene';
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
    this.foreign = document.createElementNS(svg.namespaceURI, 'foreignObject');
    this.foreign.style.pointerEvents = 'none';
    this.foreign.append(this.canvas);
    svg.insertBefore(this.foreign, svg.firstChild);
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D unavailable');
    this.size = svg.getBoundingClientRect();
    this.observer = new ResizeObserver(([entry]) => {
      this.size = entry.contentRect;
      svg.dispatchEvent(new Event('cpu-resize'));
    });
    this.observer.observe(svg);
    const tile = document.createElement('canvas');
    tile.width = tile.height = 64;
    const tileContext = tile.getContext('2d'),
      noise = tileContext.createImageData(64, 64);
    let seed = 37;
    for (let i = 3; i < noise.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      noise.data[i] = seed >>> 24;
    }
    tileContext.putImageData(noise, 0, 0);
    this.paper = this.ctx.createPattern(tile, 'repeat');
  }
  begin() {
    const svg = this.svg,
      view = svg.viewBox.baseVal,
      rect = this.size;
    // The chosen render scale is independent of the display pixel ratio.
    const ratio = renderPixelRatio(),
      w = Math.max(1, Math.round(rect.width * ratio)),
      h = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    for (const key of ['x', 'y', 'width', 'height']) {
      const value = String(view[key]);
      if (this.foreign.getAttribute(key) !== value) this.foreign.setAttribute(key, value);
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const scale = Math.min(w / view.width, h / view.height);
    ctx.setTransform(
      scale,
      0,
      0,
      scale,
      (w - view.width * scale) / 2 - view.x * scale,
      (h - view.height * scale) / 2 - view.y * scale,
    );
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Raster size and view transform: with the camera key, it decides when sprites expire.
    this.transform = `${w}x${h}|${scale}|${(w - view.width * scale) / 2 - view.x * scale}|${(h - view.height * scale) / 2 - view.y * scale}`;
    this.shadowRun = null;
    this.origin = P(0, 0, 0);
    this.axes = [Dv(1, 0, 0), Dv(0, 1, 0), Dv(0, 0, 1)];
    this.perspective = hasPerspective();
  }
  transformKey() {
    return this.transform;
  }
  finish(grain = 2.4) {
    if (!grain) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = grain * 0.009;
    ctx.fillStyle = this.paper;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }
  project(p) {
    if (this.perspective) return P(...p);
    const a = this.axes,
      o = this.origin;
    return [
      o[0] + p[0] * a[0][0] + p[1] * a[1][0] + p[2] * a[2][0],
      o[1] + p[0] * a[0][1] + p[1] * a[1][1] + p[2] * a[2][1],
    ];
  }
  path(points, closed = true) {
    const path = new Path2D();
    for (let i = 0; i < points.length; i++) {
      const p = this.project(points[i]);
      if (i) path.lineTo(...p);
      else path.moveTo(...p);
    }
    if (closed) path.closePath();
    return path;
  }
  polygon(points, color, stroke = null, width = 1) {
    const path = this.path(points),
      ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fill(path);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke(path);
    }
  }
  line(points, color = INK, width = 1, closed = false) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke(this.path(points, closed));
  }
  shadow(points, z = 0, clip = null) {
    this.addShadow(points, z);
    this.flushShadows(clip);
  }
  // Shadows are an opaque flat colour, so many small hulls may share one fill:
  // add each silhouette, then a single clipped flush paints them all.
  addShadow(points, z = 0) {
    this.addShadowRing(this.shadowRing(points, z));
  }
  // The projected outline a part casts on the plane at height z (view coordinates).
  shadowRing(points, z = 0) {
    const [sx, sy] = SH,
      k = SHADOW_LEN / SHADOW_K;
    return hull(points.map(([x, y, h]) => [x + (h - z) * sx * k, y + (h - z) * sy * k, z])).map(
      (p) => this.project(p),
    );
  }
  addShadowRing(ring) {
    const run = (this.shadowRun ??= new Path2D());
    for (let i = 0; i < ring.length; i++) {
      if (i) run.lineTo(ring[i][0], ring[i][1]);
      else run.moveTo(ring[i][0], ring[i][1]);
    }
    run.closePath();
  }
  // View-space bounding box [x0, y0, x1, y1] of projected points, grown by `pad` units.
  extent(points, pad = 0) {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const point of points) {
      const [x, y] = this.project(point);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }
  flushShadows(clip = null) {
    if (!this.shadowRun) return;
    const ctx = this.ctx;
    ctx.save();
    if (clip) ctx.clip(this.path(clip));
    ctx.fillStyle = SHADOW;
    ctx.fill(this.shadowRun);
    ctx.restore();
    this.shadowRun = null;
  }
  image(image, o, u, v, width, height) {
    if (this.perspective) {
      // Small or distant prints warp less than a fraction of a pixel across: one affine
      // drawImage then matches the tessellated triangles and skips their clip per cell.
      const a = this.project(o),
        b = this.project(o.map((q, k) => q + u[k] * width)),
        d = this.project(o.map((q, k) => q + v[k] * height)),
        c = this.project(o.map((q, k) => q + u[k] * width + v[k] * height)),
        ux = (b[0] - a[0]) / width,
        uy = (b[1] - a[1]) / width,
        vx = (d[0] - a[0]) / height,
        vy = (d[1] - a[1]) / height;
      if (
        Math.hypot(
          a[0] + (ux * width + vx * height) - c[0],
          a[1] + (uy * width + vy * height) - c[1],
        ) < 0.25
      ) {
        const ctx = this.ctx;
        ctx.save();
        ctx.transform(ux, uy, vx, vy, a[0], a[1]);
        ctx.drawImage(image, 0, 0, width, height);
        ctx.restore();
        return;
      }
      return this.perspectiveImage(image, o, u, v, width, height);
    }
    const ctx = this.ctx,
      O = this.project(o),
      U = Dv(...u),
      V = Dv(...v);
    ctx.save();
    ctx.transform(U[0], U[1], V[0], V[1], O[0], O[1]);
    ctx.drawImage(image, 0, 0, width, height);
    ctx.restore();
  }
  perspectiveImage(image, o, u, v, width, height) {
    // Tessellate the print so its corners follow the same projection as its solid body.
    // Each cell of a 3×3 grid is one affine drawImage fitted to its four projected corners
    // (mean of opposite edges, centred on the cell), so a hand card warps by under a tenth of
    // a view-box unit. Cells overlap their neighbours by one texel instead of clipping, which
    // hides seams without a clip per cell; the caller's outline clip trims the outer edge.
    const steps = width > 50 ? 3 : 2,
      ctx = this.ctx,
      cw = width / steps,
      ch = height / steps,
      padX = width / image.width,
      padY = height / image.height,
      grid = [];
    for (let y = 0; y <= steps; y++)
      for (let x = 0; x <= steps; x++)
        grid.push(this.project(o.map((q, k) => q + u[k] * cw * x + v[k] * ch * y)));
    const row = steps + 1;
    for (let y = 0; y < steps; y++)
      for (let x = 0; x < steps; x++) {
        const a = grid[y * row + x],
          b = grid[y * row + x + 1],
          c = grid[(y + 1) * row + x + 1],
          d = grid[(y + 1) * row + x];
        const ux = (b[0] - a[0] + c[0] - d[0]) / (2 * cw),
          uy = (b[1] - a[1] + c[1] - d[1]) / (2 * cw),
          vx = (d[0] - a[0] + c[0] - b[0]) / (2 * ch),
          vy = (d[1] - a[1] + c[1] - b[1]) / (2 * ch),
          left = x ? padX : 0,
          top = y ? padY : 0,
          right = x < steps - 1 ? padX : 0,
          bottom = y < steps - 1 ? padY : 0;
        ctx.save();
        ctx.transform(
          ux,
          uy,
          vx,
          vy,
          (a[0] + b[0] + c[0] + d[0]) / 4 - (ux * cw + vx * ch) / 2,
          (a[1] + b[1] + c[1] + d[1]) / 4 - (uy * cw + vy * ch) / 2,
        );
        ctx.drawImage(
          image,
          (x * cw - left) / padX,
          (y * ch - top) / padY,
          (cw + left + right) / padX,
          (ch + top + bottom) / padY,
          -left,
          -top,
          cw + left + right,
          ch + top + bottom,
        );
        ctx.restore();
      }
  }
  /* A lofted mesh: faces between consecutive rings, face (i, j) spanning ring i and i + 1
   * from vertex j to j + 1, with mesh.normals[i][j] its normal. Each vertex is projected once;
   * visible faces are filled per tone in one path each, then the silhouette edges are inked. */
  skin(mesh, palette, map, inside = false) {
    const ctx = this.ctx,
      shade = inside ? toneI : tone,
      rings = mesh.rings.map((ring) => ring.map((p) => this.project(map(p)))),
      visible = mesh.normals.map((row) => row.map(facing)),
      groups = new Map();
    for (let i = 0; i < visible.length; i++) {
      const A = rings[i],
        B = rings[i + 1],
        n = A.length;
      for (let j = 0; j < n; j++) {
        if (!visible[i][j]) continue;
        const color = shade(mesh.normals[i][j], palette),
          k = (j + 1) % n;
        let path = groups.get(color);
        if (!path) groups.set(color, (path = new Path2D()));
        path.moveTo(A[j][0], A[j][1]);
        path.lineTo(A[k][0], A[k][1]);
        path.lineTo(B[k][0], B[k][1]);
        path.lineTo(B[j][0], B[j][1]);
        path.closePath();
      }
    }
    ctx.lineWidth = 0.35;
    for (const [color, path] of groups) {
      ctx.fillStyle = ctx.strokeStyle = color;
      ctx.fill(path);
      ctx.stroke(path);
    }
    const edges = new Path2D(),
      segment = (a, b) => {
        edges.moveTo(a[0], a[1]);
        edges.lineTo(b[0], b[1]);
      };
    for (let i = 0; i < visible.length; i++)
      for (let j = 0; j < visible[i].length; j++) {
        const k = (j + 1) % visible[i].length;
        if (visible[i][j] !== visible[i][k]) segment(rings[i][k], rings[i + 1][k]);
        if (!inside && i + 1 < visible.length && visible[i][j] !== visible[i + 1][j])
          segment(rings[i + 1][j], rings[i + 1][k]);
      }
    ctx.strokeStyle = INK;
    ctx.lineWidth = inside ? 1.4 : 1.8;
    ctx.stroke(edges);
  }
  dispose() {
    this.observer.disconnect();
    this.foreign.remove();
    this.canvas.width = this.canvas.height = 0;
  }
}
