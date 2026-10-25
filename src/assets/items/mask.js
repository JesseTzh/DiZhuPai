import { slab, path, ink, smooth, clamp01 } from '../../engine/stage3d.js';
import { palettes } from './palettes.js';

/* 蓝布口罩：立在裁缝架上的一只大口罩，呼吸时鼓起又落下，两只布环轻轻拍动。 */
export const mask = {
  REST: { puff: 0, flutter: 0 },
  tablePose: null,
  duration: 1.7,
  pose(t) {
    return {
      puff: Math.sin(Math.PI * clamp01(t / 0.85)),
      flutter: Math.sin(t * 13) * Math.exp(-t * 2.1) * 3.2,
    };
  },
  build(m, pose) {
    m.orb(0, 0, 8, 28, 24, 8, 'cream');
    m.orb(0, 0, 15, 20, 17, 9, 'cream');
    m.rod([0, 0, 18], [0, 0, 122], 4, 'cream');
    m.orb(0, 0, 124, 6, 6, 5, 'gold');
    // the cloth breathes: a rounded slab that thickens toward the viewer with each puff
    const w = 46,
      h = 62,
      r = 14,
      d = 9 + pose.puff * 10,
      cy = 8 + d / 2,
      at = (dx, dz) => [dx, cy, 70 + dz];
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
    m.add(slab(outline, [0, d, 0], palettes.blue), {
      ink: 1.6,
      after: (cam) => {
        const front = (dx, dz) =>
          cam.project(m.P(at(dx, dz).map((q, k) => (k === 1 ? q + d + 0.6 : q))));
        let s = '';
        for (const dz of [-14, 2, 18])
          s += ink(path([front(-w + 10, dz), front(w - 10, dz)], false), 1.1);
        return s;
      },
    });
    // nose wire across the top edge
    m.rod(
      [-w + 12, cy + d + 1, 70 + h - r + 2],
      [w - 12, cy + d + 1, 70 + h - r + 2],
      2,
      'white',
      1.6,
      '',
      false,
    );
    // ear loops swing from the side edges back toward the pole
    for (const side of [-1, 1]) {
      const flap = pose.flutter * side * 0.4;
      const pts = [
        [side * (w - 4), cy + d * 0.4, 70 + h - 18],
        [side * (w + 15), cy + d * 0.4 + flap, 70 + 6],
        [side * (w + 10), cy + d * 0.4 + flap * 0.6, 70 - 24],
        [side * (w - 2), cy + d * 0.4, 70 - h + 18],
      ];
      for (let i = 0; i < 3; i++)
        m.rod(pts[i], pts[i + 1], 2.1 - i * 0.3, 'white', 1.8 - (i + 1) * 0.3, '', false);
    }
  },
  icon: [
    ['M13 13q11-5 22 0l-2.5 21q-8.5 4-17 0Z', '#8fb7e8'],
    ['M13 13q-7 2-7 9m29-9q7 2 7 9', null],
    ['M16 21h16m-16 6h16', null],
  ],
  shop: { y: 20, s: 0.4, standHalf: 22, standExtend: 0, priceOffset: 0, withdraw: 0.28 },
  table: { u: -187, v: 236 },
};
