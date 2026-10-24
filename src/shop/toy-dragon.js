import { tube, path, ink } from './stage3d.js';
import { palettes } from './toy-palettes.js';

/* Dragon: a low humped body the toy pulls longer in three ever harder struggles, four legs with claws,
 * dorsal fins, tail tuft, head with antlers, mane and whiskers. */
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
export function dragon(m, pose) {
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
}
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
