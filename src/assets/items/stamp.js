import { slab, planeText, path, ink, smooth, spring, clamp01 } from '../../engine/stage3d.js';
import { palettes } from './palettes.js';

/* 橡皮印章：红橡皮底座、木纹领口和圆头手柄；高高举起后一顿，把一张 "+1" 印卡弹上天空。 */
export const stamp = {
  REST: { lift: 0, slam: 0, squash: 0, card: 0, spin: 0 },
  tablePose: null,
  duration: 1.5,
  pose(t) {
    const up = smooth(clamp01(t / 0.28));
    const drop = smooth(clamp01((t - 0.45) / 0.22));
    return {
      lift: up * (1 - drop),
      slam: drop,
      squash: Math.sin(Math.PI * clamp01((t - 0.67) / 0.16)),
      card: spring(clamp01((t - 0.72) / 0.3)),
      spin: Math.sin(t * 11) * Math.exp(-t * 2.2) * 0.4,
    };
  },
  build(m, pose) {
    // rubber base squashes on impact; the handle rides down with the slam
    const sq = pose.squash,
      lift = (pose.lift - pose.slam) * 46 - sq * 5;
    m.orb(0, 2, 9, 34, 30, 7, 'red');
    m.orb(0, 2, 14 + lift * 0.2, 30 * (1 + sq * 0.1), 26, 13 * (1 - sq * 0.3), 'red');
    m.orb(0, 0, 30 + lift, 32 * (1 + sq * 0.12), 28, 22 * (1 - sq * 0.25), 'red');
    m.rod([0, 0, 50 + lift], [0, 0, 58 + lift], 13, 'cream');
    m.rod([0, 0, 56 + lift], [0, 0, 104 + lift], 9, 'gold', 7);
    m.orb(0, 0, 100 + lift, 10.5, 10.5, 4.5, 'cream');
    m.orb(0, 0, 117 + lift, 16, 16, 15, 'gold');
    m.orb(0, -3, 122 + lift, 5, 3, 5, 'cream');
    m.orb(0, 4, 124 + lift, 2.2, 1.6, 2.2, 'red');
    if (pose.card <= 0.02) return;
    // the impression: a little card stamped with the upgrade, popped up beside the handle
    const s = pose.card,
      a = pose.spin,
      u = [-Math.cos(a), 0, Math.sin(a)],
      v = [Math.sin(a), 0, Math.cos(a)],
      c = [-30, 8, 96 + s * 26],
      w = 20 * s,
      h = 27 * s,
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
    m.add(slab(outline, [0, 2.2, 0], palettes.card), {
      ink: 1.5,
      after: (cam) => {
        const face = (q) => cam.project(m.P(q)),
          border = [
            at(w - 3 * s, h - 3 * s),
            at(-w + 3 * s, h - 3 * s),
            at(-w + 3 * s, -h + 3 * s),
            at(w - 3 * s, -h + 3 * s),
          ].map((p) => face([p[0], p[1] + 2.3, p[2]]));
        const front = (du, dv) => m.P([...at(du, dv)].map((q, k) => (k === 1 ? q + 2.3 : q)));
        return (
          ink(path(border), 0.9, '#d0483a') +
          planeText(
            cam,
            front(0, -3 * s),
            m.D(u),
            m.D(v),
            '+1',
            17 * s,
            '#d0483a',
            'font-weight="800" font-family="ui-monospace,Menlo,monospace"',
          )
        );
      },
    });
  },
  icon: [
    ['M13 30h22l3 9H10Z', '#e0574f'],
    ['M19 30v-9q0-2 2-2h6q2 0 2 2v9Z', '#e2ab3d'],
    ['M19 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0', '#ffd56e'],
    ['M20 35h8m-4-4v8', null],
  ],
  shop: { y: 18, s: 0.4, standHalf: 22, standExtend: 0, priceOffset: 0, withdraw: 0.28 },
  table: { u: -247, v: 236 },
};
