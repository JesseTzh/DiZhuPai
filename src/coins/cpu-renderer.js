import { ModelCanvas } from '../game/model-canvas.js';
import { rasterArt } from '../assets/raster.js';
import { cardCoinPrint } from '../assets/cards/back.js';

export async function createRenderer(art, svg) {
  const image = await rasterArt(cardCoinPrint(), '-12.5 -12.5 25 25', 128, 128);
  const canvas = new ModelCanvas(svg);
  let current;
  svg.classList.add('cpu-active');
  const draw = (state, material) => {
    current = [state, material];
    canvas.begin();
    const model = canvas.sackGeometry(state, 0),
      m = model.m;
    canvas.addShadow([...m.body[2], ...m.body[8], ...m.shell.at(-1)]);
    for (const coin of state.coins)
      if (coin.mode !== 'rain') {
        const g = canvas.coinGeometry(coin);
        canvas.addShadow([...g.A, ...g.B]);
      }
    canvas.flushShadows();
    canvas.sack(model, state, material, [48, 48, 0], 1, image);
    canvas.finish(+document.getElementById('wb').value);
  };
  const refresh = () => {
    if (current) draw(...current);
  };
  svg.addEventListener('cpu-resize', refresh);
  document.getElementById('wb').addEventListener('input', refresh);
  return {
    draw,
    dispose() {
      svg.removeEventListener('cpu-resize', refresh);
      document.getElementById('wb').removeEventListener('input', refresh);
      svg.classList.remove('cpu-active');
      canvas.dispose();
    },
  };
}
