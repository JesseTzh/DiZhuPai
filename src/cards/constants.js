import { rrUV } from '../engine/math.js';
import { cardDeck } from '../assets/cards/deck.js';
export { cardInk, cardCream, cardStock } from '../assets/cards/palette.js';
export { cardDeck };
const cardW = 63,
  cardH = 88,
  cardThickness = 0.55;
const cardOutline = rrUV(-cardW / 2, -cardH / 2, cardW / 2, cardH / 2, 3.4, 10);
const cardRad = (d) => (d * Math.PI) / 180;

export { cardW, cardH, cardThickness, cardOutline, cardRad };
export const cardCount = cardDeck.length;
export const cardIds = Array.from({ length: cardCount }, (_, id) => id);
export const cardGroup = (kind) =>
  cardIds.filter((id) => cardDeck[id].kind === ['pip', 'court', 'joker'][kind]);
export const cardInkScale = 218 / 585;
