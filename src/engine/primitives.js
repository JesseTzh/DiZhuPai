import { P, pd, sp, Dv, rotV, f } from './camera.js';
import { INK, SHADOW } from './palette.js';
import { avg, norm, cross, sub, dot, hull, on, PX, PY, PZ, ellUV, rrUV } from './math.js';
import { vis, tone, toneI, SHADOW_K, SHADOW_LEN, SH } from './shading.js';
/* ---------- drawing primitives (all return SVG strings) ---------- */
const ink = (d, w = 1.0) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const fill = (d, c, extra = '') => `<path d="${d}" fill="${c}" ${extra}/>`;
const face = (d, c) =>
  `<path d="${d}" fill="${c}" stroke="${c}" stroke-width=".7" stroke-linejoin="round"/>`;
const shape = (pts, c, w = 0.9) => fill(pd(pts), c) + (w ? ink(pd(pts), w) : '');
const line = (pts, w = 0.9) => ink(pd(pts, false), w);
// Loft between two rings of equal length (closed). colour(n) picks each strip's fill; flip = seen from inside.
function loft(A, B, colour, flip = false) {
  const n = A.length,
    cen = avg(A.concat(B));
  let s = '';
  for (let i = 0; i < n; i++) {
    const a0 = A[i],
      a1 = A[(i + 1) % n],
      b1 = B[(i + 1) % n],
      b0 = B[i];
    let nr = norm(cross(sub(a1, a0), sub(b0, a0)));
    if (!isFinite(nr[0])) continue;
    if (dot(nr, sub(avg([a0, a1, b1, b0]), cen)) < 0) nr = nr.map((v) => -v);
    if (flip) nr = nr.map((v) => -v);
    if (vis(nr)) s += face(pd([a0, a1, b1, b0]), colour(nr));
  }
  return s;
}
// Silhouette ink, weighted by how thick the part is on screen (like a hand inker): the w you pass is the most it gets.
// Thickness = 2 × area / perimeter of the outline (a rod's diameter, about half a box's width), as a share of the
// frame width. A long thin rod, a handle or a knob stays light (~1–1.5); a grinder, kettle or machine body gets the
// heavy ~2.4–2.8. Thin parts stay thin and parts keep air between them.
const hullInk = (pts3, w = 1.4) => {
  const h = hull(pts3.map((p) => P(...p)));
  let a = 0,
    per = 0;
  for (let i = 0; i < h.length; i++) {
    const p = h[i],
      q = h[(i + 1) % h.length];
    a += p[0] * q[1] - q[0] * p[1];
    per += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  const thick = per ? Math.abs(a) / per / (INK_K * INK_REF_VB) : 0;
  return ink(sp(h), Math.min(w, 0.9 + 20 * thick));
};
// Axis-aligned box: three visible faces, shaded, each outlined. shade = tone (sunlit) or toneI (interior).
function box(x0, y0, z0, x1, y1, z1, m, shade = toneI, w = 0.9) {
  // all six faces, drawn only when they face the viewer (sides first, then top) — correct in every VIEW
  const F = [
    [
      [0, 1, 0],
      [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
    ],
    [
      [1, 0, 0],
      [
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x1, y0, z1],
      ],
    ],
    [
      [0, -1, 0],
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
    ],
    [
      [-1, 0, 0],
      [
        [x0, y0, z0],
        [x0, y1, z0],
        [x0, y1, z1],
        [x0, y0, z1],
      ],
    ],
    [
      [0, 0, 1],
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
    ],
  ];
  return F.filter(([n]) => vis(n))
    .map(([n, q]) => shape(q, shade(n, m), w))
    .join('');
}
// Rounded-profile extrusion: profile (u=y, v=z) swept along x from x0 to x1. Body of most machines.
function extrude(profileUV, x0, x1, m, shade = tone) {
  return loft(on(PX(x0), profileUV), on(PX(x1), profileUV), (n) => shade(n, m));
}
// Vertical cylinder (axis z) centred (x,y), radius r from z0 to z1, with top cap.
function cyl(x, y, z0, z1, r, m, shade = toneI, w = 1.2, n = 24) {
  const A = on(PZ(z0), ellUV(x, y, r, r, n)),
    B = on(PZ(z1), ellUV(x, y, r, r, n));
  return (
    loft(A, B, (nr) => shade(nr, m)) +
    fill(pd(B), shade([0, 0, 1], m)) +
    hullInk([...A, ...B], w) +
    ink(pd(B), w * 0.8)
  );
}
// Cylinder lying along x (e.g. a knob or dial sticking out of a front face): centred (y,z), from x0 to x1.
function cylX(x0, x1, y, z, r, m, shade = toneI, w = 1.1, n = 20) {
  const A = on(PX(x0), ellUV(y, z, r, r, n)),
    B = on(PX(x1), ellUV(y, z, r, r, n));
  // cap on whichever end faces the viewer (the +x end in VIEW 0)
  const capB = vis([1, 0, 0]),
    cap = capB ? B : A,
    cn = capB ? [1, 0, 0] : [-1, 0, 0];
  return (
    loft(A, B, (nr) => shade(nr, m)) +
    (vis(cn) ? fill(pd(cap), shade(cn, m)) : '') +
    hullInk([...A, ...B], w) +
    (vis(cn) ? ink(pd(cap), w * 0.8) : '')
  );
}
// Cylinder between any two 3D points a and b (a lamp arm, a rod, a pipe at an angle, a handle bar), radius r.
// The end facing the viewer gets a cap. For a tapered part (a cone, a lamp shade) pass r1 for the radius at b.
function rod(a, b, r, m, shade = toneI, w = 1, r1 = r, n = 16) {
  const d = norm(sub(b, a)),
    u = norm(cross(d, Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])),
    v = cross(d, u);
  const ring = (p, rr) =>
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * 2 * Math.PI,
        c = Math.cos(t) * rr,
        s2 = Math.sin(t) * rr;
      return [
        p[0] + u[0] * c + v[0] * s2,
        p[1] + u[1] * c + v[1] * s2,
        p[2] + u[2] * c + v[2] * s2,
      ];
    });
  const A = ring(a, r),
    B = ring(b, r1),
    capB = vis(d),
    cap = capB ? B : A,
    cn = capB ? d : d.map((x) => -x);
  return (
    loft(A, B, (nr) => shade(nr, m)) +
    (Math.max(r, r1) > 0 ? fill(pd(cap), shade(cn, m)) + ink(pd(cap), w * 0.8) : '') +
    hullInk([...A, ...B], w)
  );
}
// Text lying flat on a front plane x = const, centred at (y,z) baseline; reads left-to-right on screen.
// text sits on a face: if its reading direction comes out mirrored (or edge-on), that face is turned away, so the text is hidden
const txM = (o, U, V) =>
  U[0] * V[1] - U[1] * V[0] <= 0.02 * Math.hypot(...U) * Math.hypot(...V)
    ? `matrix(0 0 0 0 ${f(o[0])} ${f(o[1])})`
    : `matrix(${U[0].toFixed(4)} ${U[1].toFixed(4)} ${V[0].toFixed(4)} ${V[1].toFixed(4)} ${f(o[0])} ${f(o[1])})`;
