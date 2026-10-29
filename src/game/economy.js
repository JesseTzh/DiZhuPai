import { rankOf } from './rules.js';

export const INITIAL_COINS = 500;
export const coinBagCount = (balance) => Math.min(40, Math.max(0, balance / 25));
export const cardPoints = (id) => ({ 16: 18, 17: 20 })[rankOf(id)] ?? rankOf(id);
export const playPoints = (cards) => cards.reduce((sum, id) => sum + cardPoints(id), 0);

export function passCost(game) {
  if (!game.target) return 0;
  const points = [null, null];
  points[game.target.player] = playPoints(game.target.cards);
  for (let i = game.history.length - 1; i >= 0; i--) {
    const entry = game.history[i];
    if (entry.type !== 'play') break;
    if (points[entry.player] === null) points[entry.player] = playPoints(entry.cards);
    if (points.every((value) => value !== null)) break;
  }
  return Math.abs((points[0] ?? 0) - (points[1] ?? 0));
}
