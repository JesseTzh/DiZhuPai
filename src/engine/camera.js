/* ---------- projection (x = depth toward viewer-right, y = toward viewer-left, z = up) ---------- */
const C = Math.cos(Math.PI / 6),
  S = Math.sin(Math.PI / 6);
let OX = 0,
  OY = 0;
/* Fixed heading; only pitch changes. rotV keeps shading aligned with the view. */
let RC = [0, 0],
  RCZ = 0;
const CAM_K = Math.sqrt(1.5);
const camBasis = (yaw, pitch) => {
  const t = (yaw * Math.PI) / 180,
    p = (pitch * Math.PI) / 180,
    ct = Math.cos(t),
    st = Math.sin(t),
    cp = Math.cos(p),
    sp2 = Math.sin(p);
  return { R: [st, -ct, 0], U: [-sp2 * ct, -sp2 * st, cp], V: [cp * ct, cp * st, sp2] };
};
const CAM_B0 = camBasis(45, (Math.atan(1 / Math.SQRT2) * 180) / Math.PI),
  CAM_R = [1 / Math.SQRT2, -1 / Math.SQRT2, 0],
  CAM_U = [-1 / Math.SQRT2, -1 / Math.SQRT2, 0],
  CAM_V = [0, 0, 1],
  CAM_D = CAM_U.map((v) => -v);
let cameraDistance = 0;
let cameraPitch = 90;
export const cameraView = () => ({ pitch: cameraPitch, distance: cameraDistance });
export function setCameraPitch(degrees, distance = 0) {
  const pitch = Number.isFinite(degrees) ? Math.max(40, Math.min(90, degrees)) : 68;
  const basis =
    pitch === 90 ? { U: [-1 / Math.SQRT2, -1 / Math.SQRT2, 0], V: [0, 0, 1] } : camBasis(45, pitch);
  for (let i = 0; i < 3; i++) {
    CAM_U[i] = basis.U[i];
    CAM_D[i] = -basis.U[i];
    CAM_V[i] = basis.V[i];
  }
  cameraDistance = Math.max(0, distance);
  cameraPitch = pitch;
  refold();
  return pitch;
}
export const hasPerspective = () => cameraDistance > 0;
const camDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const rotV = (n) => {
  const r = camDot(n, CAM_R),
    u = camDot(n, CAM_U),
    v = camDot(n, CAM_V),
    { R, U, V } = CAM_B0;
  return [
    R[0] * r + U[0] * u + V[0] * v,
    R[1] * r + U[1] * u + V[1] * v,
    R[2] * r + U[2] * u + V[2] * v,
  ];
};
/* vis() and tone() ask two scalar questions about rotV(n) — the component sum and a dot with
 * a light — for every face of every part each frame. Both are linear in n, so each folds into
 * one world-space vector, refreshed on pitch and light changes; the hot queries then cost a
 * single dot product and allocate nothing. */
const foldVec = (w) => [0, 1, 2].map((j) => CAM_R[j] * w[0] + CAM_U[j] * w[1] + CAM_V[j] * w[2]);
let foldedLights = null;
export let visDot = null,
  lightDots = null;
function refold() {
  const B0 = CAM_B0,
    sumVis = [
      B0.R[0] + B0.R[1] + B0.R[2],
      B0.U[0] + B0.U[1] + B0.U[2],
      B0.V[0] + B0.V[1] + B0.V[2],
    ],
    vis = foldVec(sumVis);
  visDot = (n) => camDot(n, vis);
  lightDots = foldedLights
    ? foldedLights.map((l) => foldVec([camDot(B0.R, l), camDot(B0.U, l), camDot(B0.V, l)]))
    : null;
}
export function foldLights(lights) {
  foldedLights = lights;
  refold();
}
refold();
const P = (x, y, z) => {
  const q = [x - RC[0], y - RC[1], z - RCZ];
  const scale = cameraDistance
    ? cameraDistance / Math.max(1, cameraDistance - camDot(q, CAM_V))
    : 1;
  return [
    scale * CAM_K * camDot(q, CAM_R) + (RC[0] - RC[1]) * C + OX,
    scale * CAM_K * camDot(q, CAM_D) + (RC[0] + RC[1]) * S - RCZ + OY,
  ];
};
const Dv = (x, y, z) => [CAM_K * camDot([x, y, z], CAM_R), CAM_K * camDot([x, y, z], CAM_D)];
// distance toward the viewer: draw parts with smaller depth first
const depthOf = (p) => camDot(p, CAM_V);
// sort [{at:[x,y,z], svg}] back-to-front for the current camera. A part may also give box:[[x0,y0,z0],[x1,y1,z1]]:
// when two boxes are separated along x, y or z, the one on the viewer's side goes last (a centre point alone gets long
// or wrapping parts wrong: a pole beside a row of keys, a spout reaching past a cup).
const boxMid = (b) => [0, 1, 2].map((k) => (b[0][k] + b[1][k]) / 2);
const sepOrder = (p, q) => {
  if (!p.box || !q.box) return 0;
  for (let k = 0; k < 3; k++) {
    if (CAM_V[k] === 0) continue;
    if (p.box[1][k] <= q.box[0][k] + 1e-6) return CAM_V[k] >= 0 ? -1 : 1;
    if (q.box[1][k] <= p.box[0][k] + 1e-6) return CAM_V[k] >= 0 ? 1 : -1;
  }
  return 0;
};
const byDepth = (parts) =>
  parts
    .filter(Boolean)
    .sort(
      (p, q) => sepOrder(p, q) || depthOf(p.at || boxMid(p.box)) - depthOf(q.at || boxMid(q.box)),
    )
    .map((p) => p.svg)
    .join('');
// sepOrder cannot order a sort by itself: three mutually offset boxes can separate along different
// axes (a cycle), and the sort then scrambles rows of overlapping cards — one card covered from both
// sides. Scene sorts use this scalar key instead: back-to-front by part depth, for the flat cards on
// the table exactly their stacking z.
export const paintOrder = (a, b) => depthOf(a.at ?? boxMid(a.box)) - depthOf(b.at ?? boxMid(b.box));
// the half of a vertical ring that faces the viewer / is turned away, as [from, to] angles in degrees (0 = +x, 90 = +y)
const nearHalf = () => [-45, 135],
  farHalf = () => [135, 315];
// an open container (cup, bin, cone, drum) between two rings: far inner wall, then its contents, then the near outer wall

const f = (v) => v.toFixed(1);
const pd = (pts, close = true) =>
  'M' +
  pts
    .map((p) => {
      const q = P(p[0], p[1], p[2]);
      return f(q[0]) + ' ' + f(q[1]);
    })
    .join('L') +
  (close ? 'Z' : '');
const sp = (pts) => 'M' + pts.map((q) => f(q[0]) + ' ' + f(q[1])).join('L') + 'Z';

export function setOrigin(x, y) {
  OX = x;
  OY = y;
}
export function setCenter(xy, z) {
  RC = xy;
  RCZ = z;
}
export {
  C,
  S,
  OX,
  OY,
  RC,
  RCZ,
  CAM_V,
  camDot,
  rotV,
  P,
  Dv,
  depthOf,
  boxMid,
  sepOrder,
  byDepth,
  nearHalf,
  farHalf,
  f,
  pd,
  sp,
};
