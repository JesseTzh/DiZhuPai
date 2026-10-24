import { sub, dot, cross, norm, hull } from '../engine/math.js';
import { INK, SHADOW } from '../engine/palette.js';

/* A low, level shop camera: x = right, y = into the shop, z = up.
 * Parts are convex meshes {points, faces:[{points, normal}], palette:[l, m, d], box}; each part draws its
 * visible faces in three flat tones, then one hull of ink. Parts sort by separating box, then by distance. */
export const LIGHT = norm([-0.35, -0.3, 1]);
const f1 = (v) => v.toFixed(1);
export const path = (pts, close = true) =>
  'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') + (close ? 'Z' : '');
export const ink = (d, w = 1, color = INK) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
export const lerp = (a, b, t) => a + (b - a) * t;
export const mixP = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const smooth = (t) => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};
// overshooting ease for things that snap into place
export const spring = (t) => {
  t = clamp01(t);
  return 1 - Math.cos(t * Math.PI * 2.6) * Math.exp(-t * 5.2);
};

export function makeCamera({ yaw, pitch, target, dist }) {
  const t = (yaw * Math.PI) / 180,
    p = (pitch * Math.PI) / 180;
  const F = [Math.sin(t) * Math.cos(p), Math.cos(t) * Math.cos(p), -Math.sin(p)],
    R = [Math.cos(t), -Math.sin(t), 0],
    U = [Math.sin(t) * Math.sin(p), Math.cos(t) * Math.sin(p), Math.cos(p)],
    eye = target.map((v, i) => v - F[i] * dist);
  const cam = {
    F,
    R,
    eye,
    k: 1,
    ox: 0,
    oy: 0,
    project(pt) {
      const q = sub(pt, eye),
        s = (dist / dot(q, F)) * cam.k;
      return [dot(q, R) * s + cam.ox, -dot(q, U) * s + cam.oy];
    },
    sees: (n, c) => dot(n, sub(c, eye)) < 0,
    far: (pt) => dot(sub(pt, eye), F),
    // screen vector of a small 3D step at pt (for text and decals lying on a face)
    axis(pt, d) {
      const a = cam.project(pt),
        b = cam.project(pt.map((v, i) => v + d[i]));
      return [b[0] - a[0], b[1] - a[1]];
    },
  };
  return cam;
}

export function tone(n, palette) {
  const d = dot(norm(n), LIGHT);
  return palette[d > 0.5 ? 0 : d > -0.2 ? 1 : 2];
}
export const pal = (l, m, d) => [l, m, d];

const boxOf = (points) =>
  [0, 1].map((end) =>
    [0, 1, 2].map((a) => (end ? Math.max : Math.min)(...points.map((p) => p[a]))),
  );
const centre = (pts) => [0, 1, 2].map((a) => pts.reduce((s, p) => s + p[a], 0) / pts.length);

/* ---------- builders: every builder pushes one convex part into a list ---------- */
export function meshFromRings(rings, palette, opts = {}) {
  const points = rings.flat(),
    mid = centre(points),
    faces = [];
  const addFace = (q) => {
    let n = cross(sub(q[1], q[0]), sub(q[q.length - 1], q[0]));
    if (!Number.isFinite(n[0]) || Math.hypot(...n) < 1e-9)
      n = cross(sub(q[2], q[1]), sub(q[0], q[1]));
    if (Math.hypot(...n) < 1e-9) return;
    if (dot(n, sub(centre(q), mid)) < 0) n = n.map((v) => -v);
    faces.push({ points: q, normal: norm(n) });
  };
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length;
      addFace([rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]]);
    }
  if (opts.caps) {
    addFace(rings[0]);
    addFace(rings.at(-1));
  }
  return { points, faces, palette, box: boxOf(points), ...opts.part };
}

