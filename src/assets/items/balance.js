/* 黄铜天平：石座上立一根铜柱，横梁两端各吊一只浅盘；一压一翘，慢慢回到水平。 */
export const balance = {
  REST: { tilt: 0, sway: 0 },
  tablePose: null,
  duration: 2.4,
  pose(t) {
    return {
      // one press tips the beam, an overcorrection swings it back, then it settles level
      tilt: 0.3 * Math.sin(t * 6.2) * Math.exp(-t * 1.9),
      sway: Math.sin(t * 10) * Math.exp(-t * 2.6) * 2.4,
    };
  },
  build(m, pose) {
    const cT = Math.cos(pose.tilt),
      sT = Math.sin(pose.tilt);
    m.orb(0, 0, 13, 30, 26, 13, 'gold');
    m.orb(0, 0, 25, 19, 17, 9, 'gold');
    m.rod([0, 0, 30], [0, 0, 110], 5, 'gold');
    m.orb(0, 0, 113, 8, 8, 7, 'gold');
    const end = (side) => [side * 42 * cT, pose.sway * side * 0.4, 113 - side * 42 * sT];
    m.rod(end(-1), end(1), 4, 'gold', 3.4);
    for (const side of [-1, 1]) {
      const [ex, ey, ez] = end(side);
      m.orb(ex, ey, ez, 5.4, 5.4, 5, 'gold');
      const panZ = ez - 34,
        panX = ex + side * 2;
      for (const off of [-9, 9])
        m.rod(
          [ex + off * cT, ey, ez],
          [panX + off * 1.4, ey, panZ + 5],
          1.1,
          'cream',
          0.9,
          '',
          false,
        );
      m.orb(panX, ey, panZ, 20, 15, 6, 'cream');
      m.orb(panX, ey, panZ + 2.5, 16.5, 12, 3.4, 'white');
    }
  },
  icon: [
    ['M19 41h10l-1.5-7h-7Z', '#e2ab3d'],
    ['M23 34 24 15', null],
    ['M8 16h32', null],
    ['M12 16l-1 5m26-5 1 5', null],
    ['M5 27a7 7 0 0 0 14 0Z', '#ffe194'],
    ['M29 27a7 7 0 0 0 14 0Z', '#ffe194'],
  ],
  shop: { y: 16, s: 0.36, standHalf: 24, standExtend: 0, priceOffset: 0, withdraw: 0.28 },
  table: { u: -217, v: 242 },
};
