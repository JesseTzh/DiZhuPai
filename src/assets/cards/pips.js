import { cardIndex, cardSuit } from './suits.js';
import { cardGold, cardCream } from './palette.js';
import { cardPath } from './primitives.js';

const pair = (ys) =>
  ys.flatMap((y) => [
    [21.5, y, y > 44],
    [41.5, y, y > 44],
  ]);
const center = (ys) => ys.map((y) => [31.5, y, y > 44]);

// Actual pip counts and traditional two-way arrangements. The original heart 7 is retained.
export const pipLayouts = {
  A: [[31.5, 44, false]],
  2: center([20, 68]),
  3: center([20, 44, 68]),
  4: pair([20, 68]),
  5: [...pair([20, 68]), ...center([44])],
  6: pair([20, 44, 68]),
  7: [...pair([20, 43.8, 68]), ...center([31.5])],
  8: [...pair([20, 44, 68]), ...center([31.5, 56.5])],
  9: [...pair([18, 35.3, 52.7, 70]), ...center([44])],
  10: [...pair([18, 35.3, 52.7, 70]), ...center([26.6, 61.4])],
};

export function cardPips({ rank, suit, color }) {
  const ace = rank === 'A';
  let art = cardIndex(rank, suit, color);
  art +=
    '<rect x="12.1" y="8.7" width="38.8" height="70.6" rx="1.8" fill="none" stroke="#d9cbb0" stroke-width=".35"/>';
  if (ace) {
    art += cardPath('M31.5 18 L47 44 L31.5 70 L16 44Z', cardCream, 0.4);
    art += cardPath('M31.5 21 L45 44 L31.5 67 L18 44Z', 'none', 0.3);
    for (const y of [22, 66])
      art += cardPath(`M31.5 ${y - 2} l1.6 2 -1.6 2 -1.6-2Z`, cardGold, 0.3);
  }
  art += `<g data-pips="${rank}">${pipLayouts[rank].map(([x, y, upside]) => cardSuit(suit, x, y, ace ? 22 : 10.5, color, upside)).join('')}</g>`;
  return art;
}