const tx = (x, y, z, str, size, col = INK, weight = 700) => {
  const o = P(x, y, z);
  return `<text transform="${txM(o, Dv(0, -1, 0), Dv(0, 0, -1))}" font-size="${size}" fill="${col}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="${weight}" letter-spacing=".04em">${str}</text>`;
};
// Text on a side plane y = const, centred at (x,z).
const txY = (x, y, z, str, size, col = INK, weight = 700) => {
  const o = P(x, y, z);
  return `<text transform="${txM(o, Dv(1, 0, 0), Dv(0, 0, -1))}" font-size="${size}" fill="${col}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="${weight}" letter-spacing=".04em">${str}</text>`;
};
// Cast shadow of a set of 3D points (any outline of the object), pushed along the light onto z = 0.
// z0: the surface it falls on (a board, a counter); clip it to that surface with clipTo(...) if it could spill off.
// clip: the 3D outline of the surface it falls on (e.g. boardTop(...)), so it can't spill over the edge.
const castShadow = (pts3, z0 = 0, clip = null) => {
  const k = SHADOW_LEN / SHADOW_K,
    [sx, sy] = SH;
  const s = fill(
    sp(hull(pts3.map(([x, y, z]) => P(x + (z - z0) * sx * k, y + (z - z0) * sy * k, z0)))),
    SHADOW,
  );
  return clip ? clipTo(clip, s) : s;
};
// A board for the object to stand on (a tray, a desk top, a counter): a rounded slab from (x0,y0) to (x1,y1), h thick.
// Draw it first; then castShadow(points, h, boardTop(x0,y0,x1,y1,h,r)) so shadows lie on it and stop at its edge.
const BOARD = { l: '#e6e1d4', m: '#cfc8b8', d: '#aaa293' },
  WOOD = { l: '#d9a86c', m: '#bf8a4f', d: '#8e6236' };
