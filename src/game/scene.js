import { TRANSFER_DURATION, TRANSFER_COLLECT_AT, STEAL_DURATION } from './transfer.js';
import { coinState, coinStep } from '../coins/scene.js';
import { createCanvasRenderer } from '../engine/canvas-renderer.js';
export { world } from './table.js';
export { playerPalette, bagPosition, deckPosition, handPose } from './scene-frame.js';
export { DEAL_DURATION } from './wild-reveal.js';
export function makeVisual() {
  return {
    time: 0,
    dealTime: 0,
    playTime: 2,
    playFrom: null,
    transfer: null,
    spill: null,
    steal: null,
    bags: [coinState(), coinState()],
  };
}

export function createGameRenderer(art, svg) {
  return createCanvasRenderer(art, svg, () => import('./cpu-renderer.js'));
}
export function stepVisual(st, dt) {
  const v = st.visual;
  v.time += dt;
  v.playTime += dt;
  let active = v.playTime < 0.4;
  for (let p = 0; p < 2; p++) {
    const tr = v.transfer;
    let balance = st.game.coins[p];
    if (tr?.before) {
      const elapsed = v.time - tr.start;
      const progress = Math.max(
        0,
        Math.min(
          1,
          (elapsed - (p === tr.from ? 0.09 : TRANSFER_COLLECT_AT + 0.6)) /
            (p === tr.from ? 0.65 : 0.4),
        ),
      );
      balance = tr.before[p] + (st.game.coins[p] - tr.before[p]) * progress;
      if (p !== tr.from && elapsed > TRANSFER_COLLECT_AT + 0.6 && elapsed < TRANSFER_DURATION - 0.1)
        v.bags[p].squash = 0.055;
    }
    // Fixed capacity makes equal transfers visibly inflate one sack and deflate the other.
    v.bags[p].count = Math.min(40, Math.max(0, balance / 5));
    active = coinStep(v.bags[p], dt) || active;
  }
  if (v.transfer) {
    if (v.time - v.transfer.start > TRANSFER_DURATION) v.transfer = null;
    else active = true;
  }
  if (v.spill) {
    if (v.time - v.spill.start > TRANSFER_DURATION) v.spill = null;
    else active = true;
  }
  if (v.steal) {
    if (v.time - v.steal.start > STEAL_DURATION) v.steal = null;
    else active = true;
  }
  return active;
}
