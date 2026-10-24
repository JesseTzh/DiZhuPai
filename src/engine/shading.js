import { rotV } from './camera.js';
import { norm, dot } from './math.js';
const vis = (n) => {
  const r = rotV(n);
  return r[0] + r[1] + r[2] > 1e-6;
}; // viewer looks from (+1,+1,+1) after the turn
const facing = vis; // readable alias: is this face toward the viewer?
const SHADOW_K = 0.85,
  AZ_MIN = 20,
  AZ_MAX = 160;
// cast shadows are drawn shorter than the shading light implies (0.45 × height instead of 0.85 ×): long shadows of tall
// parts on thin supports (a lamp shade, a fan head) land far from the object and read as separate blobs
const SHADOW_LEN = 0.45;
let L = [0, 0, 1],
  SH = [0, 0];
function setLight(deg) {
  const a = (deg * Math.PI) / 180;
  SH = [SHADOW_K * Math.cos(a), SHADOW_K * Math.sin(a)];
  L = norm([-SH[0], -SH[1], 1]);
}
const LIN = norm([0.6, 0.2, 1]); // fixed light for interiors / small props
// Three flat tones, but blended across a narrow band at each step, so a face that turns past a threshold while the
// figure rotates fades between tones instead of snapping (at rest almost every face still sits on a pure tone).
const SOFT = 0.18;
const step3 = (d, hi, lo, m) => {
  const ss = (a, b, x) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  const a = ss(hi - SOFT, hi + SOFT, d),
    b = ss(lo - SOFT, lo + SOFT, d);
  return a >= 1 ? m.l : b <= 0 ? m.d : a > 0 ? mix(m.m, m.l, a) : b < 1 ? mix(m.d, m.m, b) : m.m;
};
const tone = (n, m) => step3(dot(rotV(n), L), -0.15, -0.45, m); // exterior, follows the sun
const toneI = (n, m) => step3(dot(rotV(n), LIN), 0.6, 0.05, m); // interior / props
const mix = (a, b, t) =>
  '#' +
  [1, 3, 5]
    .map((i) =>
      Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const matOf = (hex) => ({ l: hex, m: mix(hex, '#000000', 0.16), d: mix(hex, '#000000', 0.42) });
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export { vis, facing, SHADOW_K, SHADOW_LEN, SH, L, LIN, setLight, tone, toneI, mix, matOf, ease };
