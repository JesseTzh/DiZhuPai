import { rrUV } from '../engine/math.js';
import { world } from './table.js';
// Renderer-independent surface geometry; both backends own their draw commands.
const cache = new Map();
export function tableGeometry(style = 'planks') {
  const key = style;
  if (cache.has(key)) return cache.get(key);
  const U = 365,
    V = 265;
  const marble = style === 'marble',
    walnut = style === 'walnut';
  const material = marble
    ? { l: '#dfe8de', m: '#b4c9bc', d: '#819c90' }
    : walnut
      ? { l: '#ae8055', m: '#92623e', d: '#64432e' }
      : { l: '#d2af7e', m: '#b58b5e', d: '#886849' };
  const outline = rrUV(-U, -V, U, V, marble ? 32 : walnut ? 22 : 12, 8);
  const A = outline.map(([u, v]) => world(u, v, -19));
  const B = outline.map(([u, v]) => world(u, v, -1));

  const polygons = [],
    lines = [];
  const polygon = (points, color) => polygons.push({ points, color });
  const line = (uv, color, width = 0.8, closed = false, z = -0.75) =>
    lines.push({ points: uv.map(([u, v]) => world(u, v, z)), color, width, closed });
  if (!marble) {
    // Individual boards and restrained long grain strokes; deterministic, never random per frame.
    const strips = walnut ? 5 : 6;
    for (let j = 1; j < strips; j++) {
      const v = -V + (2 * V * j) / strips;
      line(
        [
          [-U + 3, v],
          [U - 3, v + (walnut ? 0 : 1.8)],
        ],
        material.d,
        walnut ? 0.65 : 1.5,
      );
    }
    for (let j = 0; j < 18; j++) {
      const v = -V + 26 + j * ((2 * V - 52) / 18);
      const x = -U + 26 + ((j * 79) % 160),
        length = 80 + ((j * 61) % 220);
      line(
        Array.from({ length: 13 }, (_, k) => [
          x + (k * length) / 12,
          v + Math.sin(k * 0.6 + j) * (walnut ? 2 : 3),
        ]),
        walnut ? '#93673f' : '#a07b51',
        0.65,
      );
    }
    for (const [u, v] of [
      [-U + 95, -V + 60],
      [U - 105, V - 64],
      [75, 35],
    ]) {
      for (const r of [1, 1.7])
        line(
          Array.from({ length: 25 }, (_, i) => [
            u + 12 * r * Math.cos((i * Math.PI) / 12),
            v + 3 * r * Math.sin((i * Math.PI) / 12),
          ]),
          material.m,
          0.75,
        );
    }
    if (!walnut) {
      for (let j = 0; j < strips; j++)
        for (const u of [-U + 18, U - 18]) {
          const v = -V + (2 * V * (j + 0.5)) / strips;
          polygon(
            Array.from({ length: 10 }, (_, k) =>
              world(
                u + 2.8 * Math.cos((k * Math.PI) / 5),
                v + 2.8 * Math.sin((k * Math.PI) / 5),
                -0.6,
              ),
            ),
            '#584d3f',
          );
          line(
            [
              [u - 1.6, v],
              [u + 1.6, v],
            ],
            '#d5bc92',
            0.7,
            false,
            -0.4,
          );
        }
      for (const v of [-V + 5, V - 5])
        line(
          [
            [-U + 45, v],
            [-U + 68, v + 4],
            [-U + 91, v + 1],
          ],
          material.d,
          1,
        );
    }
  } else {
    for (let j = 0; j < 7; j++) {
      const u = -U + 50 + j * ((2 * U - 100) / 7);
      const vein = Array.from({ length: 16 }, (_, k) => [
        u + 24 * Math.sin(k * 0.64 + j) + k * 2,
        -V + 25 + k * ((2 * V - 50) / 15),
      ]);
      line(vein, '#a3bdb0', 2.3);
      line(
        vein.map(([x, y]) => [x + 3, y]),
        '#f3f0d9',
        0.8,
      );
      const [x, y] = vein[6];
      line(
        [
          [x, y],
          [x - 18, y + 15],
          [x - 36, y + 19],
          [x - 48, y + 35],
        ],
        '#acbfb2',
        1,
      );
    }
  }
  if (walnut || marble) {
    for (const [inset, width] of [
      [8, 3.5],
      [15, 0.9],
    ])
      line(rrUV(-U + inset, -V + inset, U - inset, V - inset, 19, 8), '#d5ae59', width, true, -0.4);
    if (marble)
      for (const u of [-U + 35, U - 35])
        for (const v of [-V + 35, V - 35]) {
          polygon(
            [
              [u, v - 10],
              [u + 7, v],
              [u, v + 10],
              [u - 7, v],
            ].map(([x, y]) => world(x, y, -0.3)),
            '#d5ae59',
          );
          line(
            [
              [u, v - 10],
              [u + 7, v],
              [u, v + 10],
              [u - 7, v],
            ],
            '#98733b',
            0.8,
            true,
            -0.2,
          );
        }
  }

  const model = { A, B, outline, material, polygons, lines };
  cache.set(key, model);
  return model;
}
