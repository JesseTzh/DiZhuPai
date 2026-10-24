import { cardInk, cardCream, cardRed, cardGold, cardMint, cardBlue } from './palette.js';
import { cardPath as path, cardCircle as circle } from './primitives.js';

export function cardJoker({ variant }) {
  const red = variant === 'red',
    color = red ? cardRed : cardInk;
  const accent = red ? cardRed : cardBlue;
  const corner = `<text x="6.3" y="8.5" text-anchor="middle" fill="${color}" font-family="Georgia,serif" font-size="4.6" font-weight="700">${[...'JOKER'].map((c, i) => `<tspan x="6.3" dy="${i ? 5 : 0}">${c}</tspan>`).join('')}</text>${circle(6.3, 33, 1.5, accent, 0.4)}`;
  let art = corner + `<g transform="translate(63 88) rotate(180)">${corner}</g>`;
  art +=
    '<rect x="12.1" y="8.7" width="38.8" height="70.6" rx="1.8" fill="none" stroke="#d9cbb0" stroke-width=".35"/>';
  art += path('M31.5 14 L48 44 L31.5 74 L15 44Z', cardCream, 0.45);
  // A dancing jester: bells, three-point cap, ruff, patchwork tunic, striped stockings and curled shoes.
  art += path('M28 54 L32 55 L28 67 L23 69 L24 64Z', cardMint, 0.55);
  art += path('M34 54 L38 52 L40 63 L36 68 L33 65 L36 61Z', cardGold, 0.55);
  art += path('M24 66 L28 67 Q27 72 19 72 Q16 71 18 68 L20 70Z', accent, 0.6);
  art += path('M34 64 L37 66 Q40 70 44 65 Q47 69 43 71 L38 72 L33 67Z', accent, 0.6);
  art += path('M24.5 63 L28.5 64 M25.5 60 L29.5 61 M35 61 L39 60 M34 64 L37 63', 'none', 0.45);
  art += path('M27 35 L36 35 L40 48 L38 56 L23 56 L26 45Z', accent, 0.65);
  art += path('M31.5 36 L36 35 L40 48 L38 56 L31.5 56Z', cardGold, 0.5);
  art += path('M26 45 L22 48 L18 41 L20 39 L25 43 L27 37', cardMint, 0.55);
  art += path('M36 37 L41 40 L44 34 L47 35 L44 45 L39 44', accent, 0.55);
  art += path('M18 41 L16 38 L16 35 L18 35 L19 38 L20 36 L21 37 L20 40Z', '#f3d0ae', 0.5);
  art += path('M44 35 L43 32 L44 29 L45.5 30 L45 32 L47 31 L48 32 L47 35Z', '#f3d0ae', 0.5);
  art += path('M25 35 L27 32 L36 32 L39 35 L36 39 L33 36 L30 39 L28 36Z', cardCream, 0.55);
  art += path('M27.5 24 L35 23 L37 27 L35 32 L31 34 L27 30 L25.5 28 L27 27Z', '#f3d0ae', 0.6);
  art += path('M33.5 24 L36 27 L34.5 31 L31 33 L31 30Z', '#dfae86', 0);
  art += path('M28 27 L29 27 M33 26.5 L34 26.5 M29 30 Q32 32 34 29.5', 'none', 0.45);
  art += path(
    'M26 25 Q21 22 20 18 Q27 17 30 22 Q28 15 31.5 12 Q36 16 34 22 Q39 17 43 21 L37 26Z',
    accent,
    0.6,
  );
  art += path('M30 22 L31.5 12 Q36 16 34 22 L32 25Z', cardGold, 0.45);
  art += path('M26 24 L37 24 L36 26.5 L26.5 26.5Z', cardMint, 0.45);
  for (const [x, y] of [
    [20, 18],
    [31.5, 12],
    [43, 21],
    [24, 56],
    [38, 56],
  ])
    art += circle(x, y, 1.1, cardGold, 0.4);
  for (const y of [43, 49])
    art += path(`M31.5 ${y - 1.5} l1.3 1.5 -1.3 1.5 -1.3-1.5Z`, cardCream, 0.35);
  for (const [x, y] of red
    ? [
        [20, 29],
        [44, 53],
        [20, 59],
      ]
    : [
        [19, 30],
        [44, 53],
        [43, 16],
      ])
    art += path(`M${x} ${y - 2} l.7 1.3 1.5.7 -1.5.7 -.7 1.3 -.7-1.3 -1.5-.7 1.5-.7Z`, color, 0.3);
  return `<g data-joker="${variant}">${art}</g>`;
}
