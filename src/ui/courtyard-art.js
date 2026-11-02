// Colorfigures 场景：远景、枝叶与云纹均由路径绘制，不读取图片。
const INK = '#66513b';
function path(ctx, points, fill, stroke = INK, width = 1.5) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}
function foliage(ctx, x, y, scale, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  for (let j = 0; j < 11; j++) {
    const a = j * 2.4 + seed;
    const cx = Math.cos(a) * (18 + (j % 3) * 19);
    const cy = Math.sin(a) * (18 + (j % 4) * 12);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.bezierCurveTo(-20, -16, -13, -21, -5, -13);
    ctx.bezierCurveTo(1, -29, 18, -18, 14, -9);
    ctx.bezierCurveTo(40, -13, 38, 10, 25, 12);
    ctx.bezierCurveTo(20, 29, 3, 21, 2, 14);
    ctx.bezierCurveTo(-14, 29, -29, 17, -22, 8);
    ctx.closePath();
    ctx.fillStyle = ['#7c8e72', '#97a181', '#667f70', '#b0ad82'][j % 4];
    ctx.fill();
    ctx.strokeStyle = '#5c6a59';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
export function drawCloud(ctx, x, y, scale = 1, mirror = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * mirror, scale);
  ctx.beginPath();
  ctx.moveTo(-100, 48);
  ctx.bezierCurveTo(-110, 20, -83, 8, -66, 15);
  ctx.bezierCurveTo(-80, -15, -35, -35, -16, -12);
  ctx.bezierCurveTo(-5, -48, 42, -39, 44, -11);
  ctx.bezierCurveTo(86, -19, 90, 24, 70, 31);
  ctx.bezierCurveTo(95, 29, 104, 48, 137, 49);
  ctx.bezierCurveTo(91, 58, 91, 76, 48, 63);
  ctx.bezierCurveTo(25, 92, -10, 73, -19, 65);
  ctx.bezierCurveTo(-42, 86, -76, 72, -76, 60);
  ctx.closePath();
  ctx.fillStyle = '#ffebbb';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#d8a363';
  ctx.stroke();
  ctx.strokeStyle = '#efbf7b';
  for (const [cx, cy, r] of [
    [-48, 33, 19],
    [14, 12, 20],
    [42, 47, 15],
    [-15, 56, 12],
  ]) {
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2.2;
      const d = r * (1 - i / 43);
      const px = cx + Math.cos(a) * d,
        py = cy + Math.sin(a) * d;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}
export function paintCourtyard(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#cad9ca');
  sky.addColorStop(0.45, '#ece1bb');
  sky.addColorStop(1, '#9aab8b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  const k = Math.max(0.55, Math.min(width / 1672, height / 941));
  // 远景以低对比的色块表示，桌边枝干承托近景树冠。
  for (let side = 0; side < 2; side++) {
    ctx.save();
    ctx.translate(side ? width : 0, 0);
    ctx.scale(side ? -1 : 1, 1);
    path(
      ctx,
      [
        [-20, 0],
        [72 * k, 0],
        [122 * k, 150 * k],
        [31 * k, height * 0.45],
        [14 * k, height],
        [-25, height],
      ],
      '#997d57',
    );
    path(
      ctx,
      [
        [13 * k, height],
        [43 * k, height * 0.48],
        [131 * k, 134 * k],
        [109 * k, 112 * k],
        [16 * k, height * 0.44],
        [-10, height],
      ],
      '#c0a077',
    );
    for (const j of [0, 1, 6, 7])
      foliage(ctx, (j % 3) * 35 * k, (j * height) / 7, (0.7 + (j % 3) * 0.13) * k, j + side * 3);
    for (const [x, y] of [
      [155, 12],
      [255, -29],
      [48, 151],
    ])
      foliage(ctx, x * k, y * k, 0.65 * k, x);
    ctx.restore();
  }
  for (let i = 0; i < 14; i++) {
    const x = (((i * 179 + 53) % 1672) / 1672) * width;
    const y = i % 2 ? height - (19 + (i % 4) * 13) * k : (13 + (i % 4) * 9) * k;
    path(
      ctx,
      [
        [x - 8 * k, y],
        [x + 2 * k, y - 5 * k],
        [x + 12 * k, y - 4 * k],
        [x + 4 * k, y + 4 * k],
      ],
      i % 3 ? '#d7b16e' : '#e8a183',
      '#b68e61',
      0.7,
    );
  }
}
export function mountCourtyard(stage) {
  const canvas = document.createElement('canvas');
  canvas.id = 'courtyard-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);
  const paint = () => {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    if (!w || !h) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paintCourtyard(ctx, w, h);
  };
  new ResizeObserver(paint).observe(stage);
  paint();
}
