import { mountFigure } from './engine/figure.js';
import { cardDeck } from './cards/constants.js';
import { createGame, deal } from './game/state.js';
import { createGameRenderer, makeVisual, handPose } from './game/scene.js';
import { coinState, coinStep } from './coins/scene.js';
import { mountShell } from './ui/controls.js';
import { mountZoom } from './ui/zoom.js';
import { mountPerformance } from './ui/performance.js';
import { tableChoices, bindTableChoices } from './ui/table-picker.js';
import { createSounds, SOUND } from './game/sound.js';
import {
  renderDprSetting,
  setRenderDprSetting,
  renderScaleOptions,
  renderPixelRatio,
} from './engine/render-pixel-ratio.js';
import { TRANSFER_DURATION } from './game/transfer.js';

const game = createGame(),
  visual = makeVisual();
deal(game);
const state = { game, visual, tableStyle: 'planks', cardNames: cardDeck.map((card) => card.name) };
const types = [
  ['deal', '发牌与翻面'],
  ['play', '出牌与翻面'],
  ['transfer', '金币转账与飘字'],
  ['bags', '钱袋鼓瘪与受击'],
  ['physics', '金币雨、弹跳与滚动'],
  ['selection', '选牌起落'],
];
const enabled = Object.fromEntries(types.map(([id]) => [id, true]));
const clocks = Object.fromEntries(types.map(([id]) => [id, 0]));
const physics = [coinState(), coinState()];
const audio = createSounds();
let paused = false,
  soundOn = false,
  density = 1;
const ui = mountFigure({
  fig: '02',
  title: '动画性能测试 · Colorfigures',
  credit: false,
  size: [650, 650, 180],
  center: [0, 0],
  palette: 'cobalt',
  inkScale: 0.7,
  state,
  renderer: createGameRenderer,
});
mountShell(ui, {
  palette: '玩家配色',
  swatches: ['芥末黄', null, '薄荷绿', '钴蓝', '玫瑰粉'],
});
mountZoom();
document.body.className = 'game-page stress-page';
const panel = document.createElement('aside');
panel.className = 'stress-panel';
panel.innerHTML = `<a class="back-home" href="./index.html">← 返回首页</a><span class="eyebrow">COLORFIGURES / MOTION LAB</span><h1>动画试验台<span>.</span></h1><div id="metrics-slot"></div><div class="stress-actions"><button id="pause-all" aria-pressed="false">全部暂停</button><button id="reset-metrics">清空曲线</button></div><div class="animation-switches" role="group" aria-label="动画类型">${types.map(([id, label]) => `<label><input type="checkbox" data-animation="${id}" checked><span>${label}</span><small>运行</small></label>`).join('')}</div><label class="stress-density" for="density">金币负载 <select id="density"><option value="1">1× · 5 枚转账</option><option value="2">2× · 10 枚转账</option><option value="4">4× · 20 枚转账</option></select></label><div class="stress-material"><span class="eyebrow">牌桌材质</span>${tableChoices()}</div><details class="table-settings"><summary>画面与音效</summary><div class="render-settings"><label for="dpr-select">渲染倍率<select id="dpr-select">${renderScaleOptions()}</select></label></div><div class="backend-links"><button id="stress-sound" aria-pressed="false">音效 关</button></div></details><span id="backend-label"></span>`;
document.body.append(panel);
panel.querySelector('#dpr-select').value = renderDprSetting();
panel.querySelector('.table-settings').append(document.querySelector('.controls'));
bindTableChoices(panel, state, () => ui.render());
mountPerformance(ui, '实时帧率', { width: 280, height: 84 });
panel.querySelector('#metrics-slot').append(document.getElementById('card-performance'));
const metrics = window.cardPerformance;
const backendLabel = panel.querySelector('#backend-label');
panel.querySelector('#dpr-select').onchange = (event) => {
  setRenderDprSetting(event.target.value);
  forceRender();
};
const measuredRender = ui.render;
ui.render = () => {
  measuredRender();
  const backendText = `Canvas · 渲染倍率 ${renderPixelRatio()}× · ${innerWidth} × ${innerHeight}`;
  if (backendLabel.textContent !== backendText) backendLabel.textContent = backendText;
};
const active = (id) => !paused && enabled[id];
function syncSound() {
  if (soundOn && active('deal')) audio.startDeal();
  else audio.stopDeal();
}
for (const input of panel.querySelectorAll('[data-animation]'))
  input.onchange = () => {
    enabled[input.dataset.animation] = input.checked;
    input.nextElementSibling.nextElementSibling.textContent = input.checked ? '运行' : '暂停';
    syncSound();
  };
