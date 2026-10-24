// The dealing phase owns this timeline, keeping input and the computer locked
// until the chosen card has landed. Reuse its pose for shadows and hit regions.
export const DEAL_DURATION = 2.1;
export const WILD_REVEAL_DURATION = 1.2;
const clamp = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => t * t * (3 - 2 * t);
export const dealDuration = (game) =>
  DEAL_DURATION + (game.wildCard != null ? WILD_REVEAL_DURATION : 0);

export function wildReveal(pose, time, dealing) {
  if (!dealing) return { pose, wild: true, dynamic: false };
  const t = time - DEAL_DURATION;
  if (t <= 0) return { pose, wild: false, dynamic: false };
  const lift = ease(clamp(t / 0.26)) * (1 - ease(clamp((t - 0.9) / 0.3)));
  const turn = ease(clamp((t - 0.26) / 0.64));
  return {
    pose: { ...pose, v: pose.v - lift * 30, z: pose.z + lift * 55, flip: turn * Math.PI * 2 },
    wild: turn >= 0.5,
    dynamic: t < WILD_REVEAL_DURATION,
  };
}
