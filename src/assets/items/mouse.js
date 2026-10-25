import { smooth, clamp01 } from '../../engine/stage3d.js';
import { palettes } from './palettes.js';

/* 机灵小鼠：后腿站起、胡须抖动的小老鼠；嗅一嗅就窜回地面，细尾巴在身后甩出一个圈。 */
export const mouse = {
  REST: { rise: 0, sniff: 0, tail: 0 },
  tablePose: null,
  duration: 1.8,
  pose(t) {
    const up = smooth(clamp01(t / 0.26));
    return {
      rise: up * (1 - smooth(clamp01((t - 0.72) / 0.28))),
      sniff: Math.sin(t * 24) * 1.6 * Math.min(1, up * 2),
      tail: Math.sin(t * 9) * Math.exp(-t * 1.4),
    };
  },
  build(m, pose) {
    const rise = pose.rise,
      lift = rise * 40,
      sway = pose.sniff;
    // standing tall on hind legs like a meerkat; the body rears up, then plops back down
    m.orb(0, 0, 40 + lift, 25, 23, 34, 'mouse');
    m.orb(0, 13, 36 + lift, 17, 11, 26, 'cream');
    for (const side of [-1, 1]) m.orb(side * 11, 5, 5, 9, 7, 5, 'mouse');
    m.rod([0, 2, 68 + lift], [0, 4, 88 + lift], 9, 'mouse');
    const headZ = 96 + lift,
      headY = 5 + sway * 0.4;
    m.orb(0, headY, headZ, 15, 14, 14, 'mouse');
    m.orb(0, headY + 10, headZ - 4, 7.5, 8, 6, 'mouse');
    m.orb(0, headY + 17, headZ - 5 + sway * 0.3, 3, 2.6, 2.6, 'pink');
    for (const side of [-1, 1]) {
      m.orb(side * 13, headY - 2, headZ + 13, 9, 4.5, 10, 'mouse');
      m.orb(side * 13, headY + 1.5, headZ + 13, 5.5, 2.5, 6.5, 'pink');
      m.orb(side * 6.5, headY + 9, headZ + 4.5, 2.4, 2, 2.4, 'ink');
      for (const droop of [-2.5, 1.5, 5.5])
        m.rod(
          [side * 5, headY + 15, headZ - 6],
          [side * 17, headY + 19 + droop * 0.5, headZ - 8 + droop],
          0.8,
          'ink',
          0.5,
          '',
          false,
        );
    }
    // tail sweeps behind and curls, whipping when the mouse is excited
    const whip = pose.tail * 14,
      tail = Array.from({ length: 6 }, (_, i) => {
        const k = i / 5,
          curl = Math.sin(k * Math.PI * 1.5) * (10 + whip);
        return [k * -46, -14 - k * 7, 9 + curl * (0.4 + rise * 0.4)];
      });
    for (let i = 0; i < 5; i++)
      m.rod(tail[i], tail[i + 1], 2.4 - i * 0.34, 'pink', 2.4 - (i + 1) * 0.34, '', false);
  },
  icon: [
    ['M13 39q-3-15 11-15t11 15Z', '#adb5c5'],
    ['M18 17a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0', '#d3d8e2'],
    ['M12 40q-7 3-9-3', null],
    ['M21 27h.1M27 27h.1M24 31l-1.5 2h3Z', null],
  ],
  shop: { y: 18, s: 0.4, standHalf: 22, standExtend: 0, priceOffset: 0, withdraw: 0.28 },
  table: { u: -157, v: 242 },
};
