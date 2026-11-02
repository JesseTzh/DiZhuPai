import { world } from './table.js';
import { P } from '../engine/camera.js';

// 木桌部件：桌板、四周厚木沿、榫接短块、铜钉、桌面印记。
// 木沿固定在桌板边缘，纹样位于桌面上；所有部件共用场景投影。
export function paintTableOrnament(canvas, table) {
  const U = Math.max(...table.outline.map(([u]) => u));
  const V = Math.max(...table.outline.map(([, v]) => v));
  const marble = table.material.l === '#dfe8de';
  const rail = (u0, v0, u1, v1, z = 9) => {
    const corners = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ];
    const top = corners.map(([u, v]) => world(u, v, z));
    const base = corners.map(([u, v]) => world(u, v, -1));
    for (const [a, b] of [
      [1, 2],
      [2, 3],
      [3, 0],
    ])
      canvas.polygon([base[a], base[b], top[b], top[a]], table.material.d, '#715036', 0.85);
    canvas.polygon(top, marble ? '#d2dbc8' : '#d69c60', '#735237', 1.25);
    canvas.line(
      [
        [u0 + 3, v0 + 2],
        [u1 - 3, v0 + 2],
      ].map(([u, v]) => world(u, v, z + 0.1)),
      '#f7d89b',
      1.3,
    );
    if (u1 - u0 > 40)
      for (let i = 0; i < 3; i++) {
        const v = v0 + 3 + ((v1 - v0 - 5) * i) / 3;
        canvas.line(
          Array.from({ length: 15 }, (_, j) =>
            world(u0 + 8 + ((u1 - u0 - 16) * j) / 14, v + Math.sin(j * 0.7 + i) * 0.8, z + 0.2),
          ),
          '#af7847',
          0.55,
        );
      }
  };
  rail(-U + 2, -V + 2, U - 2, -V + 11, 7);
  rail(-U + 2, -V + 12, -U + 12, V - 12, 7);
  rail(U - 12, -V + 12, U - 2, V - 12, 7);
  rail(-U + 2, V - 12, U - 2, V - 2, 9);
  for (const u of [-U * 0.72, U * 0.72]) {
    rail(u - 9, -V + 1, u + 9, -V + 14, 10);
    rail(u - 9, V - 15, u + 9, V - 1, 12);
  }
  const ctx = canvas.ctx;
  const o = P(...world(0, 0, -0.5));
  const x = P(...world(1, 0, -0.5));
  const y = P(...world(0, 1, -0.5));
  ctx.save();
  ctx.transform(x[0] - o[0], x[1] - o[1], y[0] - o[0], y[1] - o[1], ...o);
  ctx.strokeStyle = '#b77e42';
  ctx.fillStyle = '#b77e42';
  ctx.globalAlpha = 0.29;
  for (const [rx, ry] of [
    [182, 97],
    [177, 92],
  ]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "900 63px 'STKaiti', 'Kaiti SC', 'Songti SC', serif";
  ctx.fillText('斗地主', 0, 0);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 171, 0);
    ctx.scale(side, 1);
    ctx.lineWidth = 1.5;
    for (const [cx, cy, r] of [
      [0, 0, 15],
      [19, -7, 11],
      [16, 14, 10],
      [-12, 12, 9],
      [-5, -20, 9],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0.2, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(5, -22);
    ctx.bezierCurveTo(26, -45, 52, -21, 28, -18);
    ctx.bezierCurveTo(51, -4, 37, 19, 19, 11);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
