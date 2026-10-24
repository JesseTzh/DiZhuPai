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
    this.origin = P(0, 0, 0);
    this.axes = [Dv(1, 0, 0), Dv(0, 1, 0), Dv(0, 0, 1)];
    this.perspective = hasPerspective();
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
    const [sx, sy] = SH,
      k = SHADOW_LEN / SHADOW_K,
      ctx = this.ctx;
    const projected = hull(
      points.map(([x, y, h]) => [x + (h - z) * sx * k, y + (h - z) * sy * k]),
    ).map(([x, y]) => [x, y, z]);
    if (clip) {
      ctx.save();
      ctx.clip(this.path(clip));
    }
    this.polygon(projected, SHADOW);
    if (clip) ctx.restore();
  }
  image(image, o, u, v, width, height) {
    if (this.perspective) return this.perspectiveImage(image, o, u, v, width, height);
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
    const steps = width > 50 ? 4 : 2,
      ctx = this.ctx,
      grid = Array.from({ length: steps + 1 }, (_, y) =>
        Array.from({ length: steps + 1 }, (_, x) =>
          this.project(
            o.map((q, k) => q + (u[k] * width * x) / steps + (v[k] * height * y) / steps),
          ),
        ),
      );
    const triangle = (a, b, c, sa, sb, sc) => {
      const det = (sb[0] - sa[0]) * (sc[1] - sa[1]) - (sc[0] - sa[0]) * (sb[1] - sa[1]);
      const axis = (k) => [
        ((b[k] - a[k]) * (sc[1] - sa[1]) - (c[k] - a[k]) * (sb[1] - sa[1])) / det,
        ((c[k] - a[k]) * (sb[0] - sa[0]) - (b[k] - a[k]) * (sc[0] - sa[0])) / det,
      ];
      const X = axis(0),
        Y = axis(1);
      ctx.save();
      ctx.beginPath();
      // Subpixel overlap prevents hairline seams between adjacent textured triangles.
      const center = [0, 1].map((k) => (a[k] + b[k] + c[k]) / 3);
      for (const [i, p] of [a, b, c].entries()) {
        const q = p.map((n, k) => n + (n - center[k]) * 0.006);
        if (i) ctx.lineTo(...q);
        else ctx.moveTo(...q);
      }
      ctx.closePath();
      ctx.clip();
      ctx.transform(
        X[0],
        Y[0],
        X[1],
        Y[1],
        a[0] - X[0] * sa[0] - X[1] * sa[1],
        a[1] - Y[0] * sa[0] - Y[1] * sa[1],
      );
      // Sample only this cell, with a texel gutter for the overlapping seams.
      // Drawing the complete texture for every triangle wastes raster work.
      const padX = width / image.width,
        padY = height / image.height,
        left = Math.max(0, Math.min(sa[0], sb[0], sc[0]) - padX),
        top = Math.max(0, Math.min(sa[1], sb[1], sc[1]) - padY),
        right = Math.min(width, Math.max(sa[0], sb[0], sc[0]) + padX),
        bottom = Math.min(height, Math.max(sa[1], sb[1], sc[1]) + padY);
      ctx.drawImage(
        image,
        left / padX,
        top / padY,
        (right - left) / padX,
        (bottom - top) / padY,
        left,
        top,
        right - left,
        bottom - top,
      );
      ctx.restore();
    };
    for (let y = 0; y < steps; y++)
      for (let x = 0; x < steps; x++) {
        const a = grid[y][x],
          b = grid[y][x + 1],
          c = grid[y + 1][x + 1],
          d = grid[y + 1][x];
        const sa = [(width * x) / steps, (height * y) / steps],
          sb = [(width * (x + 1)) / steps, sa[1]],
          sc = [sb[0], (height * (y + 1)) / steps],
          sd = [sa[0], sc[1]];
        triangle(a, b, c, sa, sb, sc);
        triangle(a, c, d, sa, sc, sd);
      }
  }
  skin(mesh, palette, map, inside = false) {
    const groups = new Map(),
      ctx = this.ctx,
      visible = mesh.normals.map((row) => row.map(facing));
    for (const { q, n } of mesh.faces)
      if (facing(n)) {
        const color = (inside ? toneI : tone)(n, palette);
        let path = groups.get(color);
        if (!path) groups.set(color, (path = new Path2D()));
        path.addPath(this.path(q.map(map)));
      }
    for (const [color, path] of groups) {
      ctx.fillStyle = ctx.strokeStyle = color;
      ctx.lineWidth = 0.35;
      ctx.fill(path);
      ctx.stroke(path);
    }
    const edges = new Path2D(),
      segment = (a, b) => {
        edges.moveTo(...this.project(map(a)));
        edges.lineTo(...this.project(map(b)));
      };
    for (let i = 0; i < visible.length; i++)
      for (let j = 0; j < visible[i].length; j++) {
        const k = (j + 1) % visible[i].length;
        if (visible[i][j] !== visible[i][k]) segment(mesh.rings[i][k], mesh.rings[i + 1][k]);
        if (!inside && i + 1 < visible.length && visible[i][j] !== visible[i + 1][j])
          segment(mesh.rings[i + 1][j], mesh.rings[i + 1][k]);
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
