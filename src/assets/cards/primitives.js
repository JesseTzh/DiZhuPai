import { cardInk } from './palette.js';
export const cardPath = (d, c = 'none', w = 0.5, extra = '') =>
  `<path d="${d}" fill="${c}" stroke="${cardInk}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
export const cardCircle = (x, y, r, c, w = 0.45) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${cardInk}" stroke-width="${w}"/>`;
