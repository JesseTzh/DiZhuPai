import { orb as orbMesh, rod as rodMesh, slab, planeText, path, ink, lerp } from './stage3d.js';
import { norm } from '../engine/math.js';
import { palettes } from './toy-palettes.js';
import { dragon } from './toy-dragon.js';

/* Solid vinyl toys in toy units (≈ 1 cm × 3), +y toward the viewer, z up.
 * frog:   haunches / feet / toes, belly, head, eyes, cheeks; a sticky tongue that shoots a playing card up.
 * hand:   cuff / wrist / palm, four upright fingers and a side thumb; a bandage forces two fingers together.
 * dragon: low humped body that the toy pulls longer in three ever harder struggles, four legs with claws,
 *         dorsal fins, tail tuft, head with antlers, mane and whiskers.
 * Every pose is a plain object of numbers, so a shop animation can blend between them.
 * toyGeometry(id) keeps the resting pose for the toys standing on the game table. */

export const REST = {
  frog: { mouth: 0, tongue: 0, card: 0, spin: 0 },
  hand: { bind: 0, wrap: 0, knot: 0, splay: 0, shake: 0 },
  dragon: {
    length: 42,
    hump: 1,
    phase: 0,
    jitter: 0,
    hop: 0,
    headYaw: 0,
    headPitch: 0,
    effort: 0,
    neck: 0,
  },
};
// on the game table the little dragon rears up so it stands out beside the money bag
const TABLE_POSE = { ...REST, dragon: { ...REST.dragon, neck: 68 } };

// A model collects convex parts; map places toy units in the world (identity for the table geometry).
function model(map = null) {
  const parts = [];
  const P = map ? map.p : (p) => p,
    D = map ? map.d : (d) => d;
  const place = (part) => {
    if (!map) {
      part.box ||= [0, 1].map((end) =>
        [0, 1, 2].map((a) => (end ? Math.max : Math.min)(...part.points.map((p) => p[a]))),
      );
      return part;
    }
    const points = part.points.map(P);
    const lookup = new Map(part.points.map((p, i) => [p, points[i]]));
    part.faces = part.faces.map((face) => ({
      points: face.points.map((p) => lookup.get(p) || P(p)),
      normal: map.n(face.normal),
    }));
    part.points = points;
    part.box = [0, 1].map((end) =>
      [0, 1, 2].map((a) => (end ? Math.max : Math.min)(...points.map((p) => p[a]))),
    );
    if (part.at) part.at = P(part.at);
    if (part.outline) {
      const scale = Math.hypot(...D([1, 0, 0]));
      part.outline = {
        ...part.outline,
        centres: part.outline.centres.map(P),
        radii: part.outline.radii.map((r) => r * scale),
      };
    }
    return part;
  };
  const add = (part, extra = {}) => {
    Object.assign(part, extra);
    parts.push(place(part));
    return part;
  };
  return {
    parts,
    P,
    D,
    orb: (x, y, z, rx, ry, rz, m, label = '', res = {}) =>
      add(orbMesh([x, y, z], [rx, ry, rz], palettes[m], res), label ? { label } : {}),
    rod: (a, b, r, m, end = r, label = '', joint = true) => {
      add(rodMesh(a, b, r, end, palettes[m]), label ? { label } : {});
      if (joint) add(orbMesh(b, end, palettes[m], { rings: 6, seg: 12 }));
    },
    add,
  };
}

/* ---------- frog ---------- */
// tongue path: out of the mouth, forward, then up and over to the frog's left (the viewer's right)
const bez = (a, b, c, t) =>
  a.map((v, k) => (1 - t) ** 2 * v + 2 * (1 - t) * t * b[k] + t * t * c[k]);