export function orb(c, r, palette, opts = {}) {
  const [rx, ry, rz] = typeof r === 'number' ? [r, r, r] : r,
    nj = opts.rings || 8,
    ni = opts.seg || 16;
  const rings = Array.from({ length: nj + 1 }, (_, j) => {
    const b = -Math.PI / 2 + (j * Math.PI) / nj;
    return Array.from({ length: ni }, (_, i) => {
      const a = (i * 2 * Math.PI) / ni;
      const p = [rx * Math.cos(b) * Math.cos(a), ry * Math.cos(b) * Math.sin(a), rz * Math.sin(b)];
      return opts.turn ? opts.turn(p).map((v, k) => v + c[k]) : p.map((v, k) => v + c[k]);
    });
  });
  return meshFromRings(rings, palette, { part: opts.part });
}

// frustum between two points, closed at both ends
export function rod(a, b, r0, r1, palette, opts = {}) {
  const d = norm(sub(b, a)),
    u = norm(cross(d, Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])),
    v = cross(d, u),
    n = opts.seg || 14;
  const ring = (p, r) =>
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * 2 * Math.PI;
      return p.map((q, k) => q + r * (u[k] * Math.cos(t) + v[k] * Math.sin(t)));
    });
  return meshFromRings([ring(a, r0), ring(b, r1)], palette, { caps: true, part: opts.part });
}

export function block(x0, y0, z0, x1, y1, z1, palette, part = {}) {
  const ring = (z) => [
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z],
  ];
  return meshFromRings([ring(z0), ring(z1)], palette, {
    caps: true,
    part: { edges: true, ...part },
  });
}

// a convex outline in a plane, extruded by a thickness vector (cards, plaques, book covers)
export function slab(outline, thick, palette, part = {}) {
  return meshFromRings([outline, outline.map((p) => p.map((v, k) => v + thick[k]))], palette, {
    caps: true,
    part,
  });
}

// a smooth tube through centres (a neck, a dragon's body): one shaded skin and one outline, no joints
export function tube(centres, radii, palette, opts = {}) {
  const n = opts.seg || 14;
  let ref = [0, 0, 1];
  const rings = centres.map((c, i) => {
    const a = centres[Math.max(0, i - 1)],
      b = centres[Math.min(centres.length - 1, i + 1)],
      d = norm(sub(b, a));
    if (Math.abs(dot(d, ref)) > 0.92) ref = [1, 0, 0];
    const u = norm(cross(d, ref)),
      v = cross(d, u);
    return Array.from({ length: n }, (_, j) => {
      const t = (j / n) * 2 * Math.PI;
      return c.map((q, k) => q + radii[i] * (u[k] * Math.cos(t) + v[k] * Math.sin(t)));
    });
  });
  const part = meshFromRings(rings, palette, { part: opts.part });
  // outward normals per strip (the ring centre test, not the whole-tube centre)
  part.faces = [];
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n,
        q = [rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]];
      let nr = cross(sub(q[1], q[0]), sub(q[3], q[0]));
      const mid = centres[i].map((v, a) => (v + centres[i + 1][a]) / 2);
      if (dot(nr, sub(centre(q), mid)) < 0) nr = nr.map((x) => -x);
      part.faces.push({ points: q, normal: norm(nr) });
    }
  part.sortFaces = true;
  part.ink = 0;
  part.outline = { centres, radii, w: opts.ink || 2 };
  return part;
}
function tubeOutline(cam, { centres, radii, w }) {
  const sc = centres.map(cam.project),
    rs = centres.map((c, i) => {
      const e = cam.project(c.map((v, k) => v + radii[i] * cam.R[k]));
      return Math.hypot(e[0] - sc[i][0], e[1] - sc[i][1]);
    });
  const left = [],
    right = [];
  sc.forEach((p, i) => {
    const a = sc[Math.max(0, i - 1)],
      b = sc[Math.min(sc.length - 1, i + 1)],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
      nx = -(b[1] - a[1]) / l,
      ny = (b[0] - a[0]) / l;
    left.push([p[0] + nx * rs[i], p[1] + ny * rs[i]]);
    right.push([p[0] - nx * rs[i], p[1] - ny * rs[i]]);
  });
  const end = (i, from, to) => {
    const r = rs[i],
      sweep = 1;
    return `A${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${to[0].toFixed(1)} ${to[1].toFixed(1)}`;
  };
  const d =
    'M' +
    left.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') +
    end(sc.length - 1, left.at(-1), right.at(-1)) +
    'L' +
    right
      .reverse()
      .map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1))
      .join('L') +
    end(0, right.at(-1), left[0]);
  return ink(d, w);
}

