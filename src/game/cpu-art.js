import { rasterArt } from '../assets/raster.js';
import { cardFrontPrints, cardBackPrint } from '../assets/cards/index.js';
import { cardCoinPrint } from '../assets/cards/back.js';
import { cardCream } from '../cards/constants.js';
import { cardWildPrint } from '../assets/cards/wild.js';
import { PALS } from '../engine/palette.js';
let ready;
export function cpuArt() {
  return (ready ??= (async () => {
    const fronts = await Promise.all(
      cardFrontPrints.map((print) =>
        rasterArt(`<rect width="63" height="88" fill="${cardCream}"/>${print}`, '0 0 63 88'),
      ),
    );
    const backs = Object.fromEntries(
      await Promise.all(
        Object.entries(PALS).map(async ([key, palette]) => [
          key,
          await rasterArt(
            `<rect width="63" height="88" fill="${cardCream}"/>${cardBackPrint(palette, 'cpu-' + key)}`,
            '0 0 63 88',
          ),
        ]),
      ),
    );
    const coin = await rasterArt(cardCoinPrint(), '-12.5 -12.5 25 25', 128, 128);
    const wild = await rasterArt(
      `<rect width="63" height="88" fill="${cardCream}"/>${cardWildPrint()}`,
      '0 0 63 88',
    );
    return { fronts, backs, coin, wild };
  })());
}
