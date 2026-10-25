import { lerp, smooth, spring, clamp01, ink, path } from '../../engine/stage3d.js';
import { norm } from '../../engine/math.js';
import { palettes } from './palettes.js';

/* 五指玩具手：袖口/手腕/手掌、四根竖起的手指和一根侧向拇指；一圈绷带把并拢的两指缠在一起。 */
const FINGERS = [
  [-25, 147],
  [-7, 165],
  [12, 159],
  [30, 140],
];
export const hand = {
  REST: { bind: 0, wrap: 0, knot: 0, splay: 0, shake: 0 },
  tablePose: null,
  duration: 1.9,
  pose(t) {
    const wrap = smooth(clamp01((t - 0.12) / 1.1));
    // each turn of gauze yanks the two fingers a little closer
    const yank = Math.min(1, wrap * 3.4 + 0.25),
      step = Math.floor(yank * 4) / 4 + (yank * 4 - Math.floor(yank * 4)) ** 3 / 4;
    return {
      bind: t < 0.12 ? 0 : Math.min(1, 0.35 + 0.65 * step),
      wrap,
      knot: spring(clamp01((t - 1.25) / 0.45)),
      splay: smooth(clamp01(t / 0.3)) * (1 - 0.5 * smooth(clamp01((t - 1.3) / 0.4))),
      shake: Math.sin(t * 46) * 1.2 * (t < 1.4 ? 1 : Math.exp(-(t - 1.4) * 8)),
    };
  },
  build(m, pose) {
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
  },
  icon: [
    [
      'M16 36 8 24q-2-5 2-5l7 6V13q0-6 4-4v13-16q4-4 5 1v15-13q4-3 5 2v13-9q5-2 5 3v13l-7 8Z',
      '#f3a6bb',
    ],
    ['M16 36 29 39v5l-13-3Z', '#c37694'],
    ['M20 28 28 30', null],
  ],
  shop: { x: 0, y: 18, s: 0.38, standHalf: 22, standExtend: 0, priceOffset: 0, withdraw: 0.28 },
  table: { u: -307, v: 236 },
};
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
