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
  return pitch;
}
export const hasPerspective = () => cameraDistance > 0;
const camDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const rotV = (n) => {
  const r = camDot(n, CAM_R),
    u = camDot(n, CAM_U),
    v = camDot(n, CAM_V);
  return [0, 1, 2].map((i) => CAM_B0.R[i] * r + CAM_B0.U[i] * u + CAM_B0.V[i] * v);
};
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
