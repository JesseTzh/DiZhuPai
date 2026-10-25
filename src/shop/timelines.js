import { lerp, smooth, clamp01 } from '../engine/stage3d.js';
import { GOOSE_REST } from './goose.js';

/* Animation timelines: goose purchase sequence over 3.6 s; idle glances and hand rubbing.
 * Every timeline ends in a held pose so drawing can stop. Toy showcase animations live with
 * their toys in src/assets/items/<id>.js. */

// goose: purchase sequence
export const BUY_TIME = 3.7;
export function goosePurchase(t) {
  const p = { ...GOOSE_REST };
  p.reach = smooth(t / 0.5) * (1 - smooth((t - 2.25) / 0.4));
  p.ledger = smooth((t - 0.25) / 0.35) * (1 - smooth((t - 2.3) / 0.3));
  p.open = smooth((t - 0.6) / 0.3) * (1 - smooth((t - 2.05) / 0.25));
  p.brush = smooth((t - 0.6) / 0.25) * (1 - smooth((t - 2) / 0.25));
  p.ink = clamp01((t - 0.9) / 0.35) + clamp01((t - 1.3) / 0.3) + clamp01((t - 1.65) / 0.35);
  p.write = t;
  p.lookDown = smooth((t - 0.4) / 0.3) * (1 - smooth((t - 2.1) / 0.3));
  p.look = -0.6 * p.lookDown;
  const laugh = clamp01((t - 2.45) / 0.15) * (1 - clamp01((t - 3.55) / 0.15));
  p.laugh = laugh;
  p.beak = laugh * Math.abs(Math.sin((t - 2.45) * Math.PI * 4.2));
  p.tilt = laugh * (0.55 + 0.25 * Math.sin((t - 2.45) * Math.PI * 4.2));
  p.turn = -22 * laugh;
  p.bob = laugh * Math.abs(Math.sin((t - 2.45) * Math.PI * 4.2)) * 2.5;
  p.lid = lerp(GOOSE_REST.lid, 0.15, p.lookDown);
  return p;
}
