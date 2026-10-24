import { cardInk, cardCream } from './palette.js';
import { cardPath, cardCircle } from './primitives.js';

const coinGold = { l: '#f8d979', m: '#eebc48', d: '#c18c37' };

/* Flat printed coin: concentric ink lines, a solid emblem and irregular wear.
   Keep every mark on the card plane, without a bevel, cast shadow or highlights. */
const goldCoin = () => {
  let art = cardCircle(0, 0, 12.5, coinGold.m, 1.6) + cardCircle(0, 0, 9.7, 'none', 0.8);

  // A few irregular flat patches suggest tarnish without a noisy surface texture.
  for (const [d, fill] of [
    ['M-11.5-3.9 l2.3-.8 1.2 1.4-.7 2.2-1.5-.3-.7 1.2-1.1-1Z', coinGold.d],
    ['M4.2-10.9 l2.7 1.1-.7 1.6-1.6-.3-1 .9-1.2-1 .8-1Z', coinGold.d],
    ['M8.8 2.5 l2.9-.8-.6 2.5-1.4.7-.4 1.5-1.7.6-.7-1.3 1.8-1.1Z', coinGold.d],
    ['M-5.7-5.8 l2.4-1.3 1.9.6-.6 1.2-1.6-.2-1.3 1Z', coinGold.l],
    ['M-5.5 7.5 l2 .5.9 1.4 1.7.1-.4 1.7-2.3-.6-1.8-1.1Z', coinGold.d],
    ['M3.7 5.5 l2.4-.7.9.9-1.1 1.4-1.5-.3-.8.6Z', coinGold.l],
  ])
    art += `<path d="${d}" fill="${fill}"/>`;

  art +=
    cardPath('M0-5.4 L1.9-1.8 5.2 0 1.8 1.9 0 5.3-1.9 1.8-5.2 0-1.8-1.9Z', coinGold.d, 0.8) +
    cardPath('M-8.7 1.8 l1.5-.6 M4.4-5.5 l1.3-.8 M-4 6.3 l1.2-.2', 'none', 0.7);
  return art;
};

// A single weathered gold coin sits at the centre of the woven field.
export function cardBackPrint(material, id) {
  let art =
    `<rect x="3.8" y="3.8" width="55.4" height="80.4" rx="2" fill="${material.l}" stroke="${cardInk}" stroke-width=".65"/>` +
    `<rect x="5.3" y="5.3" width="52.4" height="77.4" rx="1.2" fill="none" stroke="${cardCream}" stroke-width=".65"/>` +
    `<clipPath id="back-field-${id}"><rect x="7.1" y="7.1" width="48.8" height="73.8" rx=".5"/></clipPath><g clip-path="url(#back-field-${id})">`;
  for (let x = -70; x < 140; x += 7) {
    art += `<path d="M${x} 5 l76 78 M${x} 83 l76-78" fill="none" stroke="${cardCream}" stroke-width=".45"/>`;
  }
  art += `</g><rect x="7.1" y="7.1" width="48.8" height="73.8" rx=".5" fill="none" stroke="${cardInk}" stroke-width=".45"/>`;
  art += `<g transform="translate(31.5 44) scale(.8)">${goldCoin()}</g>`;
  for (const [x, y] of [
    [11, 11],
    [52, 11],
    [11, 77],
    [52, 77],
  ])
    art += cardPath(`M${x} ${y - 2.2} l1.8 2.2 -1.8 2.2 -1.8-2.2Z`, cardCream, 0.4);
  return art;
}

// The same printed coin, shared with the 3D coin animation.
export { coinGold as cardCoinGold, goldCoin as cardCoinPrint };
