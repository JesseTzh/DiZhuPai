import { tableGeometry } from '../game/table-geometry.js';
import { INK, SHADOW } from '../engine/palette.js';
import { itemDetails, wrapItemText } from './item-presentation.js';

const shape = (ctx, path, fill, stroke = INK, width = 1.5) => {
  const p = new Path2D(path);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(p);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke(p);
  }
};
const icons = {
  kerchief: [
    ['M10 27 6 36 17 33 22 39 26 28Z', '#5a82c6'],
    ['M12 27Q9 9 25 8 40 10 38 28L25 33Z', '#a9c8ef'],
    ['M12 27 25 20 38 28 25 34Z', '#76a0e2'],
    ['M25 20 23 11M17 27 25 24 32 28', null],
    ['M24 30 30 32 27 38 21 35Z', '#d7e8fa'],
  ],
  topHat: [
    ['M6 32Q24 22 42 32V36Q25 45 6 36Z', '#343c60'],
    ['M6 31Q24 22 42 31 25 40 6 31Z', '#a9c8ef'],
    ['M14 29 12 10Q24 4 36 10L34 29Q24 34 14 29Z', '#5a82c6'],
    ['M12 10Q24 16 36 10 24 3 12 10Z', '#a9c8ef'],
    ['M14 23Q24 28 35 23L34 29Q24 34 14 29Z', '#f3a6bb'],
    ['M17 14 18 21', null],
  ],
  crown: [
    ['M11 29 8 12 19 21 25 7 31 21 42 12 38 31Z', '#f4b829'],
    ['M8 12 19 21 25 7 25 27 11 29Z', '#ffe194'],
    ['M11 29Q25 34 38 29L37 36Q24 42 12 36Z', '#d49c1f'],
    ['M12 30Q25 35 38 30L37 34Q24 39 12 34Z', '#ffe194'],
    ['M22 29 25 25 28 29 25 33Z', '#ef6a4c'],
    [
      'M6 10a2 2 0 1 0 4 0a2 2 0 1 0-4 0M23 5a2 2 0 1 0 4 0a2 2 0 1 0-4 0M40 10a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
      '#ffe194',
    ],
  ],
  coins: [
    ['M8 29v6c0 7 25 7 25 0v-6', '#c68b2b'],
    ['M8 29a12.5 5 0 1 0 25 0a12.5 5 0 1 0-25 0', '#ffe194'],
    ['M17 17v7c0 7 25 7 25 0v-7', '#d6a032'],
    ['M17 17a12.5 5 0 1 0 25 0a12.5 5 0 1 0-25 0', '#ffe194'],
    ['M25 16h8m-4-2v5M13 34v3m7-2v4m15-16v3', null],
  ],
  frog: [
    ['M10 33 14 17h20l5 16-15 6Z', '#65a784'],
    ['M11 29c0-9 26-9 26 0v3c-4 7-22 7-26 0Z', '#93d3b0'],
    ['M9 17a7 7 0 1 0 14 0a7 7 0 1 0-14 0', '#c5edcc'],
    ['M25 17a7 7 0 1 0 14 0a7 7 0 1 0-14 0', '#c5edcc'],
    ['M16 16v3m16-3v3m-14 9q6 5 12 0', null],
  ],
  hand: [
    [
      'M16 36 8 24q-2-5 2-5l7 6V13q0-6 4-4v13-16q4-4 5 1v15-13q4-3 5 2v13-9q5-2 5 3v13l-7 8Z',
      '#f3a6bb',
    ],
    ['M16 36 29 39v5l-13-3Z', '#c37694'],
    ['M20 28 28 30', null],
  ],
  dragon: [
    ['M8 31q10 9 17-1t13-11l-7-9-12 6 7 6q-6 2-7 8t-11 1Z', '#f4b829'],
    ['M20 15 21 8 26 13m4-2 4-6 1 10', '#e58448'],
    ['M30 22 40 23 38 30 30 28', '#ffe194'],
    ['M30 17h.1M12 31l3-5m5 3 2-5', null],
  ],
};

export function drawIcon(ctx, name, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 48, size / 48);
  shape(ctx, 'M7 39 30 44 44 36 21 32Z', '#829ac7', null);
  for (const [path, fill] of icons[name] || [
    ['M12 12H36V36H12Z', '#fff4d6'],
    ['M18 24H30M24 18V30', null],
  ])
    shape(ctx, path, fill, INK, 2);
  ctx.restore();
}

