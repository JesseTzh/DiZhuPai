/* ---------- 2D shapes in a plane's (u,v) coords (v up), mapped to 3D by a plane ---------- */
const arcUV = (cu, cv, r, a0, a1, n = 7) => {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    o.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]);
  }
  return o;
};
const rrUV = (u0, v0, u1, v1, r, n = 7) =>
  r <= 0
    ? rectUV(u0, v0, u1, v1)
    : [
        ...arcUV(u1 - r, v0 + r, r, -90, 0, n),
        ...arcUV(u1 - r, v1 - r, r, 0, 90, n),
        ...arcUV(u0 + r, v1 - r, r, 90, 180, n),
        ...arcUV(u0 + r, v0 + r, r, 180, 270, n),
      ];
const rectUV = (u0, v0, u1, v1) => [
  [u0, v0],
  [u1, v0],
  [u1, v1],
  [u0, v1],
];
const ellUV = (cu, cv, ru, rv, n = 24) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return [cu + ru * Math.cos(a), cv + rv * Math.sin(a)];
  });
const PX =
  (x) =>
  ([u, v]) => [x, u, v]; // front-facing plane x = const   (u = y, v = z)
const PY =
  (y) =>
  ([u, v]) => [u, y, v]; // side plane y = const           (u = x, v = z)
const PZ =
  (z) =>
  ([u, v]) => [u, v, z]; // horizontal plane z = const     (u = x, v = y)
const on = (plane, uv) => uv.map(plane);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const l = Math.hypot(...a) || 1;
  return a.map((v) => v / l);
};
const avg = (ps) =>
  ps.reduce(
    (s, p) => [s[0] + p[0] / ps.length, s[1] + p[1] / ps.length, s[2] + p[2] / ps.length],
    [0, 0, 0],
  );
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [],
    up = [];
  for (const p of pts) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (const p of pts.reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}

export { arcUV, rrUV, rectUV, ellUV, PX, PY, PZ, on, sub, dot, cross, norm, avg, hull };
