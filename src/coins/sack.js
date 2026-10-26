import { norm, cross, sub } from '../engine/math.js';

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
const NT = 32;
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
  // A point lifted `out` off the cloth and the cloth normal there, sharing one radius
  // evaluation (forward differences): the renderer samples hundreds of these per shape.
  const frame = (th, z, out = 0) => {
    const r = radius(th, z),
      p = at(th, z, r),
      n = norm(
        cross(
          sub(at(th + 0.01, z, radius(th + 0.01, z)), p),
          sub(at(th, z + 0.2, radius(th, z + 0.2)), p),
        ),
      );
    return [out ? at(th, z, r + out) : p, n];
  };
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
    frame,
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

// The heap of coins showing in the neck once the sack is nearly full.
export const pileZ = (m) => m.Hb - 3 + 7.5 * clamp01((m.F - 0.7) / 0.3);
