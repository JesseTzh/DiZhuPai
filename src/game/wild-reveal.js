// The dealing phase owns this timeline, keeping input and the computer locked
// until the chosen card has landed. Reuse its pose for shadows and hit regions.
export const DEAL_DURATION = 2.1;
export const WILD_REVEAL_DURATION = 1.2;
export const STAMP_REVEAL_DURATION = 1.6;
const clamp = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => t * t * (3 - 2 * t);
export const stampStart = (game) =>
  DEAL_DURATION + (game.wildCard != null ? WILD_REVEAL_DURATION : 0);
export const dealDuration = (game) => stampStart(game) + (game.stamp ? STAMP_REVEAL_DURATION : 0);

export function wildReveal(pose, time, dealing) {
  if (!dealing) return { pose, wild: true, dynamic: false };
  const t = time - DEAL_DURATION;
  if (t <= 0) return { pose, wild: false, dynamic: false };
  const lift = ease(clamp(t / 0.26)) * (1 - ease(clamp((t - 0.9) / 0.3)));
  const turn = ease(clamp((t - 0.26) / 0.64));
  return {
    pose: {
      ...pose,
      v: pose.v - lift * 30,
      z: pose.z + lift * 55,
      flip: pose.flip + turn * Math.PI * 2,
    },
    wild: turn >= 0.5,
    dynamic: t < WILD_REVEAL_DURATION,
  };
}

/* The stamped card flips like the wild reveal, then arcs out of its old slot and
 * settles into the slot its upgraded rank sorts to; neighbours slide out of the way. */
export function stampReveal(t) {
  if (t <= 0) return { flip: 0, hop: 0, stamped: false, dynamic: true };
  const turn = ease(clamp((t - 0.05) / 0.4));
  return {
    flip: turn * Math.PI * 2,
    hop: Math.sin(Math.PI * clamp((t - 0.02) / 0.78)) * 46,
    stamped: turn >= 0.5,
    dynamic: t < 1,
  };
}
export const stampSlide = (t) => ease(clamp((t - 0.12) / 0.62));
