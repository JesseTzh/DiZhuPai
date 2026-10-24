import { CPUCanvas } from '../engine/cpu-canvas.js';
import { depthOf } from '../engine/camera.js';
import { tone, facing } from '../engine/shading.js';
import { hull, norm, cross, sub, avg, dot } from '../engine/math.js';
import { INK } from '../engine/palette.js';
import { cardOutline, cardW, cardH, cardStock } from '../cards/constants.js';
import { sackModel, NECK_R, NECK_H, pileZ, PUNCH_AT } from '../coins/sack.js';
import { coinShape, COIN_R, COIN_T } from '../coins/coin.js';
import { cardCream } from '../assets/cards/palette.js';
import { cardCoinGold } from '../assets/cards/back.js';

// Shared game objects sit above the generic Canvas surface and projection layer.
export class ModelCanvas extends CPUCanvas {
  static forContext(ctx) {
    return this.initializeModels(super.forContext(ctx));
  }
  static initializeModels(painter) {
    painter.models = new Map();
    painter.restCoins = new WeakMap();
    return painter;
  }
  constructor(svg) {
    super(svg);
    ModelCanvas.initializeModels(this);
  }
  cardGeometry(pose) {
    const { u, v, z = 2, scale = 0.86, flip = 0, thickness = 0.76 } = pose,
      ct = Math.cos(flip),
      st = Math.sin(flip);
    const c = [(u + v) / Math.SQRT2, (v - u) / Math.SQRT2, z + (Math.abs(st) * cardW * scale) / 2];
    const U = [ct / Math.SQRT2, -ct / Math.SQRT2, -st],
      V = [1 / Math.SQRT2, 1 / Math.SQRT2, 0],
      N = [st / Math.SQRT2, -st / Math.SQRT2, ct];
    const point = (a, b, h) => c.map((q, k) => q + scale * (a * U[k] + b * V[k] + h * N[k]));
    const A = cardOutline.map(([a, b]) => point(a, b, -thickness / 2)),
      B = cardOutline.map(([a, b]) => point(a, b, thickness / 2));
    return { A, B, U, V, N, c, point, scale, thickness };
  }
  card(g, image, options) {
    const { A, B, U, V, N, point, scale, thickness } = g,
      front = facing(N),
      ring = front ? B : A,
      ctx = this.ctx;
    ctx.save();
    // One stock silhouette and an affine print, rather than dozens of DOM faces.
    const silhouette = hull([...A, ...B].map((p) => this.project(p))),
      path = new Path2D();
    silhouette.forEach((p, i) => (i ? path.lineTo(...p) : path.moveTo(...p)));
    path.closePath();
    ctx.fillStyle = cardStock.m;
    ctx.fill(path);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke(path);
    if (options.deckCount) {
      // Paper edge layers expose the stack's height beneath the top print.
      for (let i = 1; i < options.deckCount; i++) {
        const h = thickness * (i / options.deckCount - 0.5);
        this.line(
          cardOutline.map(([a, b]) => point(a, b, h)),
          '#887e6b',
          0.3,
          true,
        );
      }
    }
    ctx.save();
    ctx.clip(this.path(ring));
    this.image(
      image,
      point(front ? -cardW / 2 : cardW / 2, -cardH / 2, (front ? 1 : -1) * (thickness / 2 + 0.01)),
      U.map((q) => q * scale * (front ? 1 : -1)),
      V.map((q) => q * scale),
      cardW,
      cardH,
    );
    ctx.restore();
    this.line(ring, options.selected ? '#d49c1f' : INK, options.selected ? 3 : 0.8, true);
    ctx.restore();
    return ring;
  }
  coinGeometry(c) {
    if (c.mode === 'rest' && this.restCoins.has(c)) return this.restCoins.get(c);
    const g = coinShape([c.x, c.y, c.z], c.a, c.b, c.psi);
    if (c.mode === 'rest') this.restCoins.set(c, g);
    return g;
  }
  coin(g, image, map = (p) => p) {
    const front = facing(g.n),
      cap = front ? g.B : g.A;
    for (let i = 0; i < g.A.length; i++) {
      const j = (i + 1) % g.A.length,
        n = norm(sub(avg([g.A[i], g.A[j], g.B[j], g.B[i]]), g.c));
      if (facing(n)) this.polygon([g.A[i], g.A[j], g.B[j], g.B[i]].map(map), tone(n, cardCoinGold));
    }
    this.polygon(cap.map(map), cardCoinGold.m, INK, 0.65);
    const center = avg(cap),
      r = COIN_R,
      sign = front ? 1 : -1;
    const origin = center.map((q, i) => q - r * g.u[i] + sign * r * g.v[i]);
    const U = sub(map(origin.map((q, i) => q + g.u[i])), map(origin));
    const V = sub(map(origin.map((q, i) => q - sign * g.v[i])), map(origin));
    this.image(image, map(origin), U, V, r * 2, r * 2);
  }
  sackGeometry(st, slot) {
    const key = [st.fillShow, st.squash, st.punchT].join(':');
    const cached = this.models.get(slot);
    if (cached?.key === key) return cached;
    const m = sackModel(st);
    const mesh = (rings, inside = false) => {
      const faces = [],
        normals = [];
      for (let i = 0; i < rings.length - 1; i++) {
        const A = rings[i],
          B = rings[i + 1],
          center = avg([...A, ...B]),
          row = [];
        for (let j = 0; j < A.length; j++) {
          const k = (j + 1) % A.length,
            q = [A[j], A[k], B[k], B[j]];
          let n = norm(cross(sub(q[1], q[0]), sub(q[3], q[0])));
          if (dot(n, sub(avg(q), center)) < 0) n = n.map((v) => -v);
          if (inside) n = n.map((v) => -v);
          faces.push({ q, n });
          row.push(n);
        }
        normals.push(row);
      }
      return { rings, faces, normals };
    };
    const body = mesh(m.body),
      outer = mesh(m.shell),
      inner = mesh(m.shell, true);
    const weave = [];
    const surface = (samples, color, width) =>
      weave.push({
        points: samples.map(([th, z]) => m.surf(th, z, 0.18)),
        normals: samples.map(([th, z]) => m.normal(th, z)),
        color,
        width,
      });
    for (let j = 0; j < 15; j++)
      for (const sign of [-1, 1])
        surface(
          Array.from({ length: 20 }, (_, i) => {
            const z = m.Hb * (0.13 + (0.65 * i) / 19);
            return [(j / 15) * 2 * Math.PI + (sign * (z - 0.13 * m.Hb)) / (m.Rb * 0.9), z];
          }),
          cardCream,
          0.65,
        );
    for (const t of [0.13, 0.78])
      surface(
        Array.from({ length: 65 }, (_, i) => [(i / 64) * 2 * Math.PI, m.Hb * t]),
        INK,
        0.6,
      );
    for (const dz of [0.5, 1.5, 2.5])
      surface(
        Array.from({ length: 65 }, (_, i) => [(i / 64) * 2 * Math.PI, m.Hb + dz]),
        cardCream,
        1.2,
      );
    const model = { key, m, body, outer, inner, weave };
    this.models.set(slot, model);
    return model;
  }
  sack(model, st, palette, pos, scale, coinImage) {
    const { m, body, outer, inner, weave } = model,
      map = (p) => p.map((q, i) => pos[i] + scale * (q - (i === 2 ? 0 : 48)));
    this.skin(body, palette, map);
    const ctx = this.ctx;
    for (const { points, normals, color, width } of weave) {
      const path = new Path2D();
      let run = false;
      for (let i = 0; i < points.length; i++) {
        if (!facing(normals[i])) {
          run = false;
          continue;
        }
        const p = this.project(map(points[i]));
        if (run) path.lineTo(...p);
        else path.moveTo(...p);
        run = true;
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width * scale;
      ctx.stroke(path);
    }
    const th = Math.PI / 4,
      z = m.Hb * 0.46,
      n = m.normal(th, z);
    if (facing(n)) {
      const o = m.surf(th, z, 0.4),
        u = norm(sub(m.surf(th - 0.01, z), m.surf(th + 0.01, z))),
        v = norm(sub(m.surf(th, z + 0.2), m.surf(th, z - 0.2))),
        r = m.Rb * 0.3;
      const origin = o.map((q, i) => q - r * u[i] + r * v[i]);
      this.image(
        coinImage,
        map(origin),
        u.map((q) => q * scale),
        v.map((q) => -q * scale),
        2 * r,
        2 * r,
      );
    }
    this.skin(inner, { l: palette.m, m: palette.d, d: palette.d }, map, true);
    const mouth = m.shell.at(-1);
    ctx.save();
    ctx.clip(this.path(mouth.map(map)));
    this.polygon(
      Array.from({ length: 32 }, (_, j) => map(m.at((j / 32) * 2 * Math.PI, m.Hb, NECK_R * 0.97))),
      palette.d,
    );
    if (pileZ(m) > m.Hb - 1) {
      const zp = pileZ(m),
        [x, y] = m.axis(zp);
      for (const [dx, dy, dz, a, b] of [
        [0, 0, 0.6, 0.15, 0.2],
        [3.2, 1.5, 0, 0.35, 1.9],
        [-2.8, 2.4, 0.2, 0.3, 3.6],
        [-1.5, -3.3, -0.1, 0.4, 5.1],
        [2.6, -2.6, 0.3, 0.25, 0.9],
      ])
        this.coin(coinShape([x + dx, y + dy, zp + dz + COIN_T / 2], a, b), coinImage, map);
    }
    const loose = [];
    for (const c of st.coins) {
      if (c.mode === 'rain' && c.z < m.Hb) continue;
      const g = this.coinGeometry(c);
      const inMouth =
        c.z < m.rimZ + COIN_R * 0.6 &&
        c.z > m.Hb - COIN_R &&
        Math.hypot(c.x - m.axis(m.top)[0], c.y - m.axis(m.top)[1]) < m.rimR;
      if (inMouth) this.coin(g, coinImage, map);
      else loose.push(g);
    }
    ctx.restore();
    this.skin(outer, palette, map);
    this.line(mouth.map(map), INK, 1.4 * scale, true);
    for (const delta of [-0.2, 0.16]) {
      const a = map(m.surf((75 * Math.PI) / 180, m.Hb + NECK_H / 2, 2.8)),
        b = map(m.surf((75 * Math.PI) / 180 + delta, m.Hb * (delta < 0 ? 0.84 : 0.76), 1));
      this.line([a, b], INK, 2.7 * scale);
      this.line([a, b], cardCream, 1.7 * scale);
    }
    loose.sort((a, b) => depthOf(a.c) - depthOf(b.c));
    for (const g of loose) this.coin(g, coinImage, map);
    if (st.punchT != null && st.punchT < 0.3) {
      const t = st.punchT / 0.3,
        o = m.surf(PUNCH_AT, m.zi, 2);
      for (let j = 0; j < 9; j++) {
        const a = (j / 9) * Math.PI * 2;
        this.line(
          [9 + 22 * t, 16 + 15 * t].map((r) =>
            map([o[0] + Math.cos(a) * r, o[1], o[2] + Math.sin(a) * r]),
          ),
          INK,
          1.2 * scale,
        );
      }
    }
  }
  dispose() {
    this.models.clear();
    super.dispose();
  }
}
