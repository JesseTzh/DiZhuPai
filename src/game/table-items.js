import { TOYS, toyGeometry } from '../assets/items/index.js';
import { world } from './table.js';
import { norm, hull } from '../engine/math.js';
import { depthOf, sepOrder, sp } from '../engine/camera.js';
import { facing, tone, SH, SHADOW_LEN, SHADOW_K } from '../engine/shading.js';
import { INK, SHADOW } from '../engine/palette.js';

const cache = new Map();
// Keep the little collection in the money bag's corner, clear of the hand and coin landing area.
export function tableItemModel(id) {
  const key = id;
  if (cache.has(key)) return cache.get(key);
  const { u, v } = TOYS[id].table,
    scale = 0.25,
    map = ([x, y, z]) => world(u + x * scale, v + y * scale, 1 + z * scale);
  const parts = toyGeometry(id).map((part) => {
    const points = part.points.map(map),
      box = [0, 1].map((end) =>
        [0, 1, 2].map((axis) => (end ? Math.max : Math.min)(...points.map((p) => p[axis]))),
      );
    return {
      points,
      box,
      at: map(part.box[0].map((q, k) => (q + part.box[1][k]) / 2)),
      palette: { l: part.palette[0], m: part.palette[1], d: part.palette[2] },
      faces: part.faces.map((face) => ({
        points: face.points.map(map),
        normal: norm(world(...face.normal)),
      })),
    };
  });
  const points = parts.flatMap((part) => part.points),
    box = [0, 1].map((end) =>
      [0, 1, 2].map((axis) => (end ? Math.max : Math.min)(...points.map((p) => p[axis]))),
    );
  const model = { parts, points, box, at: world(u, v, 20) };
  cache.set(key, model);
  return model;
}

export function drawTableItem(canvas, model) {
  const order = (a, b) => sepOrder(a, b) || depthOf(a.at) - depthOf(b.at);
  for (const part of [...model.parts].sort(order)) {
    const faces = part.faces.filter((face) => facing(face.normal));
    for (const face of faces) {
      const color = tone(face.normal, part.palette);
      canvas.polygon(face.points, color, color, 0.35);
    }
    const outline = hull(part.points.map((p) => canvas.project(p))),
      ctx = canvas.ctx;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.7;
    const path = new Path2D(sp(outline));
    ctx.stroke(path);
  }
}

export const tableItemHit = (canvas, model) => sp(hull(model.points.map((p) => canvas.project(p))));

export function drawTableItemShadow(canvas, model, clip) {
  const ctx = canvas.ctx,
    cast = new Path2D(),
    contact = new Path2D(),
    k = SHADOW_LEN / SHADOW_K;
  // Union the component silhouettes in one fill, preserving gaps between limbs
  // without dark seams where their shadows overlap.
  for (const part of model.parts) {
    const project = (points, offset) =>
      hull(
        points.map(([x, y, z]) =>
          canvas.project([x + z * SH[0] * offset, y + z * SH[1] * offset, 0]),
        ),
      );
    cast.addPath(new Path2D(sp(project(part.points, k))));
    const feet = part.points.filter((p) => p[2] <= 6);
    if (feet.length >= 3) contact.addPath(new Path2D(sp(project(feet, 0))));
  }
  ctx.save();
  ctx.clip(canvas.path(clip));
  ctx.fillStyle = SHADOW;
  const scale = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
  ctx.globalAlpha = 0.18;
  ctx.filter = `blur(${1.6 * scale}px)`;
  ctx.fill(cast);
  ctx.filter = 'none';
  ctx.globalAlpha = 0.27;
  ctx.fill(cast);
  ctx.globalAlpha = 0.32;
  ctx.filter = `blur(${0.45 * scale}px)`;
  ctx.fill(contact);
  ctx.restore();
}
