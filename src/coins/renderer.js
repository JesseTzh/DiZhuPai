import { createCanvasRenderer } from '../engine/canvas-renderer.js';

export function createCoinRenderer(art, svg) {
  return createCanvasRenderer(art, svg, () => import('./cpu-renderer.js'));
}
