import { cardInk, cardCream, cardRed, cardBlue, cardGold, cardMint } from './palette.js';
import { cardPath, cardCircle } from './primitives.js';
import { cardSuit } from './suits.js';

export function cardKingHalf(suit, col, accent) {
  let art = '';
  // Sword at left: an actual held sword in the printed portrait, with a pale steel bevel.
  art += cardPath('M18.3 17 L20.2 13.8 L22.2 17 L21.5 34.1 L18.8 34.1Z', '#cbd9d4', 0.55);
  art += cardPath('M20.2 16.5 L20.2 33.8', 'none', 0.3);
  art += cardPath('M16.6 33.5 L23.7 33.5 L23.7 35.6 L16.6 35.6Z', cardGold, 0.55);
  art += cardPath('M19.2 35.6 L21.4 35.6 L21.4 42.9 L19.2 42.9Z', cardMint, 0.5);
  art += cardCircle(20.3, 42.6, 1.65, cardGold, 0.5);
  // Three broad flat-colour robe panels.
  art += cardPath('M28.3 28.5 L39.3 28.9 L49.9 36.4 L49.9 45 L24 45 L24 35.1Z', accent, 0.65);
  art += cardPath('M38.5 29.4 L43.7 32.6 L39.3 45 L30 45 L31.2 32.1Z', cardGold, 0.55);
  art += cardPath('M27.7 29.9 L32.6 33 L27.2 45 L23.8 45 L23.8 35Z', cardMint, 0.55);
  art += cardPath('M45.6 33.8 L49.9 36.4 L49.9 45 L42.1 45Z', cardRed, 0.5);
  // A broad embroidered shoulder, its scalloped white collar and gold chain.
  art += cardPath(
    'M28 28.1 L29.8 26 L38.7 27.1 L42.3 30.7 L38 34 L34.8 31.7 L31.8 33 L28.7 31.2 L26.7 31.7Z',
    cardCream,
    0.55,
  );
  art += cardPath('M31.5 32 L34.2 37.3 L39 33.2', 'none', 0.5);
  art += cardCircle(34.4, 37.6, 1.45, cardRed, 0.4);
  // Neck and a swept silhouette of hair behind the face.
  art += cardPath('M30.6 23.4 L30.5 28.3 L35.1 30.1 L38 27 L36 23Z', '#e9b995', 0.55);
  art += cardPath(
    'M28.3 14.5 C32.2 12.9 37.8 14 39.1 18 L39 25.4 L35.8 27.3 L32.9 23.3 L28.8 23.6Z',
    cardGold,
    0.6,
  );
  // Profile: nose faces left; warm flat shadow, mustache and a forked beard.
  art += cardPath(
    'M29.1 16.3 L35.9 16.2 L36.8 19.4 L36.1 24.7 L33.1 27.1 L29.3 24.5 L29.1 22.9 L26.9 22.2 L28.7 20.3Z',
    '#f3d0ae',
    0.6,
  );
  art += cardPath('M34.8 17.5 L36.4 19.1 L35.7 24.6 L33.1 26.6 L32 24.2 L33.5 21.6Z', '#dfae86', 0);
  art += cardPath(
    'M28.9 23 C30.1 22 31.4 22.2 32 23.1 C33.2 22.1 34.5 22.3 35.8 23 L35.2 26.6 L33.4 29 L31.5 27.2 L30.5 28.4 L29 25.5Z',
    cardGold,
    0.55,
  );
  art += cardPath(
    'M28.9 22.8 Q30.2 21.6 32 23 Q34.1 21.9 35.5 22.9 L34.2 24 L32 23.4 L30.4 24Z',
    cardInk,
    0.3,
  );
  art += cardPath(
    'M29 18.9 L31.3 18.7 M30.3 20 L30.7 20 M31.5 25 L32 26.8 M33.4 24.9 L33.5 27',
    'none',
    0.45,
  );
  art += cardCircle(36.1, 20.7, 0.85, '#efc09a', 0.35);
  // The five-point crown and a crisp contrasting band.
  art += cardPath(
    'M27.7 16.5 L25.9 9.8 L29.6 12 L31.2 8.7 L33.4 11.4 L36 9.1 L37 12.4 L40.2 10.8 L38.2 17Z',
    cardGold,
    0.65,
  );
  art += cardPath('M27.3 14.1 L38.9 14.5 L38.2 17 L28 16.6Z', cardRed, 0.5);
  for (const [x, y] of [
    [27.8, 14.8],
    [31.2, 15],
    [34.7, 15.1],
    [38, 15.2],
  ])
    art += cardCircle(x, y, 0.45, cardCream, 0.2);
  art += cardPath('M32.1 11.7 L33.1 12.6 L32.3 13.4 L31.3 12.5Z', cardMint, 0.3);
  // The gripping hand overlaps the hilt and sleeve, with three readable fingers.
  art += cardPath(
    'M23.9 35.3 L21 35.5 L19.5 34.8 L18 35.2 L17.8 38.7 L19.2 40.3 L22.4 39.9 L25.6 38.3Z',
    '#f3d0ae',
    0.6,
  );
  art += cardPath('M18.4 36.8 L20.4 37 M18.4 38.2 L20.4 38.4 M21.1 35.8 L21.5 37.4', 'none', 0.35);
  art += cardPath('M24.3 34.3 L27.8 36.1 L25.5 40.1 L22.3 38.8Z', cardCream, 0.55);
  art += cardPath('M27.8 36.1 L31.2 40 L27.8 45 L23.8 45 L23.8 40Z', cardBlue, 0.5);
  // Hand-inked heraldic details; broad enough to survive the camera projection.
  for (const [x, y] of [
    [29.8, 35.5],
    [27.9, 39.8],
    [26.3, 43.4],
  ])
    art += cardPath(`M${x} ${y - 1} l.9 1 -.9 1 -.9-1Z`, cardGold, 0.3);
  for (const [x, y] of [
    [37.8, 37.7],
    [35.8, 42.7],
  ])
    art += cardPath(`M${x - 1.2} ${y} l1.2-1.4 1.2 1.4 -1.2 1.4Z`, cardRed, 0.35);
  art += cardPath('M43.8 37.3 L47.5 39.2 M42.7 40 L46.9 42 M41.5 42.6 L45 44.3', 'none', 0.5);
  art += cardSuit(suit, 46.9, 25.6, 4.9, col);
  return art;
}
