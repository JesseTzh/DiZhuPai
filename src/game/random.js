// 可复现随机：字符串种子派生独立伪随机流，同一种子走出同一场对局。
// 发牌与商店按（种子, 用途, 局数）派生，因此只需持久化种子字符串，无需保存流的内部状态。
export const SEED_MAX_LENGTH = 32;

// cyrb128：任意文本 → 32 位摘要，只做整数运算，跨引擎结果一致。
function hashSeed(text) {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

// mulberry32：单 32 位状态的 PRNG，返回 [0, 1)。
function stream(state) {
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deriveRng(seed, ...labels) {
  return stream(hashSeed([String(seed ?? ''), ...labels].join('\u0000')));
}

// 未指定种子时为新一局生成一个可分享的短种子。
export function randomSeedString() {
  let seed = '';
  for (let i = 0; i < 8; i++) seed += Math.floor(Math.random() * 36).toString(36);
  return seed;
}

// 对局随机源：有种子时按用途和局数派生，无种子（旧存档、性能页）保持真随机。
export function gameRandom(game, purpose) {
  return game.seed == null ? Math.random : deriveRng(game.seed, purpose, game.round);
}
