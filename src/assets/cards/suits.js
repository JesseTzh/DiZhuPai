import { cardInk, cardRed, cardBlue, cardMint, cardGold } from './palette.js';
import { cardPath } from './primitives.js';

export const suits = [
  { id: 'heart', name: '红桃', english: 'HEARTS', color: cardRed, accent: cardRed },
  { id: 'spade', name: '黑桃', english: 'SPADES', color: cardInk, accent: cardBlue },
  { id: 'diamond', name: '方块', english: 'DIAMONDS', color: cardRed, accent: cardGold },
  { id: 'club', name: '梅花', english: 'CLUBS', color: cardInk, accent: cardMint },
];

// Every suit is a vector silhouette, independent of installed symbol fonts.
const paths = {
  heart: 'M0 6 C-2.7 3.8-6 1.1-6-2 C-6-5.7-1.7-7 0-3.7 C1.7-7 6-5.7 6-2 C6 1.1 2.7 3.8 0 6Z',
  spade:
    'M0-6 C-2.1-3.7-6-.8-6 2 C-6 5.3-2.1 5.9-.8 3.3 L-1.8 6 L1.8 6 L.8 3.3 C2.1 5.9 6 5.3 6 2 C6-.8 2.1-3.7 0-6Z',
  diamond: 'M0-6.5 L5.2 0 L0 6.5 L-5.2 0Z',
  club: 'M-1.4 2.7 C-6.6 6.2-8-1.4-3.5-2.1 C-6-7.3 6-7.3 3.5-2.1 C8-1.4 6.6 6.2 1.4 2.7 L2 6 L-2 6Z',
};

export function cardSuit(kind, x, y, size, col, upside = false) {
  return `<g data-suit="${kind}" transform="translate(${x} ${y}) rotate(${upside ? 180 : 0}) scale(${size / 12})">${cardPath(paths[kind], col, 0.5)}</g>`;
}

export function cardIndex(rank, suit, col) {
  const half = `<text x="6.25" y="9.9" text-anchor="middle" fill="${col}" font-family="Georgia,'Times New Roman',serif" font-size="${rank === '10' ? 7.1 : 8.3}" font-weight="700">${rank}</text>${cardSuit(suit, 6.25, 14.2, 5.2, col)}`;
  return half + `<g transform="translate(63 88) rotate(180)">${half}</g>`;
}
