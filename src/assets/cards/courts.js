import { cardInk, cardCream, cardRed, cardGold, cardMint, cardBlue } from './palette.js';
import { cardPath as path, cardCircle as circle } from './primitives.js';
import { cardIndex, cardSuit } from './suits.js';
import { cardKingHalf } from './king.js';

// Court portraits use the same paper, ink, flat robe panels and mirrored construction as the king.
function robe(accent, secondary) {
  let art = path('M28 28 L38 28 L50 35 L50 45 L23 45 L23 35Z', accent, 0.65);
  art += path('M29 29 L35 34 L31 45 L24 45Z', cardGold, 0.55);
  art += path('M38 29 L44 32 L39 45 L32 45Z', secondary, 0.55);
  art += path('M44 32 L50 35 L50 45 L42 45Z', cardCream, 0.5);
  art += path('M27.5 29 L30 26.8 L37.5 27 L41 30.5 L37.5 33 L33 30.5 L30 33Z', cardCream, 0.55);
  for (const [x, y] of [
    [29, 36],
    [27, 41],
    [37, 37],
    [35, 42],
  ]) {
    art += path(`M${x} ${y - 1.4} l1.1 1.4 -1.1 1.4 -1.1-1.4Z`, cardGold, 0.3);
  }
  art += path('M44 36 L48 38 M43 39 L47 41 M42 42 L46 44', 'none', 0.45);
  return art;
}

function queenHalf({ suit, color, accent }) {
  let art = robe(accent, cardMint);
  // Long swept hair, a small crown, pearl necklace and a flower held by its stem.
  art += path('M28 14 Q33 10 38 15 L40 30 L36 32 L33 26 L28 30 L26 26Z', cardGold, 0.6);
  art += path('M31 23 L30 28 L34 30 L37 27 L35.5 23Z', '#e9b995', 0.5);
  art += path(
    'M29 16 L35 16 L36.5 19 L36 24 L33 27 L29.4 24.5 L28.8 22.8 L26.8 22 L28.5 20Z',
    '#f3d0ae',
    0.6,
  );
  art += path('M34.5 17 L36 19 L35.5 24 L33 26 L32 24 L33.5 21Z', '#dfae86', 0);
  art += path('M28.8 18.9 L31.1 18.7 M30 20 L30.5 20 M29.7 23.5 Q31 24.2 32 23.5', 'none', 0.4);
  art += path('M27.8 16 L26.5 10.2 L30 12.2 L32 8.8 L34.5 12 L38 10 L37.6 16.5Z', cardGold, 0.6);
  art += path('M27.5 14 L38 14.5 L37.6 16.5 L28 16Z', cardRed, 0.45);
  art += circle(33, 12.8, 0.8, cardMint, 0.3);
  art += circle(36.2, 21.5, 0.8, cardGold, 0.3);
  for (const [x, y] of [
    [30, 28],
    [31.5, 29],
    [33.2, 29.6],
    [35, 29],
    [36.4, 28],
  ])
    art += circle(x, y, 0.55, cardCream, 0.25);
  art += path(
    'M20 39 L20 24 M20 33 Q15 28 17 27 Q21 27 20 33 M20 30 Q24 25 25 27 Q25 30 20 32',
    cardMint,
    0.5,
  );
  for (let i = 0; i < 5; i++)
    art += `<g transform="translate(20 21) rotate(${i * 72})">${path('M0 0 C-6-1-4-7 0-4 C4-7 6-1 0 0Z', cardRed, 0.45)}</g>`;
  art += circle(20, 21, 1.3, cardGold, 0.4);
  art += path('M24 35 L21 35 L19 34 L17.8 35 L18 38.8 L21 40 L25.5 38Z', '#f3d0ae', 0.55);
  art += path('M18.5 36 L21 36.5 M18.5 37.5 L21 38', 'none', 0.35);
  art += path('M24 34 L28 36 L25 40 L22 38.8Z', cardCream, 0.5);
  art += cardSuit(suit, 46.9, 25.6, 4.9, color);
  return art;
}

function jackHalf({ suit, color, accent }) {
  let art = robe(accent, cardBlue);
  // A feathered cap, clean-shaven profile and a halberd distinguish the jack at small sizes.
  art += path('M19 20 L21 20 L21 42 L19 42Z', cardGold, 0.5);
  art += path('M20 11 L22 17 L21 21 L25 19 L25 26 L21 24 L17 27 L17 20 L19 19Z', '#cbd9d4', 0.55);
  art += path('M20 14 L20 24', 'none', 0.3);
  art += path('M31 23 L30 28 L34 30 L37 27 L35.5 23Z', '#e9b995', 0.5);
  art += path('M28 15 Q34 12 38 16 L38.5 26 L35.5 28 L33 24 L29 25Z', cardGold, 0.6);
  art += path(
    'M29 16 L35.5 16 L36.5 19.5 L35.8 24 L33 26.5 L29.5 24.5 L29 22.6 L27 21.9 L28.7 20Z',
    '#f3d0ae',
    0.6,
  );
  art += path('M34.5 17 L36.1 19.5 L35.4 23.8 L33 26 L32 24.2 L33.5 21Z', '#dfae86', 0);
  art += path('M28.9 18.8 L31.2 18.6 M30.1 20 L30.6 20 M30 23.5 L32 23.5', 'none', 0.4);
  art += path('M34 13 C31 7 38 7 41 9 C38 10 38 14 35 16Z', cardCream, 0.5);
  art += path('M34.5 14 L38.5 9.5', 'none', 0.35);
  art += path('M27 14 Q29 9 34 11 L38.5 14.5 L38 17 L27 16.5Z', accent, 0.6);
  art += path('M26 15 L39 15.5 L38.5 17.5 L26.5 17Z', cardRed, 0.45);
  art += circle(29, 15.8, 0.65, cardGold, 0.25);
  art += path('M24 35 L21.5 35.5 L19.5 34.6 L18 35.2 L18 38.8 L20 40 L25 38.5Z', '#f3d0ae', 0.55);
  art += path('M18.5 36.5 L21 37 M18.5 38 L21 38.5', 'none', 0.35);
  art += path('M24.3 34.3 L28 36 L25.5 40 L22.3 38.8Z', cardCream, 0.5);
  art += cardSuit(suit, 46.9, 25.6, 4.9, color);
  return art;
}

export function cardCourt(card) {
  const { key, rank, suit, color, accent } = card;
  const half =
    rank === 'K'
      ? cardKingHalf(suit, color, accent)
      : rank === 'Q'
        ? queenHalf(card)
        : jackHalf(card);
  return (
    cardIndex(rank, suit, color) +
    `<rect x="12.6" y="8.1" width="37.8" height="71.8" rx=".7" fill="${cardCream}" stroke="${cardInk}" stroke-width=".65"/>` +
    `<clipPath id="${key}-print"><rect x="13" y="8.5" width="37" height="71"/></clipPath>` +
    `<clipPath id="${key}-half"><rect x="13" y="8.5" width="37" height="35.5"/></clipPath>` +
    `<g data-court="${rank}" clip-path="url(#${key}-print)"><g clip-path="url(#${key}-half)">${half}</g><g transform="translate(63 88) rotate(180)"><g clip-path="url(#${key}-half)">${half}</g></g></g>` +
    path('M13 44 L50 44', 'none', 0.65) +
    `<rect x="14.1" y="9.6" width="34.8" height="68.8" rx=".25" fill="none" stroke="${cardInk}" stroke-width=".3"/>`
  );
}
