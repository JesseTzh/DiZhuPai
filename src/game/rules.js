import { cardDeck } from '../assets/cards/deck.js';

export const rankOf = (id) => {
  const c = cardDeck[id];
  return c.kind === 'joker'
    ? c.variant === 'red'
      ? 17
      : 16
    : { J: 11, Q: 12, K: 13, A: 14, 2: 15 }[c.rank] || +c.rank;
};
// The stamp lifts one card a rank for the whole round; the wild card keeps its own override.
export const rankIn = (id, options = null, wildRank = null) =>
  id === options?.wildCard && wildRank != null
    ? wildRank
    : id === options?.stamp?.card
      ? options.stamp.rank
      : rankOf(id);
export const sortHand = (cards, options = null) =>
  [...cards].sort((a, b) => rankIn(b, options) - rankIn(a, options) || a - b);
const groups = (cards, options = null, wildRank = null) => {
  const m = new Map();
  for (const id of cards) {
    const r = rankIn(id, options, wildRank);
    if (!m.has(r)) m.set(r, []);
    m.get(r).push(id);
  }
  return [...m].sort(([a], [b]) => a - b);
};
const consecutive = (rs) => rs.at(-1) <= 14 && rs.every((r, i) => !i || r === rs[i - 1] + 1);
const names = {
  single: '单张',
  pair: '对子',
  triple: '三张',
  tripleSingle: '三带一',
  triplePair: '三带二',
  straight: '顺子',
  pairs: '连对',
  plane: '飞机',
  planeSingle: '飞机带单',
  planePair: '飞机带对',
  fourSingle: '四带二',
  fourPair: '四带两对',
  bomb: '炸弹',
  rocket: '王炸',
};
function classifyAs(cards, options = {}, wildRank = null) {
  if (
    !cards.length ||
    new Set(cards).size !== cards.length ||
    cards.some((id) => !Number.isInteger(id) || !cardDeck[id])
  )
    return null;
  const g = groups(cards, options, wildRank),
    n = cards.length,
    rs = g.map(([r]) => r);
  const out = (type, main) => ({ type, main, length: n, name: names[type] });
  if (n === 2 && rs.join() === '16,17') return out('rocket', 17);
  if (g.length === 1)
    return n <= 4 ? out(['', 'single', 'pair', 'triple', 'bomb'][n], rs[0]) : null;
  if (n >= (options.shortStraight ? 4 : 5) && g.length === n && consecutive(rs))
    return out('straight', rs.at(-1));
  if (n >= 6 && g.every(([, a]) => a.length === 2) && consecutive(rs))
    return out('pairs', rs.at(-1));
  const triple = g.find(([, a]) => a.length === 3);
  if (triple && n === 4) return out('tripleSingle', triple[0]);
  if (triple && n === 5 && (g.length === 2 || options.looseTriple))
    return out('triplePair', triple[0]);
  const four = g.find(([, a]) => a.length === 4);
  if (four && n === 6) return out('fourSingle', four[0]);
  if (
    four &&
    n === 8 &&
    g.length === 3 &&
    g.filter(([r]) => r !== four[0]).every(([, a]) => a.length === 2)
  )
    return out('fourPair', four[0]);
  for (const [type, size] of [
    ['plane', 3],
    ['planeSingle', 4],
    ['planePair', 5],
  ]) {
    const k = n / size;
    if (!Number.isInteger(k) || k < 2) continue;
    for (let start = 3; start + k - 1 <= 14; start++) {
      const core = Array.from({ length: k }, (_, i) => start + i);
      if (!core.every((r) => g.some(([q, a]) => q === r && a.length === 3))) continue;
      const rest = g.filter(([r]) => !core.includes(r));
      if (
        (type === 'plane' && !rest.length) ||
        (type === 'planeSingle' &&
          rest.reduce((s, [, a]) => s + a.length, 0) === k &&
          !rest.some(([, a]) => a.length === 4) &&
          !(rest.some(([r]) => r === 16) && rest.some(([r]) => r === 17))) ||
        (type === 'planePair' && rest.length === k && rest.every(([, a]) => a.length === 2))
      )
        return out(type, core.at(-1));
    }
  }
  return null;
}
// One physical wild card may stand for any ordinary rank, never a joker.
// Prefer its printed value, then the lowest interpretation that can beat the target.
export function classify(cards, options = {}, target = null) {
  const natural = classifyAs(cards, options);
  if (!cards.includes(options.wildCard)) return natural;
  if (natural && beats(natural, target, options)) return natural;
  const candidates = [];
  for (let rank = 3; rank <= 15; rank++) {
    const move = classifyAs(cards, options, rank);
    if (move && beats(move, target, options)) candidates.push({ ...move, wildRank: rank });
  }
  return (
    candidates.sort((a, b) => (a.type === 'bomb') - (b.type === 'bomb') || a.main - b.main)[0] ||
    natural
  );
}
export function beats(move, target, options = {}) {
  if (!move) return false;
  if (!target) return true;
  if (target.type === 'rocket') return false;
  if (move.type === 'rocket') return true;
  if (move.type === 'bomb' && target.type !== 'bomb') return true;
  if (move.type !== target.type || move.length !== target.length) return false;
  // The balance scale lets an equal response tip the comparison its way.
  return move.main > target.main || (options.equalBeat && move.main === target.main);
}
function combinations(list, k, visit, chosen = [], from = 0) {
  if (!k) {
    visit(chosen);
    return;
  }
  for (let i = from; i <= list.length - k; i++)
    combinations(list, k - 1, visit, [...chosen, list[i]], i + 1);
}
export function legalMoves(hand, target = null, options = {}) {
  const result = [],
    seen = new Set();
  const add = (cards) => {
    const move = classify(cards, options, target);
    if (!beats(move, target, options)) return;
    const key = [...cards].sort((a, b) => a - b).join();
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ ...move, cards: sortHand(cards, options) });
    }
  };
  const variants = hand.includes(options.wildCard)
    ? [null, ...Array.from({ length: 13 }, (_, i) => i + 3)]
    : [null];
  for (const wildRank of variants) {
    const g = groups(hand, options, wildRank);
    const wings = (core, k, pairs = false) => {
      const ranks = new Set(core.map((id) => rankIn(id, options, wildRank))),
        rest = g.filter(([r]) => !ranks.has(r));
      if (pairs)
        combinations(
          rest.filter(([, a]) => a.length >= 2),
          k,
          (xs) => add([...core, ...xs.flatMap(([, a]) => a.slice(0, 2))]),
        );
      else
        combinations(
          rest.flatMap(([, a]) => a),
          k,
          (xs) => add([...core, ...xs]),
        );
    };
    for (const [, a] of g) {
      for (let n = 1; n <= a.length; n++) add(a.slice(0, n));
      if (a.length >= 3) {
        wings(a.slice(0, 3), 1);
        wings(a.slice(0, 3), 1, true);
        if (options.looseTriple) wings(a.slice(0, 3), 2);
      }
      if (a.length === 4) {
        wings(a, 2);
        wings(a, 2, true);
      }
    }
    if (hand.includes(52) && hand.includes(53)) add([52, 53]);
    for (let count = 1; count <= 3; count++) {
      const min = [0, options.shortStraight ? 4 : 5, 3, 2][count];
      for (let start = 3; start <= 14; start++) {
        let core = [];
        for (let r = start; r <= 14; r++) {
          const a = g.find(([q]) => q === r)?.[1];
          if (!a || a.length < count) break;
          core.push(...a.slice(0, count));
          const len = r - start + 1;
          if (len < min) continue;
          add(core);
          if (count === 3) {
            wings(core, len);
            wings(core, len, true);
          }
        }
      }
    }
  }
  return result;
}
export function chooseMove(hand, target, opponentCount = 18, options = {}) {
  const moves = legalMoves(hand, target, options);
  const score = (m) => {
    if (m.cards.length === hand.length) return -10000;
    const remaining = groups(hand.filter((id) => !m.cards.includes(id)));
    return (
      remaining.length * 9 -
      m.cards.length * 3 +
      m.main * 0.35 +
      (['bomb', 'rocket'].includes(m.type) ? 32 : 0) +
      (target && opponentCount <= 2 ? -m.main * 1.2 : 0)
    );
  };
  return moves.sort((a, b) => score(a) - score(b) || a.main - b.main)[0] || null;
}
