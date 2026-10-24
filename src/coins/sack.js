import { pd, rotV } from '../engine/camera.js';
import { norm, cross, sub, dot, avg } from '../engine/math.js';
import { vis, tone, toneI, mix } from '../engine/shading.js';
import { ink, fill, face, rod, castShadow } from '../engine/primitives.js';
import { cardCream, cardStock } from '../assets/cards/palette.js';
import { cardCoinGold } from '../assets/cards/back.js';
import { printOn } from './coin.js';

/* Money sack, cloth printed like the card back: a palette-coloured field with a cream diamond weave, an ink border
   band above and below, and the card's gold coin as an emblem on the front.
   Body:  a sack of revolution whose bulge grows with how full it is; empty it is lower, narrower and creased.
   Neck:  gathered to radius 9 and tied with a cream cord (knot and two ends lying on the shoulder).
   Mouth: a ruffled flare left open so coins can drop through the neck.
   Punch: from the viewer's front left (155°): a dent at the impact, a bulge opposite, then a damped sway away from it. */
export const SACK_X = 48,
  SACK_Y = 48,
  NECK_R = 9,
  NECK_H = 3.5,
  FLARE_H = 6.5;
export const PUNCH_AT = (155 * Math.PI) / 180;
const DECAL_AT = Math.PI / 4,
  KNOT_AT = (75 * Math.PI) / 180,
  NT = 32;
// body radius between the neck (0) and the widest point (1), at evenly spaced heights from the floor to the neck
const BODY_G = [0.62, 0.9, 0.98, 1, 0.97, 0.88, 0.7, 0.42, 0];
const BODY_T = [
  0, 0.03, 0.08, 0.14, 0.21, 0.29, 0.37, 0.45, 0.53, 0.61, 0.69, 0.76, 0.83, 0.89, 0.94, 0.975, 1,
];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function profile(t) {
  const x = clamp01(t) * (BODY_G.length - 1),
    i = Math.min(BODY_G.length - 2, Math.floor(x)),
    s = x - i;
  const g = (k) => BODY_G[Math.max(0, Math.min(BODY_G.length - 1, k))];
  const p0 = g(i - 1),
    p1 = g(i),
    p2 = g(i + 1),
    p3 = g(i + 2);
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * s +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s +
      (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s)
  );
}

// Dent and sway after a punch, t seconds after the hit (null = at rest).
export function punchPose(t) {
  if (t == null) return { D: 0, L: 0 };
  const hit = 0.07;
  if (t < hit) return { D: (0.42 * t) / hit, L: t / hit };
  const s = t - hit;
  return {
    D: Math.max(-0.05, 0.42 * Math.exp(-4.5 * s) * Math.cos(12 * s)),
    L: Math.exp(-3.5 * s) * Math.cos(8.5 * s),
  };
}

export function sackModel(st) {
  const F = st.fillShow,
    sq = st.squash,
    { D, L } = punchPose(st.punchT);
  const Rb = 21 + 10 * F,
    Hb = 28 + 18 * F,
    top = Hb + NECK_H + FLARE_H,
    zi = 0.42 * Hb;
  const away = [Math.cos(PUNCH_AT + Math.PI), Math.sin(PUNCH_AT + Math.PI)];
  const radius = (th, z) => {
    if (z <= Hb) {
      const t = Math.max(0, z / Hb);
      let r = NECK_R + (Rb - NECK_R) * profile(t);
      r *=
        1 +
        (1 - F) * 0.075 * Math.sin(6 * th + 2.4 * t) * Math.sin(Math.PI * Math.min(1, t * 1.15));
      if (D !== 0) {
        const d = angDiff(th, PUNCH_AT);
        r *=
          1 -
          D * Math.exp(-((d / 0.6) ** 2)) * Math.exp(-(((z - zi) / (0.32 * Hb)) ** 2)) +
          0.25 *
            Math.max(0, D) *
            Math.exp(-(((Math.abs(d) - Math.PI) / 1.1) ** 2)) *
            Math.sin(Math.PI * t);
      }
      return r * (1 + sq * 0.7);
    }
    if (z <= Hb + NECK_H) return NECK_R * (1 + sq * 0.3);
    const t = clamp01((z - Hb - NECK_H) / FLARE_H);
    return (NECK_R + 6.5 * (0.45 * t + 0.55 * t * t)) * (1 + 0.08 * t * Math.sin(9 * th + 0.4));
  };
  // the sway bends the sack over its planted base; a squash presses it down and out
  const at = (th, z, r) => {
    const k = L === 0 ? 0 : 9 * L * Math.pow(Math.min(1, Math.max(0, z) / top), 1.6);
    return [
      SACK_X + r * Math.cos(th) + away[0] * k,
      SACK_Y + r * Math.sin(th) + away[1] * k,
      z * (1 - sq),
    ];
  };
  const surf = (th, z, out = 0) => at(th, z, radius(th, z) + out);
  const normal = (th, z) =>
    norm(
      cross(sub(surf(th + 0.01, z), surf(th - 0.01, z)), sub(surf(th, z + 0.2), surf(th, z - 0.2))),
    );
  const ringAt = (z) => Array.from({ length: NT }, (_, j) => surf((j / NT) * 2 * Math.PI, z));
  const shellZ = [Hb, Hb + NECK_H, Hb + NECK_H + FLARE_H * 0.35, Hb + NECK_H + FLARE_H * 0.7, top];
  let body, shell;
  return {
    F,
    Rb,
    Hb,
    top,
    zi,
    D,
    at,
    surf,
    normal,
    radius,
    // Physics and transfer trajectories only need the axis and radius. Do not
    // tessellate a cloth mesh for those queries (several times per frame).
    get body() {
      return (body ??= BODY_T.map((t) => ringAt(t * Hb)));
    },
    get shell() {
      return (shell ??= shellZ.map(ringAt));
    },
    axis: (z) => at(0, Math.min(z, top), 0),
    rimZ: top * (1 - sq),
    rimR: NECK_R + 6.5,
  };
}

