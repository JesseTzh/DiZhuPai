import { COIN_T } from '../coins/coin.js';
import { world } from './table.js';

export const TRANSFER_DURATION = 2.35;
export const TRANSFER_COLLECT_AT = 1.2;
export const STEAL_DURATION = 0.62;
const clamp = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => t * t * (3 - 2 * t);
export function transferTiming(amount, index) {
  const stagger = amount <= 1 ? 0 : index / (amount - 1);
  return { spill: 0.09 + stagger * 0.16, collect: TRANSFER_COLLECT_AT + stagger * 0.2 };
}
export function coinScatterSeed() {
  return Math.floor(Math.random() * 0x100000000);
}
const randomAt = (seed, index, axis) => {
  let n = (seed ^ Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(axis + 1, 0x27d4eb2d)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
};
// One continuous path per coin: mouth -> scattered landing -> rest -> other mouth.
export function transferCoinPose(transfer, index, elapsed, source, target) {
  const { spill, collect } = transferTiming(transfer.amount, index);
  if (elapsed < spill || elapsed >= (transfer.decorative ? TRANSFER_DURATION : collect + 0.78))
    return null;
  const row = transfer.from === 0 ? 180 : -165;
  // One seed per spill: randomized inside the table, stable for every animation frame.
  const seed = transfer.scatterSeed ?? 7;
  const ground = world(
    -315 + (randomAt(seed, index, 0) - 0.5) * 46,
    row + (transfer.from === 0 ? -1 : 1) * (90 + randomAt(seed, index, 1) * 100),
    COIN_T / 2 + 0.6,
  );
  if (elapsed < collect || transfer.decorative) {
    const t = clamp((elapsed - spill) / 0.58);
    const bounce = clamp((elapsed - spill - 0.58) / 0.16);
    const c = source.map((q, k) => q + (ground[k] - q) * ease(t));
    c[2] =
      source[2] +
      (ground[2] - source[2]) * t +
      58 * Math.sin(Math.PI * t) +
      (t === 1 ? 6 * Math.sin(Math.PI * bounce) : 0);
    return {
      c:
        transfer.decorative && elapsed > TRANSFER_DURATION - 0.25
          ? [c[0], c[1], c[2] - 18 * clamp((elapsed - TRANSFER_DURATION + 0.25) / 0.25)]
          : c,
      tilt: (1 - ease(t)) * (index + t * 10),
      heading: index * 0.7,
      psi: index + t * 7,
      phase: t < 1 ? 'spill' : bounce < 1 ? 'bounce' : 'rest',
    };
  }
  const t = clamp((elapsed - collect) / 0.78),
    e = ease(t);
  const c = ground.map((q, k) => q + (target[k] - (k === 2 ? 16 : 0) - q) * e);
  c[2] += 85 * Math.sin(Math.PI * t);
  return { c, tilt: t * 10, heading: index * 0.7, psi: index + t * 8, phase: 'collect' };
}