/* ---------- drawing ---------- */
export function drawPart(part, cam) {
  let s = '';
  const faces = part.sortFaces
    ? part.faces
        .map((f) => [f, cam.far(centre(f.points))])
        .sort((a, b) => b[1] - a[1])
        .map((x) => x[0])
    : part.faces;
  for (const face of faces) {
    const c = centre(face.points);
    if (!cam.sees(face.normal, c)) continue;
    const col = part.flat || tone(face.normal, part.palette),
      d = path(face.points.map(cam.project));
    s += `<path d="${d}" fill="${col}" stroke="${part.edges ? INK : col}" stroke-width="${part.edges ? part.edgeW || 0.8 : 0.6}" stroke-linejoin="round"/>`;
  }
  if (part.ink !== 0) {
    const h = hull(part.points.map(cam.project));
    let a = 0,
      per = 0;
    for (let i = 0; i < h.length; i++) {
      const p = h[i],
        q = h[(i + 1) % h.length];
      a += p[0] * q[1] - q[0] * p[1];
      per += Math.hypot(q[0] - p[0], q[1] - p[1]);
    }
    // heavy ink on big bodies, light on small parts (thickness = 2 · area / perimeter)
    const thick = per ? Math.abs(a) / per : 0;
    s += ink(path(h), Math.min(part.ink || 2.2, 0.7 + thick * 0.09));
  }
  if (part.outline) s += tubeOutline(cam, part.outline);
  if (part.after) s += part.after(cam);
  return part.label ? `<g data-part="${part.label}">${s}</g>` : s;
}

function sepOrder(a, b, cam) {
  for (let k = 0; k < 3; k++) {
    if (a.box[1][k] <= b.box[0][k] + 1e-6) return cam.eye[k] > a.box[1][k] ? -1 : 1;
    if (b.box[1][k] <= a.box[0][k] + 1e-6) return cam.eye[k] > b.box[1][k] ? 1 : -1;
  }
  return 0;
}
export function drawParts(parts, cam) {
  const list = parts.filter(Boolean).map((p) => ({ p, far: cam.far(p.at || centre(p.box)) }));
  // insertion by pairwise test is cheap at this size and honours every separating box
  list.sort((a, b) => sepOrder(a.p, b.p, cam) || b.far - a.far);
  return list.map(({ p }) => drawPart(p, cam)).join('');
}

// text on a plane given by its right and up directions
export function planeText(cam, at, right, up, str, size, color = INK, extra = '') {
  const o = cam.project(at),
    u = cam.axis(at, right),
    v = cam.axis(
      at,
      up.map((x) => -x),
    );
  if (u[0] * v[1] - u[1] * v[0] <= 0) return '';
  return `<text transform="matrix(${u[0].toFixed(4)} ${u[1].toFixed(4)} ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${f1(o[0])} ${f1(o[1])})" font-size="${size}" fill="${color}" text-anchor="middle" ${extra}>${str}</text>`;
}

// flat blue shadow of parts on a level surface at height z0, pushed away from the light
export function shadowOf(parts, cam, z0, clip = null) {
  const k = 0.42,
    sx = -LIGHT[0] / LIGHT[2],
    sy = -LIGHT[1] / LIGHT[2];
  const d = parts
    .map((p) =>
      path(
        hull(
          p.points.map(([x, y, z]) =>
            cam.project([x + (z - z0) * sx * k, y + (z - z0) * sy * k, z0]),
          ),
        ),
      ),
    )
    .join('');
  const s = `<path d="${d}" fill="${SHADOW}" fill-rule="nonzero" opacity=".55"/>`;
  return clip ? `<g clip-path="url(#${clip})">${s}</g>` : s;
}
