import { cardDeck } from './deck.js';
import { cardPips } from './pips.js';
import { cardCourt } from './courts.js';
import { cardJoker } from './jokers.js';
import { cardCream, cardInk } from './palette.js';

export { cardDeck } from './deck.js';
export { cardBackPrint } from './back.js';

export const cardFrontPrints = cardDeck.map((card) =>
  card.kind === 'joker'
    ? cardJoker(card)
    : card.kind === 'court'
      ? cardCourt(card)
      : cardPips(card),
);

// Portable 63 × 88 SVG wrapper; exports use the scene's print line-weight scale.
export function cardSvg(print, title, namespace, inkScale = 218 / 585) {
  const scoped = print
    .replace(/\bid="([^"]+)"/g, `id="${namespace}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${namespace}-$1)`);
  const ink = scoped.replace(
    /stroke-width="([\d.]+)"/g,
    (_, w) => `stroke-width="${(+w * inkScale).toFixed(2)}"`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88" role="img" aria-labelledby="${namespace}-title"><title id="${namespace}-title">${title}</title><rect x=".35" y=".35" width="62.3" height="87.3" rx="3.4" fill="${cardCream}" stroke="${cardInk}" stroke-width=".7"/>${ink}</svg>`;
}