function frog(m, pose = REST.frog) {
  for (const side of [-1, 1]) {
    m.orb(side * 37, 0, 27, 23, 20, 24, 'green');
    m.orb(side * 40, 20, 12, 24, 19, 9, 'green');
    for (let i = 0; i < 3; i++) m.orb(side * 40 + (i - 1) * 12, 35, 9, 7, 12, 6, 'green');
  }
  m.orb(0, 0, 53, 43, 30, 43, 'green');
  m.orb(0, 25, 48, 30, 10, 29, 'cream');
  m.orb(0, 4, 99, 48, 30, 31, 'green');
  for (const side of [-1, 1]) {
    m.orb(side * 27, 5, 123, 18, 20, 22, 'green');
    m.orb(side * 27, 23, 127, 12, 6, 13, 'white');
    // eyes narrow to a pleased squint while the tongue is out
    m.orb(side * 27, 29, 128, 5, 2.5, 7 - 3 * pose.mouth, 'ink');
    m.orb(side * 25, 31, 131, 1.8, 1, 2, 'white');
    m.orb(side * 34, 31, 101, 7, 3, 4, 'pink');
    m.rod([side * 35, 14, 67], [side * 39, 26, 36], 7, 'green');
    m.orb(side * 11, 32, 109, 2, 1.6, 2, 'ink');
  }
  if (pose.mouth > 0.02) {
    m.orb(0, 31, 92, 18 * pose.mouth + 4, 4, 9 * pose.mouth + 1, 'mouth', '', {
      rings: 6,
      seg: 14,
    });
  } else {
    m.rod([-17, 33, 94], [0, 36, 90], 1.2, 'ink');
    m.rod([0, 36, 90], [17, 33, 94], 1.2, 'ink');
  }
  if (pose.tongue <= 0.02) return;
  const e = pose.tongue,
    from = [0, 33, 91],
    ctrl = [-6, 34 + 46 * e, 96 + 8 * e],
    tip = [-44 * e, 30 + 26 * e, 92 + 72 * e];
  const pts = Array.from({ length: 9 }, (_, i) => bez(from, ctrl, tip, i / 8));
  for (let i = 0; i < 8; i++)
    m.rod(pts[i], pts[i + 1], 5.2 - i * 0.18, 'tongue', 5.2 - (i + 1) * 0.18);
  m.orb(...tip, 6, 4, 6, 'tongue', '', { rings: 6, seg: 12 });
  if (pose.card <= 0.02) return;
  // the card is stuck by its back to the tongue tip and faces the viewer
  const s = pose.card,
    a = pose.spin,
    u = [-Math.cos(a), 0, Math.sin(a)],
    v = [Math.sin(a), 0, Math.cos(a)],
    c = [tip[0], tip[1] + 4, tip[2]],
    w = 24 * s,
    h = 34 * s,
    r = 4 * s;
  const at = (du, dv) => c.map((q, k) => q + u[k] * du + v[k] * dv);
  const outline = [];
  for (const [cu, cv, a0] of [
    [w - r, h - r, 0],
    [-w + r, h - r, 90],
    [-w + r, -h + r, 180],
    [w - r, -h + r, 270],
  ])
    for (let i = 0; i <= 3; i++) {
      const t = ((a0 + i * 30) * Math.PI) / 180;
      outline.push(at(cu + r * Math.cos(t), cv + r * Math.sin(t)));
    }
  m.add(slab(outline, [0, 2.4, 0], palettes.card), {
    ink: 1.6,
    after: (cam) => {
      const face = (q) => cam.project(m.P(q)),
        border = [
          at(w - 4 * s, h - 4 * s),
          at(-w + 4 * s, h - 4 * s),
          at(-w + 4 * s, -h + 4 * s),
          at(w - 4 * s, -h + 4 * s),
        ].map((p) => face([p[0], p[1] + 2.5, p[2]]));
      const front = (du, dv) => m.P([...at(du, dv)].map((q, k) => (k === 1 ? q + 2.5 : q)));
      return (
        ink(path(border), 0.9, '#d0483a') +
        planeText(
          cam,
          front(0, -11 * s),
          m.D(u),
          m.D(v),
          '赖',
          27 * s,
          '#d0483a',
          'font-weight="800" font-family="ui-serif,Songti SC,serif"',
        ) +
        planeText(
          cam,
          front(-w + 8 * s, h - 14 * s),
          m.D(u),
          m.D(v),
          'A',
          9 * s,
          '#d0483a',
          'font-weight="800" font-family="ui-monospace,Menlo,monospace"',
        )
      );
    },
  });
}