// Faces of a swept surface that face the viewer, and its contour: the edges between a visible and a hidden strip.
function skin(rings, colour, { inside = false, bottom = false, rims = false } = {}) {
  const n = rings[0].length,
    seen = [];
  let faces = '',
    edges = '';
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i],
      B = rings[i + 1],
      cen = avg([...A, ...B]),
      row = [];
    for (let j = 0; j < n; j++) {
      const q = [A[j], A[(j + 1) % n], B[(j + 1) % n], B[j]];
      let nr = norm(cross(sub(q[1], q[0]), sub(q[3], q[0])));
      if (dot(nr, sub(avg(q), cen)) < 0) nr = nr.map((v) => -v);
      if (inside) nr = nr.map((v) => -v);
      const on = vis(nr);
      row.push(on);
      if (on) faces += face(pd(q), colour(nr));
    }
    seen.push(row);
  }
  const seg = (p, q) => pd([p, q], false);
  for (let i = 0; i < seen.length; i++)
    for (let j = 0; j < n; j++)
      if (seen[i][(j + n - 1) % n] !== seen[i][j]) edges += seg(rings[i][j], rings[i + 1][j]);
  // the steps of the contour between rows, so it reads as one line
  if (!inside)
    for (let i = 0; i < seen.length - 1; i++)
      for (let j = 0; j < n; j++)
        if (seen[i][j] !== seen[i + 1][j]) edges += seg(rings[i + 1][j], rings[i + 1][(j + 1) % n]);
  if (bottom || rims)
    for (let j = 0; j < n; j++) {
      if (seen[0][j]) edges += seg(rings[0][j], rings[0][(j + 1) % n]);
      const k = seen.length - 1;
      if (rims && seen[k][j]) edges += seg(rings[k + 1][j], rings[k + 1][(j + 1) % n]);
    }
  return { faces, edges, seen };
}

