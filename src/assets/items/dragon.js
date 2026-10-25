import { tube, path, ink, spring, clamp01 } from '../../engine/stage3d.js';
import { palettes } from './palettes.js';

/* 中国龙玩具：低伏的驼峰身躯被自己越拉越长，四爪、背鳍、尾穗，头部有角、鬃毛与龙须。 */
export const dragon = {
  REST: {
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
  // on the game table the little dragon rears up so it stands out beside the money bag
  tablePose: { neck: 68 },
  duration: 3.4,
  // three struggles, each harder than the last, each pulling the body longer
  pose(t) {
    const levels = [40, 80, 130, 182],
      starts = [0.1, 0.95, 1.95],
      durs = [0.62, 0.72, 0.86],
      power = [0.38, 0.68, 1];
    let length = levels[0],
      hump = 1,
      phase = 0,
      jitter = 0,
      hop = 0,
      headYaw = 0,
      headPitch = 0,
      effort = 0;
    for (let k = 0; k < 3; k++) {
      const u = (t - starts[k]) / durs[k];
      if (u < 0) break;
      const env = Math.sin(Math.PI * clamp01(u)),
        p = power[k];
      if (u <= 1) {
        // wind up: squeeze shorter, thrash, hop
        effort = Math.max(effort, Math.min(1, env * 1.15) * p + 0.12);
        jitter = env * p * 4.5 * Math.sin(u * (30 + k * 14));
        headYaw = env * p * 42 * Math.sin(u * Math.PI * (3 + k * 2));
        headPitch = env * p * 24 * Math.sin(u * Math.PI * (2 + k));
        hop = env * env * p * 16;
        hump = 1 + env * p * 2.2;
        phase = Math.sin(u * Math.PI * (4 + k * 2)) * env * p * 1.1;
      }
      const pull = clamp01((t - starts[k] - durs[k] * 0.62) / 0.55);
      const squeeze = 1 - 0.14 * p * Math.sin(Math.PI * clamp01(u / 0.62)) * (u < 0.62);
      length = (levels[k] + (levels[k + 1] - levels[k]) * (pull > 0 ? spring(pull) : 0)) * squeeze;
    }
    const settle = clamp01((t - 2.9) / 0.5);
    effort *= 1 - settle;
    return { length, hump, phase, jitter, hop, headYaw, headPitch, effort };
  },
  build(m, pose) {
    const L = pose.length,
      n = Math.max(8, Math.round(L / 4)),
      pts = Array.from({ length: n + 1 }, (_, i) => spine(pose, (i / n) * L)),
      radii = pts.map((_, i) => bodyR(pose, (i / n) * L));
    // one smooth body from the head down the neck and along the humps to the tail
    const head = [18 + pose.headYaw * 0.15, 14, 58 + pose.neck + pose.hop + pose.headPitch * 0.1];
    const neck = Array.from({ length: 7 }, (_, i) => {
      const t = 1 - i / 7,
        a = head,
        b = [17, 6, 34 + pose.neck * 0.5 + pose.hop],
        c = pts[0];
      return a.map((v, k) => (1 - t) ** 2 * c[k] + 2 * (1 - t) * t * b[k] + t * t * v);
    });
    m.add(
      tube(
        [...neck, ...pts],
        [...neck.map((_, i) => 11.5 + (6 - i) * 0.1), ...radii],
        palettes.gold,
        { ink: 2 },
      ),
    );
    // dorsal fins along the top, every ~11 units
    for (let s = 6; s < L - 6; s += 11) {
      const p = spine(pose, s),
        r = bodyR(pose, s);
      m.rod([p[0], p[1], p[2] + r * 0.7], [p[0] - 2, p[1], p[2] + r + 6], 3, 'red', 0.4, '', false);
    }
    // tail tuft
    const tail = pts[n];
    m.orb(tail[0] - 4, tail[1], tail[2] + 3, 6, 3, 4, 'red', '', { rings: 6, seg: 12 });
    m.orb(tail[0] - 7, tail[1], tail[2] + 7, 4, 2.5, 3, 'red', '', { rings: 6, seg: 12 });
    // legs: front pair under the neck, back pair two thirds down the body
    for (const s of [5, Math.max(22, L * 0.66)])
      for (const side of [-1, 1]) {
        const p = spine(pose, s),
          foot = [p[0] - 3, p[1] + side * 13, 3.4];
        m.rod([p[0], p[1] + side * 6, p[2]], foot, 3.8, 'gold', 3.2, '', true);
        for (let j = -1; j <= 1; j++)
          m.rod(foot, [foot[0] + j * 4, foot[1] + side * 2 + 5, 1.6], 1.6, 'cream', 0.7, '', false);
      }
    dragonHead(m, head, pose);
  },
  icon: [
    ['M8 31q10 9 17-1t13-11l-7-9-12 6 7 6q-6 2-7 8t-11 1Z', '#f4b829'],
    ['M20 15 21 8 26 13m4-2 4-6 1 10', '#e58448'],
    ['M30 22 40 23 38 30 30 28', '#ffe194'],
    ['M30 17h.1M12 31l3-5m5 3 2-5', null],
  ],
  shop: { x: 66, y: 22, s: 0.43, standHalf: 15, standExtend: 66, priceOffset: 30, withdraw: 0.5 },
  table: { u: -277, v: 242 },
};
// spine from the neck base (s = 0) to the tail tip (s = length), running toward -x (the viewer's right)
function spine(pose, s) {
  const lam = 34,
    k = s / lam,
    hump =
      Math.max(0, Math.sin(Math.PI * k + pose.phase)) *
      (15 + 7 * pose.hump) *
      Math.min(1, k * 1.4 + 0.2);
  const r = bodyR(pose, s);
  return [
    10 - s * 0.94 + pose.jitter * Math.sin(s * 0.3),
    5 * Math.sin(s / 26 + pose.phase * 0.7),
    r + hump + pose.hop,
  ];
}
const bodyR = (pose, s) => 1.6 + 10.5 * (1 - 0.82 * Math.pow(s / pose.length, 1.3));
function dragonHead(m, H, pose) {
  const yaw = (pose.headYaw * Math.PI) / 180,
    pitch = (pose.headPitch * Math.PI) / 180,
    sc = 0.78;
  const T = ([x, y, z]) => {
    // local: x right, y toward the viewer, z up; pitch about x, then yaw about z
    const y1 = y * Math.cos(pitch) - z * Math.sin(pitch),
      z1 = y * Math.sin(pitch) + z * Math.cos(pitch);
    return [
      H[0] + sc * (x * Math.cos(yaw) - y1 * Math.sin(yaw)),
      H[1] + sc * (x * Math.sin(yaw) + y1 * Math.cos(yaw)),
      H[2] + sc * z1,
    ];
  };
  const o = (x, y, z, rx, ry, rz, mat) => m.orb(...T([x, y, z]), rx * sc, ry * sc, rz * sc, mat);
  const r = (a, b, w, mat, w1) => m.rod(T(a), T(b), w * sc, mat, w1 * sc, '', false);
  o(0, 0, 0, 27, 21, 21, 'gold');
  o(0, 21, -8, 25, 21, 12, 'cream');
  o(0, 34, -3, 21, 11, 9, 'gold');
  for (const side of [-1, 1]) {
    const x = side * 16;
    o(x + side * 8, -4, 10, 10, 5, 7, 'red');
    o(x, 17, 11, 8, 6, 10 - 4 * pose.effort, 'white');
    o(x, 22, 12, 3.2, 2, 5 - 2.5 * pose.effort, 'ink');
    o(side * 10, 42, 1, 2.8, 2, 2, 'ink');
    r([x, -1, 14], [x + side * 6, -6, 40], 3.6, 'cream', 2.2);
    r([x + side * 4, -5, 31], [x + side * 15, -7, 39], 2.6, 'cream', 1.1);
    r([side * 16, 36, -6], [side * 34, 35, -16], 1.5, 'cream', 1.1);
    r([side * 34, 35, -16], [side * 39, 31, -8], 1.1, 'cream', 0.6);
  }
  r([-15, 39, -13], [15, 39, -13], 1.2, 'red', 1.2);
  if (pose.effort > 0.05) {
    // strain marks and a flushed face: more marks, longer, the harder it pulls
    const count = Math.min(3, Math.ceil(pose.effort * 3 - 0.05)),
      at = m.P(T([0, 0, 0])),
      size = Math.hypot(...m.D([27 * sc, 0, 0]));
    m.parts.at(-1).after = (cam) => {
      const c = cam.project(at),
        r = size * cam.k;
      let s = '';
      for (const side of [-1, 1]) {
        const cheek = cam.project(m.P(T([side * 15, 20, -4])));
        s += `<ellipse cx="${cheek[0].toFixed(1)}" cy="${cheek[1].toFixed(1)}" rx="${(r * 0.22).toFixed(1)}" ry="${(r * 0.13).toFixed(1)}" fill="#f58d73" opacity="${(0.4 + pose.effort * 0.5).toFixed(2)}"/>`;
        for (let i = 0; i < count; i++) {
          const a = 0.55 + i * 0.38,
            r0 = r * 1.2,
            r1 = r0 + r * (0.45 + pose.effort * 0.55);
          s += ink(
            path(
              [
                [c[0] + side * r0 * Math.cos(a), c[1] - r0 * Math.sin(a)],
                [c[0] + side * r1 * Math.cos(a), c[1] - r1 * Math.sin(a)],
              ],
              false,
            ),
            1.8 + pose.effort * 1.6,
          );
        }
      }
      if (pose.effort > 0.45) {
        // a bead of sweat on the hardest pulls
        const x = c[0] + r * 1.15,
          y = c[1] - r * 0.15,
          d = r * 0.22;
        s += `<path d="M${x.toFixed(1)} ${(y - d * 1.6).toFixed(1)}Q${(x + d).toFixed(1)} ${(y - d * 0.2).toFixed(1)} ${x.toFixed(1)} ${(y + d * 0.6).toFixed(1)}Q${(x - d).toFixed(1)} ${(y - d * 0.2).toFixed(1)} ${x.toFixed(1)} ${(y - d * 1.6).toFixed(1)}Z" fill="#cfe9f0" stroke="#231e16" stroke-width="1.2"/>`;
      }
      return s;
    };
  }
}
