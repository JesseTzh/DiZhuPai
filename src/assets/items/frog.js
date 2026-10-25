import { slab, planeText, path, ink, smooth, spring, clamp01 } from '../../engine/stage3d.js';
import { palettes } from './palettes.js';

/* 好运青蛙：后腿/脚趾、肚皮、头、眼、脸颊；一条粘舌把一张赖子牌弹上天空。 */
export const frog = {
  REST: { mouth: 0, tongue: 0, card: 0, spin: 0 },
  tablePose: null,
  duration: 1.5,
  pose(t) {
    const shoot = clamp01((t - 0.12) / 0.38);
    return {
      mouth: smooth(t / 0.16),
      tongue: shoot > 0 ? spring(shoot) : 0,
      card: shoot > 0 ? Math.min(1, shoot * 2.4) : 0,
      spin: Math.sin(t * 13) * Math.exp(-t * 2.6) * 0.5,
    };
  },
  build(m, pose) {
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
    // tongue path: out of the mouth, forward, then up and over to the frog's left (the viewer's right)
    const bez = (a, b, c, t) =>
      a.map((v, k) => (1 - t) ** 2 * v + 2 * (1 - t) * t * b[k] + t * t * c[k]);
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
  },
  icon: [
    ['M10 33 14 17h20l5 16-15 6Z', '#65a784'],
    ['M11 29c0-9 26-9 26 0v3c-4 7-22 7-26 0Z', '#93d3b0'],
    ['M9 17a7 7 0 1 0 14 0a7 7 0 1 0-14 0', '#c5edcc'],
    ['M25 17a7 7 0 1 0 14 0a7 7 0 1 0-14 0', '#c5edcc'],
    ['M16 16v3m16-3v3m-14 9q6 5 12 0', null],
  ],
  shop: { y: 20, s: 0.39, standHalf: 22, standExtend: 0, priceOffset: 0, withdraw: 0.28 },
  table: { u: -337, v: 242 },
};
