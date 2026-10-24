import { P, Dv, f, pd } from '../engine/camera.js';
import { norm, cross, avg } from '../engine/math.js';
import { vis, tone } from '../engine/shading.js';
import { fill, loft, hullInk, castShadow } from '../engine/primitives.js';
import { cardCoinGold, cardCoinPrint } from '../assets/cards/back.js';

/* A struck gold coin: the card back's printed coin on both faces, a short banded rim between them.
   Proportions follow a chunky gold piece (thickness ≈ 14% of the diameter). */
export const COIN_R = 5.2,
  COIN_T = 1.5;
const COIN_ART_R = 12.5; // radius of the printed coin in card units
const RING = 18;

// The print is defined once and placed with an affine matrix per face. Its strokes are thickened so the card's ink
// weights still read after the coin print is shrunk onto a small coin or stretched over the sack.
const printDef = (id, k) =>
  `<g id="${id}">${cardCoinPrint().replace(/stroke-width="([\d.]+)"/g, (_, w) => `stroke-width="${(+w * k).toFixed(2)}"`)}</g>`;
export const coinDefs = () =>
  `<defs id="coin-defs">${printDef('coin-print', 1.9)}${printDef('coin-emblem', 1.25)}</defs>`;

// Map the print onto a plane through o3 spanned by u (art x) and w (art up). A face seen edge-on prints nothing;
// a face seen from behind is turned over so the print never reads mirrored.
export function printOn(id, o3, u, w, k) {
  const o = P(...o3),
    U = Dv(...u.map((v) => v * k));
  let V = Dv(...w.map((v) => -v * k));
  const det = U[0] * V[1] - U[1] * V[0];
  if (Math.abs(det) < 0.06 * Math.hypot(...U) * Math.hypot(...V)) return '';
  if (det < 0) V = V.map((v) => -v);
  return `<use href="#${id}" transform="matrix(${U[0].toFixed(4)} ${U[1].toFixed(4)} ${V[0].toFixed(4)} ${V[1].toFixed(4)} ${f(o[0])} ${f(o[1])})"/>`;
}

// a = tilt of the face normal from vertical, b = its heading, psi = turn of the coin about its own axis.
export function coinShape(c, a, b, psi = 0) {
  const n = [Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b), Math.cos(a)];
  const u0 = [-Math.sin(b), Math.cos(b), 0],
    v0 = norm(cross(n, u0));
  const cp = Math.cos(psi),
    sp2 = Math.sin(psi);
  const u = u0.map((x, i) => x * cp + v0[i] * sp2),
    v = u0.map((x, i) => -x * sp2 + v0[i] * cp);
  const ring = (o) =>
    Array.from({ length: RING }, (_, i) => {
      const t = (i / RING) * 2 * Math.PI,
        cu = Math.cos(t) * COIN_R,
        cv = Math.sin(t) * COIN_R;
      return [0, 1, 2].map((k) => c[k] + n[k] * o + u[k] * cu + v[k] * cv);
    });
  const A = ring(-COIN_T / 2),
    B = ring(COIN_T / 2),
    all = [...A, ...B];
  const lo = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k]))),
    hi = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])));
  return { c, n, u, v, A, B, box: [lo, hi] };
}

export function coinSvg(g) {
  const up = vis(g.n),
    cap = up ? g.B : g.A;
  return (
    loft(g.A, g.B, (nr) => tone(nr, cardCoinGold)) +
    fill(pd(cap), cardCoinGold.m) +
    printOn('coin-print', avg(cap), g.u, g.v, COIN_R / COIN_ART_R) +
    hullInk([...g.A, ...g.B], 1.3)
  );
}

export const coinShadow = (g) => castShadow([...g.A, ...g.B], 0);