// A line drawn on the body, split wherever it turns round the side out of view.
function onSurface(m, samples, out = 0.15) {
  let d = '',
    run = [];
  const flush = () => {
    if (run.length > 1) d += pd(run, false);
    run = [];
  };
  for (const [th, z] of samples) {
    if (vis(m.normal(th, z))) run.push(m.surf(th, z, out));
    else flush();
  }
  flush();
  return d;
}
const stroke = (d, c, w) =>
  d
    ? `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';

function weave(m) {
  const z0 = 0.13 * m.Hb,
    z1 = 0.78 * m.Hb,
    rr = m.Rb * 0.9;
  let cream = '',
    border = '';
  for (let k = 0; k < 15; k++)
    for (const s of [1, -1]) {
      const th0 = (k / 15) * 2 * Math.PI;
      cream += onSurface(
        m,
        Array.from({ length: 25 }, (_, i) => {
          const z = z0 + ((z1 - z0) * i) / 24;
          return [th0 + (s * (z - z0)) / rr, z];
        }),
      );
    }
  const around = (z) => Array.from({ length: 65 }, (_, i) => [(i / 64) * 2 * Math.PI, z]);
  border = onSurface(m, around(z0)) + onSurface(m, around(z1));
  const outer = onSurface(m, around(z0 - 2)) + onSurface(m, around(z1 + 2));
  return (
    stroke(cream, cardCream, 0.75) + stroke(outer, cardCream, 0.9) + stroke(border, '#292a28', 0.6)
  );
}

// Creases pressed into the cloth round the dent while it is deep.
function creases(m) {
  if (m.D < 0.12) return '';
  let d = '';
  for (const [dz, len] of [
    [-0.16, 0.5],
    [0, 0.62],
    [0.16, 0.5],
  ]) {
    const z = m.zi + dz * m.Hb;
    d += onSurface(
      m,
      Array.from({ length: 9 }, (_, i) => [PUNCH_AT + (i / 8 - 0.5) * len, z]),
      0.3,
    );
  }
  return stroke(d, '#292a28', 0.9 * Math.min(1, (m.D - 0.12) / 0.15));
}

// The card's coin printed on the front of the sack, on the plane touching the cloth at its centre.
function emblem(m) {
  const z = 0.46 * m.Hb,
    n = rotV(m.normal(DECAL_AT, z)),
    facingK = (n[0] + n[1] + n[2]) / Math.sqrt(3);
  if (facingK < 0.4) return '';
  const u = norm(sub(m.surf(DECAL_AT - 0.01, z), m.surf(DECAL_AT + 0.01, z))),
    w = norm(sub(m.surf(DECAL_AT, z + 0.2), m.surf(DECAL_AT, z - 0.2)));
  return printOn('coin-emblem', m.surf(DECAL_AT, z, 0.3), u, w, (0.3 * m.Rb) / 12.5);
}

function cord(m) {
  const z0 = m.Hb + 0.3,
    z1 = m.Hb + NECK_H - 0.3,
    ring = (z, r) => Array.from({ length: NT }, (_, j) => m.at((j / NT) * 2 * Math.PI, z, r));
  const rings = [ring(z0, NECK_R + 1), ring((z0 + z1) / 2, NECK_R + 2.1), ring(z1, NECK_R + 1)];
  const s = skin(rings, (n) => tone(n, cardStock), { bottom: true, rims: true });
  let twist = '';
  for (let j = 0; j < NT; j++)
    if (s.seen[0][j] && s.seen[1][j])
      twist += pd([rings[0][j], rings[1][(j + 1) % NT], rings[2][(j + 1) % NT]], false);
  return s.faces + ink(twist, 0.6) + ink(s.edges, 1.1);
}

function knot(m) {
  const zk = m.Hb + NECK_H / 2,
    out = [Math.cos(KNOT_AT), Math.sin(KNOT_AT), 0];
  const K = m.at(KNOT_AT, zk, NECK_R + 2.6),
    K1 = K.map((v, i) => v + out[i] * 1.6);
  const e1 = m.surf(KNOT_AT - 0.2, m.Hb * 0.84, 1),
    e2 = m.surf(KNOT_AT + 0.16, m.Hb * 0.76, 1);
  return (
    rod(K, e1, 1, cardStock, tone, 0.9) +
    rod(K, e2, 1, cardStock, tone, 0.9) +
    rod(K, K1, 2, cardStock, tone, 1)
  );
}

// contents: SVG of whatever lies inside the neck and mouth (seen only through the rim)
export function sackSvg(m, pal, contents) {
  const inner = { l: mix(pal.m, '#000000', 0.12), m: mix(pal.d, pal.m, 0.45), d: pal.d };
  const knotFront = vis(m.normal(KNOT_AT, m.Hb * 0.9));
  const body = skin(m.body, (n) => tone(n, pal), { bottom: true }),
    shellIn = skin(m.shell, (n) => toneI(n, inner), { inside: true }),
    shellOut = skin(m.shell, (n) => tone(n, pal)),
    rim = m.shell[m.shell.length - 1];
  const hole = Array.from({ length: NT }, (_, j) =>
    m.at((j / NT) * 2 * Math.PI, m.Hb, NECK_R * 0.97),
  );
  return (
    (knotFront ? '' : knot(m)) +
    body.faces +
    weave(m) +
    emblem(m) +
    creases(m) +
    ink(body.edges, 2.4) +
    shellIn.faces +
    `<clipPath id="sack-mouth"><path d="${pd(rim)}"/></clipPath><g clip-path="url(#sack-mouth)">${fill(pd(hole), pal.d)}${contents}</g>` +
    shellOut.faces +
    cord(m) +
    (knotFront ? knot(m) : '') +
    ink(shellOut.edges, 1.6) +
    ink(pd(rim), 1.4)
  );
}

// The heap of coins showing in the neck once the sack is nearly full.
export const pileZ = (m) => m.Hb - 3 + 7.5 * clamp01((m.F - 0.7) / 0.3);
export function pileFloor(m) {
  const z = pileZ(m),
    r = Math.min(m.radius(0, Math.max(z, m.Hb + 0.01)), NECK_R) * 0.98;
  const pts = Array.from({ length: NT }, (_, j) => m.at((j / NT) * 2 * Math.PI, z, r));
  return fill(pd(pts), cardCoinGold.d) + ink(pd(pts), 0.6);
}

export function sackShadow(m) {
  return castShadow(
    [...m.body.filter((_, i) => i % 2 === 0).flat(), ...m.shell[m.shell.length - 1]],
    0,
  );
}
