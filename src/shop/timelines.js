import { lerp, smooth, spring, clamp01 } from './stage3d.js';
import { GOOSE_REST } from './goose.js';

/* Animation timelines: hover time t (s) → pose. Every timeline ends in a held pose so drawing can stop. */
export const TOY_TIME = { frog: 1.5, hand: 1.9, dragon: 3.4 };
export function toyPose(id, t) {
  if (id === 'frog') {
    const shoot = clamp01((t - 0.12) / 0.38);
    return {
      mouth: smooth(t / 0.16),
      tongue: shoot > 0 ? spring(shoot) : 0,
      card: shoot > 0 ? Math.min(1, shoot * 2.4) : 0,
      spin: Math.sin(t * 13) * Math.exp(-t * 2.6) * 0.5,
    };
  }
  if (id === 'hand') {
    const wrap = smooth(clamp01((t - 0.12) / 1.1));
    // each turn of gauze yanks the two fingers a little closer
    const yank = Math.min(1, wrap * 3.4 + 0.25),
      step = Math.floor(yank * 4) / 4 + (yank * 4 - Math.floor(yank * 4)) ** 3 / 4;
    return {
      bind: t < 0.12 ? 0 : Math.min(1, 0.35 + 0.65 * step),
      wrap,
      knot: spring(clamp01((t - 1.25) / 0.45)),
      splay: smooth(clamp01(t / 0.3)) * (1 - 0.5 * smooth(clamp01((t - 1.3) / 0.4))),
      shake: Math.sin(t * 46) * 1.2 * (t < 1.4 ? 1 : Math.exp(-(t - 1.4) * 8)),
    };
  }
  // dragon: three struggles, each harder than the last, each pulling the body longer
  const levels = [40, 80, 130, 182],
    starts = [0.1, 0.95, 1.95],
    durs = [0.62, 0.72, 0.86],
    power = [0.38, 0.68, 1];
  let length = levels[0],
    hump = 1,
    phase = 0,
    jitter = 0,
    hop = 0,
    headYaw = 0,
    headPitch = 0,
    effort = 0;
  for (let k = 0; k < 3; k++) {
    const u = (t - starts[k]) / durs[k];
    if (u < 0) break;
    const env = Math.sin(Math.PI * clamp01(u)),
      p = power[k];
    if (u <= 1) {
      // wind up: squeeze shorter, thrash, hop
      effort = Math.max(effort, Math.min(1, env * 1.15) * p + 0.12);
      jitter = env * p * 4.5 * Math.sin(u * (30 + k * 14));
      headYaw = env * p * 42 * Math.sin(u * Math.PI * (3 + k * 2));
      headPitch = env * p * 24 * Math.sin(u * Math.PI * (2 + k));
      hop = env * env * p * 16;
      hump = 1 + env * p * 2.2;
      phase = Math.sin(u * Math.PI * (4 + k * 2)) * env * p * 1.1;
    }
    const pull = clamp01((t - starts[k] - durs[k] * 0.62) / 0.55);
    const squeeze = 1 - 0.14 * p * Math.sin(Math.PI * clamp01(u / 0.62)) * (u < 0.62);
    length = (levels[k] + (levels[k + 1] - levels[k]) * (pull > 0 ? spring(pull) : 0)) * squeeze;
  }
  const settle = clamp01((t - 2.9) / 0.5);
  effort *= 1 - settle;
  return { length, hump, phase, jitter, hop, headYaw, headPitch, effort };
}
export const blend = (a, b, t) =>
  Object.fromEntries(Object.keys(b).map((k) => [k, lerp(a[k] ?? b[k], b[k], t)]));

// goose: purchase sequence over 3.6 s; idle glances and hand rubbing
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