export function drawGear(ctx, x, y, size, focused) {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.scale(size / 32, size / 32);
  const points =
    Array.from({ length: 32 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 16;
      const r = i % 4 < 2 ? 12.8 : 9.8;
      return `${i ? 'L' : 'M'}${Math.cos(a) * r} ${Math.sin(a) * r}`;
    }).join('') + 'Z';
  ctx.save();
  ctx.translate(1.5, 2);
  shape(ctx, points, SHADOW, null);
  ctx.restore();
  shape(ctx, points, focused ? '#c5edcc' : '#93d3b0', INK, 1.7);
  shape(ctx, 'M-6.3 0a6.3 6.3 0 1 0 12.6 0a6.3 6.3 0 1 0-12.6 0', '#fff4d6');
  shape(ctx, 'M-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', '#93d3b0');
  ctx.restore();
}

export function label(ctx, value, x, y, size = 11, weight = 600, color = INK) {
  ctx.font = `${weight} ${size}px ui-monospace, 'PingFang SC', 'Microsoft YaHei', sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

export function roundPanel(ctx, x, y, w, h, fill, radius = 8) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

// Reuse the tabletop's palette, grain, knots, nails and inlay. The board is a shallow solid.
export function drawBoard(ctx, width, height, style, stage = 1) {
  const { material, lines, polygons } = tableGeometry(style);
  const w = width - 10,
    h = height - 12;
  ctx.save();
  ctx.translate(3, 3);
  ctx.save();
  ctx.translate(4, 7);
  roundPanel(ctx, 0, 0, w, h, SHADOW, 10);
  ctx.restore();
  roundPanel(ctx, 0, 5, w, h, material.d, 10);
  roundPanel(ctx, 0, 0, w, h, material.l, 10);
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 10);
  ctx.clip();
  const stageAccent = ['#5a82c6', '#bd6b46', '#8a6bb5'][Math.max(0, Math.min(2, stage - 1))];
  ctx.beginPath();
  ctx.roundRect(8, 4, w - 16, h - 8, 7);
  ctx.strokeStyle = stageAccent;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = style === 'marble' ? 0.34 : 0.28;
  ctx.stroke();
  ctx.globalAlpha = 1;
  const point = ([x, y]) => [
    (((x - y) / Math.SQRT2 + 365) / 730) * w,
    (((x + y) / Math.SQRT2 + 265) / 530) * h,
  ];
  // The tabletop keeps its material and grain direction, but the shallow header only
  // carries a few of the longest marks so the surface reads as wood instead of noise.
  const stride = stage === 2 ? 4 : stage >= 3 ? 5 : 3;
  const sparseLines = lines.filter(
    (line, index) => line.closed || index < 5 || index % stride === 0,
  );
  for (const line of sparseLines) {
    ctx.beginPath();
    line.points.forEach((p, i) => {
      const q = point(p);
      if (i) ctx.lineTo(...q);
      else ctx.moveTo(...q);
    });
    if (line.closed) ctx.closePath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = Math.min(1, line.width * 0.65);
    ctx.globalAlpha = style === 'marble' ? 0.34 : style === 'walnut' ? 0.42 : 0.46;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const polygon of polygons) {
    const p = point(polygon.points[0]);
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], 1.6, 1.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = polygon.color;
    ctx.fill();
  }
  ctx.restore();
}

export function drawItemHint(ctx, item, x, y, width) {
  const { title, description, footer } = itemDetails(item);
  ctx.save();
  ctx.font = "500 11px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const rows = wrapItemText(ctx, description, width - 24);
  const footerRows = wrapItemText(ctx, footer, width - 24);
  const height = 48 + (rows.length + footerRows.length) * 17;
  ctx.translate(x, y);
  roundPanel(ctx, 3, 4, width, height, '#829ac7');
  roundPanel(ctx, 0, 0, width, height, '#fff4d6');
  label(ctx, title, 12, 22, 12, 700);
  rows.forEach((text, i) => label(ctx, text, 12, 44 + i * 17, 11, 500));
  footerRows.forEach((text, i) =>
    label(ctx, text, 12, 51 + (rows.length + i) * 17, 10, 600, '#426b4d'),
  );
  ctx.restore();
  return height;
}

export function stageAppearance(stage) {
  return [
    { icon: 'kerchief', name: '农民头巾' },
    { icon: 'topHat', name: '贵族礼帽' },
    { icon: 'crown', name: '皇冠' },
  ][Math.max(0, Math.min(2, stage - 1))];
}
