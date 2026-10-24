import { cardCream, cardInk, cardMint } from './palette.js';

// Independent two-way print: frog pips replace both the rank and the suit.
// Rounded ink silhouette, three flat green tones and warm paper match the deck.
export function frogPip(x, y, scale = 1, upside = false) {
  return `<g data-pip="frog" transform="translate(${x} ${y}) rotate(${upside ? 180 : 0}) scale(${scale})" stroke="${cardInk}" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-10 4 Q-15 3-15 8 Q-14 11-8 10 M10 4 Q15 3 15 8 Q14 11 8 10" fill="${cardMint}"/>
    <path d="M-11-3 C-14-11-5-14-3-7 Q0-8 3-7 C5-14 14-11 11-3 Q16 0 13 6 Q10 11 0 11 Q-10 11-13 6 Q-16 0-11-3Z" fill="#a9c994"/>
    <path d="M-12 5 Q0 13 12 5 Q9 11 0 11 Q-9 11-12 5" fill="${cardMint}" stroke="none"/>
    <path d="M-9-7 Q-7-10-5-7 M5-7 Q7-10 9-7" fill="none" stroke="${cardCream}" stroke-width="2"/>
    <path d="M-7-5 v2 M7-5 v2 M-8 3 Q0 10 8 3" fill="none"/>
    <circle cx="-9" cy="1" r="1.6" fill="#e3ae86" stroke="none"/><circle cx="9" cy="1" r="1.6" fill="#e3ae86" stroke="none"/>
  </g>`;
}

export function cardWildPrint() {
  return `<g data-card-model="frog-wild">
    <rect x="12.1" y="8.7" width="38.8" height="70.6" rx="1.8" fill="none" stroke="#d9cbb0" stroke-width=".35"/>
    ${frogPip(6.5, 8, 0.3)}${frogPip(56.5, 80, 0.3, true)}
    <path d="M31.5 20 Q48 30 48 44 Q48 60 31.5 68 Q15 60 15 44 Q15 30 31.5 20Z" fill="#edf0d9"/>
    ${frogPip(31.5, 43, 1.05)}
    <path d="M27.5 22 Q31.5 18 35.5 22 M27.5 66 Q31.5 70 35.5 66" fill="none" stroke="${cardMint}" stroke-width=".8" stroke-linecap="round"/>
  </g>`;
}