/* ---------- hand ---------- */
const FINGERS = [
  [-25, 147],
  [-7, 165],
  [12, 159],
  [30, 140],
];
function hand(m, pose = REST.hand) {
  m.orb(0, 0, 12, 33, 23, 11, 'blue');
  m.rod([0, 0, 15], [0, 0, 48], 19, 'pink');
  m.orb(0, 0, 74, 33, 16, 35, 'pink');
  // Four upright digits, separated by 8–10 units of daylight; thumb is the fifth.
  // Bound: the middle and ring fingers are pulled together, the outer two flinch apart.
  const b = pose.bind,
    j = pose.shake;
  const ends = FINGERS.map(([x, z], i) => {
    const pull = i === 1 ? 5.6 : i === 2 ? -5.6 : i === 0 ? -pose.splay * 7 : pose.splay * 7;
    return [x + pull * b + (i === 1 || i === 2 ? j : 0), 0, z - (i === 1 || i === 2 ? 4 * b : 0)];
  });
  ends.forEach((end, i) => {
    const start = [FINGERS[i][0] * 0.87, 0, 89];
    m.rod(start, end, 6.3, 'pink', 6.3, `finger-${i + 1}`);
    m.orb(end[0], 6, end[2] - 6, 4.1, 1.4, 7, 'cream');
  });
  m.rod([-24, 0, 65], [-57, 5, 102], 8.5, 'pink', 8, 'finger-5');
  m.orb(-57, 12, 100, 5, 1.6, 6, 'cream');
  m.rod([-16, 15, 68], [3, 17, 78], 0.7, 'pink');
  if (pose.wrap > 0.01) bandage(m, ends, pose);
}
// A spiral of gauze around fingers 2 and 3, wound from the knuckles upward, turn by turn.
function bandage(m, ends, pose) {
  const a = [FINGERS[1][0] * 0.87, 0, 89],
    b = [FINGERS[2][0] * 0.87, 0, 89];
  const z0 = 100,
    z1 = 140,
    turns = 3.4,
    band = 6.5,
    steps = Math.max(2, Math.round(56 * pose.wrap));
  const along = (s, e, z) => s[0] + ((e[0] - s[0]) * (z - s[2])) / (e[2] - s[2]);
  const ring = (t, dz) => {
    const z = lerp(z0, z1, t) + dz,
      x2 = along(a, ends[1], z),
      x3 = along(b, ends[2], z),
      cx = (x2 + x3) / 2,
      rx = Math.abs(x3 - x2) / 2 + 7.6,
      ang = -Math.PI / 2 + t * turns * Math.PI * 2;
    return [cx + rx * Math.cos(ang), 7.6 * Math.sin(ang), z];
  };
  const faces = [],
    points = [],
    edges = [];
  for (let i = 0; i < steps; i++) {
    const t0 = (i / 56) * 1,
      t1 = ((i + 1) / 56) * 1;
    const q = [ring(t0, 0), ring(t1, 0), ring(t1, band), ring(t0, band)];
    const mid = ring((t0 + t1) / 2, band / 2),
      cx = (along(a, ends[1], mid[2]) + along(b, ends[2], mid[2])) / 2;
    faces.push({ points: q, normal: norm([mid[0] - cx, mid[1], 0]) });
    points.push(...q);
    edges.push(q);
  }
  const part = m.add(
    {
      points,
      faces,
      palette: palettes.bandage,
      box: null,
      ink: 0,
    },
    {},
  );
  // the gauze is drawn over the fingers it wraps
  part.at = part.points.reduce((s, p) => s.map((v, k) => v + p[k] / part.points.length), [0, 0, 0]);
  const toward = m.D([0, 30, 0]);
  part.at = part.at.map((v, k) => v + toward[k]);
  part.after = (cam) =>
    part.faces
      .filter((f) => cam.sees(f.normal, f.points[0]))
      .map((f) => {
        const [p0, p1, p2, p3] = f.points.map(cam.project);
        return ink(path([p0, p1], false), 0.8) + ink(path([p3, p2], false), 0.8);
      })
      .join('');
  if (pose.knot > 0.02) {
    const k = pose.knot,
      top = ring(Math.min(1, pose.wrap), band / 2);
    m.orb(top[0], top[1] + 1.5, top[2], 4.2 * k, 3 * k, 3.4 * k, 'bandage');
    m.rod(
      [top[0], top[1] + 2, top[2]],
      [top[0] - 9 * k, top[1] + 3, top[2] - 10 * k],
      2.4 * k,
      'bandage',
      1.6 * k,
      '',
      false,
    );
    m.rod(
      [top[0], top[1] + 2, top[2]],
      [top[0] + 7 * k, top[1] + 3, top[2] - 12 * k],
      2.4 * k,
      'bandage',
      1.6 * k,
      '',
      false,
    );
  }
}

const builders = { frog, hand, dragon };
export function buildToy(id, pose, map) {
  const m = model(map);
  builders[id](m, { ...REST[id], ...pose });
  return m.parts;
}
const geometryCache = new Map();
export function toyGeometry(id) {
  if (!geometryCache.has(id)) geometryCache.set(id, buildToy(id, TABLE_POSE[id]));
  return geometryCache.get(id);
}
