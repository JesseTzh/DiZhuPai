import { facing, tone } from '../engine/shading.js';
import { norm } from '../engine/math.js';
import { INK } from '../engine/palette.js';
import { world } from './table.js';
import { drawTableItemShadow } from './table-items.js';

/* The bottom layer of the table scene: the table's cast shadow, side walls, top, grain and
 * the soft shadows of the items standing on it. Nothing here moves while the camera rests,
 * so the renderer keeps it as one retained sprite. */
export function paintTable(canvas, table, items) {
  const { A, B, outline, material } = table;
  canvas.shadow([...A, ...B], -22);
  for (let i = 0; i < A.length; i++) {
    const j = (i + 1) % A.length,
      n = norm(world(outline[j][1] - outline[i][1], outline[i][0] - outline[j][0]));
    if (facing(n)) canvas.polygon([A[i], A[j], B[j], B[i]], tone(n, material), INK, 0.5);
  }
  canvas.polygon(B, material.l, INK, 1.7);
  for (const { points, color } of table.polygons) canvas.polygon(points, color);
  for (const { points, color, width, closed } of table.lines)
    canvas.line(points, color, width, closed);
  for (const model of items) drawTableItemShadow(canvas, model, B);
}