const boardTop = (x0, y0, x1, y1, h = 3, r = 5) => on(PZ(h), rrUV(x0, y0, x1, y1, r));
function board(x0, y0, x1, y1, h = 3, r = 5, m = BOARD) {
  const A = on(PZ(0), rrUV(x0, y0, x1, y1, r)),
    B = boardTop(x0, y0, x1, y1, h, r);
  return (
    loft(A, B, (n) => toneI(n, m)) + fill(pd(B), m.l) + ink(pd(B), 1) + hullInk([...A, ...B], 1.8)
  );
}
// Group helpers: clickable target, clip to an opening.
const act = (name, inner, data = '') => `<g data-act="${name}" ${data}>${inner}</g>`;
let _clipN = 0;
// Part label (for "how does it work" figures): a cream pill with a leader line to a 3D point on the part.
// dx, dy = where the pill sits, in screen units at the reference zoom (they scale with the figure like stroke widths).
// on = that part is working right now (the pill turns the accent colour). Labels can be hidden with the Labels switch.
function tag(p3, dx, dy, text, on = false) {
  const k = INK_K,
    [X, Y] = P(...p3),
    fs = 8.6 * k,
    h = fs * 1.8,
    w = text.length * fs * 0.62 + fs * 1.5,
    cx = X + dx * k,
    cy = Y + dy * k;
  return (
    `<g class="tag${on ? ' on' : ''}" data-t="${text}"><path d="M${f(X)} ${f(Y)}L${f(cx)} ${f(cy)}" fill="none" stroke="${INK}" stroke-width="1"/>` +
    `<circle cx="${f(X)}" cy="${f(Y)}" r="${f(1.3 * k)}" fill="${INK}"/>` +
    `<rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="${on ? 'var(--accent,#f4b829)' : '#fff4d6'}" stroke="${INK}" stroke-width="1.2"/>` +
    `<text x="${f(cx)}" y="${f(cy + fs * 0.36)}" font-size="${f(fs)}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="800" letter-spacing=".04em" fill="${INK}">${text}</text></g>`
  );
}
const clipTo = (pts3, inner) => {
  const id = 'k' + ++_clipN;
  return `<clipPath id="${id}"><path d="${pd(pts3)}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`;
};

/* ---------- constant on-screen line weight ----------
   Stroke widths are written in model units, and each figure is zoomed to fill the frame, so a small
   object would get fat lines. INK_K rescales every stroke-width (and the wobble/grain filter) so all
   figures match the reference zoom of the booth / vending machine (viewBox ≈ 585 units wide). */
const INK_REF_VB = 585;
let INK_K = 1;
const inkScale = (svg) =>
  INK_K === 1
    ? svg
    : svg.replace(
        /stroke-width="([\d.]+)"/g,
        (_, w) => `stroke-width="${(+w * INK_K).toFixed(2)}"`,
      );

const openShell = (A, B, colour, contents = '') =>
  loft(A, B, colour, true) + contents + loft(A, B, colour);
export function setInkScale(scale) {
  INK_K = scale;
}
export {
  ink,
  fill,
  face,
  shape,
  line,
  loft,
  hullInk,
  box,
  extrude,
  cyl,
  cylX,
  rod,
  txM,
  tx,
  txY,
  castShadow,
  boardTop,
  board,
  act,
  tag,
  clipTo,
  inkScale,
  INK_K,
  INK_REF_VB,
  openShell,
};
