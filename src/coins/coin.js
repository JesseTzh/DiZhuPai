import { norm, cross } from '../engine/math.js';

/* A struck gold coin: the card back's printed coin on both faces, a short banded rim between them.
   Proportions follow a chunky gold piece (thickness ≈ 14% of the diameter). */
export const COIN_R = 5.2,
  COIN_T = 1.5;
const RING = 18;

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
