import { smooth, clamp01 } from '../../engine/stage3d.js';

/* 杰瑞小鼠：暖棕色的圆耳小鼠，后腿站定；展示时探出脖子把脑袋凑上前，左右嗅一嗅再缩回去。 */
export const mouse = {
  REST: { peek: 0, sniff: 0, tail: 0 },
  tablePose: null,
  duration: 2,
  pose(t) {
    return {
      peek: smooth(clamp01(t / 0.3)) * (1 - smooth(clamp01((t - 1.5) / 0.34))),
      // the sniffing window sits between the pop-out and the retreat; the nose sweeps both ways
      sniff:
        Math.sin((t - 0.3) * 8.4) * clamp01((t - 0.28) / 0.22) * (1 - clamp01((t - 1.3) / 0.26)),
      tail: Math.sin(t * 7.2) * Math.exp(-t * 1.8),
    };
  },
  build(m, pose) {
    // the whole head group turns with the sniff, so muzzle, eyes and whiskers sweep together
    const yaw = pose.sniff * 0.3,
      cos = Math.cos(yaw),
      sin = Math.sin(yaw),
      hc = [0, 2 + pose.peek * 15, 84 + pose.peek * 20],
      H = (dx, dy, dz) => [hc[0] + dx * cos - dy * sin, hc[1] + dx * sin + dy * cos, hc[2] + dz];
    m.orb(0, 0, 40, 23, 20, 32, 'fur');
    m.orb(0, 12, 39, 16, 11, 22, 'cream');
    for (const side of [-1, 1]) {
      m.orb(side * 11, 14, 6, 8, 12, 6, 'fur');
      m.orb(side * 11, 25, 6, 5.5, 3, 2.6, 'cream');
      m.rod([side * 16, 3, 58], [side * 21, 13, 48], 4.4, 'fur', 3.8, '', false);
      m.orb(side * 21, 15, 46, 4.2, 4, 4.6, 'cream');
    }
    // the neck leans forward as the head pushes out of the shoulders
    m.rod([0, 4, 66], H(0, -3, -12), 12, 'fur', 10);
    m.orb(...H(0, 0, 0), 17.5, 15, 16.5, 'fur');
    for (const side of [-1, 1]) {
      m.orb(...H(side * 19, -2, 18), 13.5, 5, 15, 'fur');
      m.orb(...H(side * 19, 1.8, 18), 8.5, 2.6, 9.5, 'pink');
    }
    m.orb(...H(0, 12, -7), 10.5, 8, 6.5, 'cream');
    m.orb(...H(0, 19, -5), 3, 2.4, 2.4, 'ink');
    for (const side of [-1, 1]) {
      m.orb(...H(side * 7.4, 12, 5), 5.2, 3.4, 6.8, 'white');
      m.orb(...H(side * 7.4, 14.9, 5), 2.5, 1.8, 3.5, 'ink');
      for (const droop of [-2, 1.5, 5])
        m.rod(
          H(side * 6, 16, -5),
          H(side * 22, 17 + droop * 0.4, -7 + droop),
          0.7,
          'ink',
          0.5,
          '',
          false,
        );
      m.rod(H(0, 16.5, -10.5), H(side * 4.5, 15, -9), 0.7, 'ink', 0.6, '', false);
    }
    // long thin tail curling out beside the hip, flicking while the nose is busy
    const whip = pose.tail * 12,
      tail = Array.from({ length: 7 }, (_, i) => {
        const k = i / 6;
        return [
          Math.sin(k * Math.PI * 1.05) * (30 + whip * 0.8),
          -12 - k * 22,
          26 + Math.sin(k * Math.PI * 0.85) * 12 - k * 8,
        ];
      });
    for (let i = 0; i < 6; i++)
      m.rod(tail[i], tail[i + 1], 3.2 - i * 0.42, 'pink', 3.2 - (i + 1) * 0.42, '', false);
  },
  icon: [
    ['M32 34q11-3 9 5', null],
    ['M7 16a8 8 0 1 0 16 0a8 8 0 1 0-16 0M25 16a8 8 0 1 0 16 0a8 8 0 1 0-16 0', '#f0c79b'],
    ['M12 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0M30 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0', '#e89cae'],
    ['M12 25q0-10 12-10t12 10l-3 10-9 4-9-4Z', '#d69a67'],
    ['M12 25q0-10 12-10v24l-9-4Z', '#f0c79b'],
    ['M15 31q3-6 9-3 6-3 9 3l-3 5H18Z', '#fff2cc'],
    ['M19 23v3m10-3v3', null],
    ['M21 29h6l-3 3Z', '#29251e'],
    ['M24 32v2m-3 0q3 2 6 0', null],
  ],
  shop: { y: 18, s: 0.4, standHalf: 22, standExtend: 0, priceOffset: 0, withdraw: 0.28 },
  table: { u: -157, v: 242 },
};