panel.querySelector('#pause-all').onclick = (event) => {
  paused = !paused;
  event.currentTarget.textContent = paused ? '继续播放' : '全部暂停';
  event.currentTarget.setAttribute('aria-pressed', paused);
  syncSound();
};
panel.querySelector('#stress-sound').onclick = (event) => {
  soundOn = !soundOn;
  event.currentTarget.textContent = `音效 ${soundOn ? '开' : '关'}`;
  event.currentTarget.setAttribute('aria-pressed', soundOn);
  syncSound();
};
panel.querySelector('#density').onchange = (event) => {
  density = +event.target.value;
};
panel.querySelector('#reset-metrics').onclick = () => metrics.reset();

let lastPlay = -1,
  lastTransfer = -1,
  lastImpact = -1;
const physicsCycle = [-1, -1],
  physicsImpact = [-1, -1];
visual.bags.forEach((bag) => {
  bag.count = 20;
  bag.fillShow = 0.5;
});
ui.animate((dt) => {
  if (document.hidden) return true;
  for (const [id] of types) if (active(id)) clocks[id] += dt;
  if (active('deal')) visual.dealTime = clocks.deal % 2.65;
  if (active('play')) {
    const cycle = Math.floor(clocks.play / 1.6),
      player = cycle % 2;
    if (cycle !== lastPlay) {
      lastPlay = cycle;
      const cards = game.hands[player].slice(0, 3);
      game.target = { player, cards, move: { name: '出牌测试' } };
      visual.playFrom = cards.map((id, i) => handPose(player, i, 18));
      if (soundOn) audio.play(SOUND.knock);
    }
    visual.playTime = clocks.play % 1.6;
  }
  if (active('transfer')) {
    const cycle = Math.floor(clocks.transfer / (TRANSFER_DURATION + 0.15));
    if (cycle !== lastTransfer) {
      lastTransfer = cycle;
      visual.transfer = { from: cycle % 2, amount: 5 * density, elapsed: 0 };
    }
    visual.transfer.elapsed = clocks.transfer % (TRANSFER_DURATION + 0.15);
  }
  if (active('bags')) {
    const cycle = Math.floor(clocks.bags / 3);
    if (cycle !== lastImpact) {
      lastImpact = cycle;
      visual.bags[cycle % 2].punchT = 0;
    }
    for (let p = 0; p < 2; p++) {
      const bag = visual.bags[p];
      // Smoothly traverse real empty/full sack shapes; use the same easing and impact step as the game.
      bag.coins = [];
      bag.count = 20 + 17 * Math.sin(clocks.bags * 1.5 + p * Math.PI);
      coinStep(bag, dt);
      game.coins[p] = Math.round(bag.count * 5);
    }
  }
  if (active('physics')) {
    for (let p = 0; p < 2; p++) {
      const time = clocks.physics + p * 0.65,
        cycle = Math.floor(time / 8),
        local = time % 8;
      const bag = physics[p];
      if (cycle !== physicsCycle[p]) {
        physicsCycle[p] = cycle;
        Object.assign(bag, coinState(), { count: 12, rainLeft: 20 * density });
      }
      if (local > 3.6 && physicsImpact[p] !== cycle) {
        physicsImpact[p] = cycle;
        Object.assign(bag, {
          punchT: 0,
          punchOut: 0,
          punchLeft: Math.min(bag.count, 14 * density),
        });
      }
      bag.fillShow = visual.bags[p].fillShow;
      coinStep(bag, dt);
    }
  }
  for (let p = 0; p < 2; p++) visual.bags[p].coins = physics[p].coins;
  if (active('selection'))
    game.selected = Math.floor(clocks.selection * 2) % 2 ? game.hands[0].slice(3, 6) : [];
  // FPS sampling continues while paused; a fully paused scene submits no redraws.
  return true;
});
// Avoid rendering an identical scene while paused or when every animation type is disabled.
const render = ui.render;
let firstFrame = true;
ui.render = () => {
  if (firstFrame || (!paused && Object.values(enabled).some(Boolean))) render();
  firstFrame = false;
};
const forceRender = () => {
  firstFrame = true;
  ui.render();
};
bindTableChoices(panel, state, forceRender);
addEventListener('resize', forceRender);
document.getElementById('wb').addEventListener('input', forceRender);
document.getElementById('pals').addEventListener('click', forceRender);
window.performanceApp = {
  state,
  clocks,
  enabled,
  physics,
  metrics,
  audio,
  ready: () => ui.ready(),
  render: forceRender,
  get paused() {
    return paused;
  },
};
