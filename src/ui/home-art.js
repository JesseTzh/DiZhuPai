import { TITLE_STROKES } from './home-title.js';
export { TITLE_STROKES } from './home-title.js';
import { homeModelArt } from './home-models.js';
import { itemIconMarkup } from './item-presentation.js';

/* Hand-built letter strokes form both the visible relief and the collision body.
 * Coins: gravity -> swept substeps -> capsule contacts -> tangent rolling.
 * Cards: line up a falling coin -> wind up and swing -> strike it into the sack.
 * Three coins and three paper cards keep this deliberately quiet. */
const INK = '#231e16';

const path = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
const stroke = (d, color, width) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
const allPaths = TITLE_STROKES.map(path).join(' ');
const relief = Array.from({ length: 9 }, (_, i) => {
  const offset = 9 - i;
  return `<g transform="translate(${offset},${offset * 1.15})">${stroke(allPaths, INK, 21)}${stroke(allPaths, '#b97e31', 15)}</g>`;
}).join('');
// Layout anchor only: the persistent game canvas paints the actual table beneath it.
function tableBackdrop() {
  return '<div class="home-table home-table-wide" aria-hidden="true"></div>';
}
export function settingsIcon() {
  const points = [];
  for (let i = 0; i < 32; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 16;
    const radius = i % 4 < 2 ? 12.8 : 9.8;
    points.push(
      `${(15 + Math.cos(angle) * radius).toFixed(2)},${(15 + Math.sin(angle) * radius).toFixed(2)}`,
    );
  }
  return `<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M${points.join(' L')}Z" transform="translate(1.2 1.7)" fill="#6487bd" opacity=".75"/><path d="M${points.join(' L')}Z" fill="#93d3b0" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/><circle cx="15" cy="15" r="6.3" fill="#fff4d6" stroke="${INK}" stroke-width="1.7"/><circle cx="15" cy="15" r="2.5" fill="#93d3b0" stroke="${INK}" stroke-width="1.4"/></svg>`;
}
export function homeMarkup() {
  return `${tableBackdrop()}<a class="home-rocket" href="./performance.html" aria-label="进入性能测试页" title="性能测试"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 29L10 30 12 19 23 16M24 31L23 40 33 35 34 24" fill="#76a0e2" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M17 29C17 17 28 7 39 7 41 19 33 30 24 33Z" fill="#fff4d6" stroke="${INK}" stroke-width="2.2"/><circle cx="30" cy="17" r="4.5" fill="#93d3b0" stroke="${INK}" stroke-width="2"/><path d="M17 32L10 39 17 37 15 43 23 35" fill="#f4b829" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></svg></a>
    <div class="home-composition"><h1 class="home-title"><span class="sr-only">地主牌</span><svg id="home-art" viewBox="0 0 800 465" aria-hidden="true"><g transform="translate(-9,25)" opacity=".19">${stroke(allPaths, '#41538f', 24)}</g>${relief}${stroke(allPaths, INK, 21)}${stroke(allPaths, '#f4b829', 15)}<g transform="translate(-1,-3)">${stroke(allPaths, '#ffe194', 3)}</g><g id="home-bag"></g><g id="home-cards"></g><g id="home-coins"></g></svg></h1>
    <div class="home-buttons"><label class="home-seed"><span class="sr-only">随机种子</span><input id="seed-input" type="text" maxlength="32" placeholder="随机种子 · 留空随机" autocomplete="off" spellcheck="false" enterkeyhint="go"></label><button id="enter-game" class="figure-button figure-primary"><svg viewBox="0 0 30 30" aria-hidden="true"><path d="M9 5L24 15 9 25Z" fill="#fff4d6" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></svg><span class="home-start-label">开始游戏</span></button><button id="home-catalogue" class="figure-button">${itemIconMarkup('frog')}道具图鉴</button><button id="home-import" class="figure-button">导入存档</button><button id="home-settings" class="figure-button">${settingsIcon()}设置</button></div></div>`;
}
const ns = 'http://www.w3.org/2000/svg';
const group = (root, markup) => {
  const node = document.createElementNS(ns, 'g');
  node.innerHTML = markup;
  root.append(node);
  return node;
};
const segments = TITLE_STROKES.flatMap((points) => points.slice(1).map((b, i) => [points[i], b]));
export function mountHomeAnimation(home) {
  const coins = Array.from({ length: 3 }, (_, i) => ({
    x: 0,
    y: -40,
    vx: 0,
    vy: 0,
    spin: 0,
    id: i,
    mode: 'waiting',
    contacts: 0,
    node: group(
      home.querySelector('#home-coins'),
      `<ellipse cy="3" rx="9" ry="10" fill="#b97e31" stroke="${INK}" stroke-width="2"/><circle r="9" fill="#f4b829" stroke="${INK}" stroke-width="2"/><circle r="5.5" fill="none" stroke="#fff0b4" stroke-width="1.5"/><path d="M-2-3H2V3H-2Z" fill="#b97e31"/>`,
    ),
  }));
  const cards = Array.from({ length: 3 }, (_, i) => ({
    x: 175 + i * 210,
    y: 386 + i * 12,
    angle: 0,
    target: null,
    swing: null,
    node: group(
      home.querySelector('#home-cards'),
      '<image x="-64" y="-64" width="128" height="128"/>',
    ),
  }));
  const bag = group(
    home.querySelector('#home-bag'),
    '<image x="-64" y="-64" width="128" height="128"/>',
  );
  const bagX = 735,
    bagY = 385;
  let bagBounce = 0;
  let mouth = { x: bagX, y: bagY - 29 };
  let artReady = false;
  const ready = homeModelArt().then((art) => {
    cards.forEach((card, i) => card.node.firstElementChild.setAttribute('href', art.cards[i]));
    bag.firstElementChild.setAttribute('href', art.bag);
    mouth = { x: bagX + art.mouth.x, y: bagY + art.mouth.y };
    artReady = true;
    step(0);
    sync();
  });
  let running = false,
    frame = 0,
    last = 0,
    time = 0,
    waveWait = 0;
  const metrics = {
    contacts: 0,
    strikes: 0,
    strikesByCard: [0, 0, 0],
    deposits: 0,
    waves: 0,
    frames: 0,
  };
  const reset = (coin, index) => {
    // Each wave drops one coin per character; each card owns the matching coin.
    const bounds = home.querySelector('#home-art').getBoundingClientRect();
    const startY = -Math.max(24, bounds.width ? (bounds.top * 800) / bounds.width + 20 : 24);
    const velocity = [-14, 35, 47][index];
    const extraFall = Math.sqrt((2 * (180 - startY)) / 310) - Math.sqrt(408 / 310);
    Object.assign(coin, {
      x: [170, 422, 612][index] - velocity * extraFall,
      y: startY,
      vx: velocity,
      vy: 0,
      mode: 'falling',
      contacts: 0,
    });
  };
  function step(dt) {
    time += dt;
    if (artReady && !home.hidden && coins.every((coin) => coin.mode === 'waiting')) {
      waveWait -= dt;
      if (waveWait <= 0 && cards.every((card) => card.swing == null)) {
        coins.forEach(reset);
        metrics.waves++;
        waveWait = 1.5;
      }
    }
    cards.forEach((card, i) => {
      if (card.swing != null) {
        card.swing += dt;
        const t = Math.min(1, card.swing / 0.24);
        card.angle = 0.45 - 1.5 * (1 - (1 - t) ** 3);
        if (card.swing > 0.24) {
          const recover = Math.min(1, (card.swing - 0.24) / 0.6);
          card.angle = -1.05 * (1 - recover);
          if (recover === 1) {
            card.swing = null;
            card.target = null;
          }
        }
        return;
      }
      if (card.target?.mode !== 'falling') card.target = null;
      const ownCoin = coins[i];
      if (!card.target && ownCoin.mode === 'falling' && ownCoin.y > 255 && ownCoin.vy > 0)
        card.target = ownCoin;
      const target = card.target;
      const hitY = 353;
      const fallTime = target
        ? Math.max(
            0,
            (Math.sqrt(target.vy ** 2 + 620 * Math.max(0, hitY - target.y)) - target.vy) / 310,
          )
        : 0;
      const goal = target
        ? target.x + target.vx * fallTime - 16
        : 175 + i * 210 + Math.sin(time * 0.55 + i * 2) * 55;
      card.x += Math.max(-650 * dt, Math.min(650 * dt, goal - card.x));
      card.y +=
        ((target ? 389 : 385 + Math.sin(time * 1.3 + i * 2) * 12 + i * 8) - card.y) *
        Math.min(1, dt * 12);
      card.angle +=
        ((target ? 0.45 : Math.sin(time * 1.1 + i * 2) * 0.12) - card.angle) * Math.min(1, dt * 14);
      // Start the flick just before contact, so the card is already moving on impact.
      if (target && fallTime < 0.045 && Math.abs(goal - card.x) < 20) card.swing = 0;
    });
    coins.forEach((coin) => {
      if (coin.mode === 'flying') {
        coin.flight = Math.min(coin.duration, coin.flight + dt);
        const t = coin.flight;
        coin.x = coin.fromX + coin.vx * t;
        coin.y = coin.fromY + coin.vy * t + 310 * t * t;
        coin.spin += dt * 13;
        if (t >= coin.duration) {
          metrics.deposits++;
          bagBounce = 1;
          coin.mode = 'waiting';
        }
      }
      if (coin.mode === 'falling') {
        const oldY = coin.y;
        coin.vy += 310 * dt;
        coin.x += coin.vx * dt;
        coin.y += coin.vy * dt;
        for (const [[ax, ay], [bx, by]] of segments) {
          const dx = bx - ax,
            dy = by - ay;
          const t = Math.max(
            0,
            Math.min(1, ((coin.x - ax) * dx + (coin.y - ay) * dy) / (dx * dx + dy * dy)),
          );
          const px = ax + dx * t,
            py = ay + dy * t;
          const distance = Math.hypot(coin.x - px, coin.y - py);
          if (distance >= 19.5 || distance === 0) continue;
          const nx = (coin.x - px) / distance,
            ny = (coin.y - py) / distance;
          coin.x += nx * (19.5 - distance);
          coin.y += ny * (19.5 - distance);
          const approach = coin.vx * nx + coin.vy * ny;
          if (approach < 0) {
            coin.vx -= 1.17 * approach * nx;
            coin.vy -= 1.17 * approach * ny;
            coin.contacts++;
            metrics.contacts++;
          }
          // Tiny initial momentum prevents a coin balancing forever on a perfectly level cap.
          if (ny < -0.35 && Math.abs(coin.vx) < 24) coin.vx += 55 * dt;
        }
        coin.spin += (coin.vx * dt) / 9;
        if (coin.y > 328 && coin.vy > 0) {
          const card = cards.find(
            (item) =>
              item.target === coin &&
              item.swing != null &&
              item.swing < 0.24 &&
              Math.abs(coin.x - item.x - 16) < 32 &&
              oldY <= 353 &&
              coin.y >= 353,
          );
          if (card) {
            const duration = 0.9 + (mouth.x - coin.x) / 950;
            Object.assign(coin, {
              mode: 'flying',
              flight: 0,
              duration,
              fromX: coin.x,
              fromY: coin.y,
              vx: (mouth.x - coin.x) / duration,
              vy: (mouth.y - coin.y - 310 * duration ** 2) / duration,
            });
            card.target = null;
            metrics.strikes++;
            metrics.strikesByCard[coin.id]++;
          }
        }
        if (coin.y > 510 || coin.x > 850 || coin.x < -50) coin.mode = 'waiting';
      }
    });
    cards.forEach((card) => {
      card.node.setAttribute(
        'transform',
        `translate(${card.x.toFixed(2)},${card.y.toFixed(2)}) rotate(${((card.angle * 180) / Math.PI).toFixed(2)})`,
      );
    });
    bagBounce = Math.max(0, bagBounce - dt * 2.8);
    const squash = Math.sin(bagBounce * Math.PI * 2) * bagBounce * 0.09;
    bag.setAttribute('transform', `translate(${bagX},${bagY}) scale(${1 + squash},${1 - squash})`);
    bag.dataset.deposits = metrics.deposits;
    coins.forEach((coin) => {
      const progress = coin.mode === 'flying' ? coin.flight / coin.duration : 0;
      const scale = 1 - Math.max(0, (progress - 0.94) / 0.06) * 0.85;
      coin.node.dataset.mode = coin.mode;
      const layer = home.querySelector(progress > 0.94 ? '#home-bag' : '#home-coins');
      if (coin.node.parentNode !== layer)
        layer.insertBefore(coin.node, progress > 0.94 ? bag : null);
      coin.node.style.display = coin.mode === 'waiting' ? 'none' : '';
      coin.node.setAttribute(
        'transform',
        `translate(${coin.x.toFixed(2)},${coin.y.toFixed(2)}) rotate(${((coin.spin * 180) / Math.PI).toFixed(2)}) scale(${scale})`,
      );
    });
  }
  function tick(now) {
    if (!running) return;
    const elapsed = Math.min(0.05, (now - last) / 1000 || 1 / 60);
    last = now;
    // Fixed small substeps keep fast coins from tunnelling through a letter or card.
    for (let left = elapsed; left > 0; left -= 1 / 180) step(Math.min(left, 1 / 180));
    metrics.frames++;
    frame = requestAnimationFrame(tick);
  }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const sync = () => {
    const active = artReady && !home.hidden && !document.hidden && !motion.matches;
    if (active === running) return;
    running = active;
    cancelAnimationFrame(frame);
    if (active) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };
  motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  step(0);
  return { ready, sync, metrics, snapshot: () => coins.map(({ node, ...coin }) => coin) };
}
