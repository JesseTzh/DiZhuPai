import { cardCount } from '../cards/constants.js';
export function mountPerformance(
  cardUI,
  title = `${cardCount} 张牌`,
  { width = 182, height = 36 } = {},
) {
  const panel = document.createElement('aside');
  panel.id = 'card-performance';
  panel.setAttribute('aria-label', `${title}实时帧率监测`);
  panel.innerHTML = `<div class="perf-heading"><span>${title}</span><span id="perf-mode">静止</span></div><div class="perf-main"><strong id="perf-fps">—</strong><span>FPS</span><small id="perf-ms">— ms / 帧</small></div><canvas id="perf-chart" aria-label="最近 12 秒的 FPS 曲线" role="img"></canvas><div class="perf-detail"><span id="perf-render">重绘 0 / s</span><span id="perf-js">JS — ms</span></div>`;
  document.body.appendChild(panel);
  const canvas = panel.querySelector('canvas'),
    ctx = canvas.getContext('2d');
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.scale(ratio, ratio);
  const fpsEl = panel.querySelector('#perf-fps'),
    msEl = panel.querySelector('#perf-ms');
  const renderEl = panel.querySelector('#perf-render'),
    jsEl = panel.querySelector('#perf-js'),
    modeEl = panel.querySelector('#perf-mode');
  const metrics = (window.cardPerformance = {
    cardCount,
    history: [],
    fps: 0,
    frameMs: 0,
    redrawsPerSecond: 0,
    renderMs: 0,
    samples: 0,
  });
  let renders = 0,
    renderTime = 0,
    last = 0,
    start = 0,
    frames = 0,
    frameTime = 0,
    raf = 0;
  const render = cardUI.render;
  cardUI.render = () => {
    const began = performance.now();
    render();
    renders++;
    renderTime += performance.now() - began;
  };
  function draw() {
    const history = metrics.history,
      ceiling = Math.max(60, Math.ceil(Math.max(...history) / 30) * 30);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#d9cbb0';
    ctx.lineWidth = 0.5;
    for (const y of [1, height / 2, height - 1]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    const y = (value) => height - 1 - Math.min(1, value / ceiling) * (height - 3);
    ctx.beginPath();
    history.forEach((value, i) => {
      const x = ((48 - history.length + i) * width) / 47;
      i ? ctx.lineTo(x, y(value)) : ctx.moveTo(x, y(value));
    });
    ctx.strokeStyle = '#4b74ae';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#8a8172';
    ctx.font = '8px monospace';
    ctx.fillText(String(ceiling), 2, 8);
  }
  function tick(now) {
    if (last) {
      frames++;
      frameTime += now - last;
    }
    last = now;
    if (!start) start = now;
    const elapsed = now - start;
    if (elapsed >= 250 && frames) {
      metrics.fps = (frames * 1000) / frameTime;
      metrics.frameMs = frameTime / frames;
      metrics.redrawsPerSecond = (renders * 1000) / elapsed;
      metrics.renderMs = renders ? renderTime / renders : 0;
      metrics.samples++;
      metrics.history.push(metrics.fps);
      if (metrics.history.length > 48) metrics.history.shift();
      fpsEl.textContent = Math.round(metrics.fps);
      msEl.textContent = metrics.frameMs.toFixed(1) + ' ms / 帧';
      renderEl.textContent = '重绘 ' + Math.round(metrics.redrawsPerSecond) + ' / s';
      jsEl.textContent = 'JS ' + (renders ? metrics.renderMs.toFixed(1) : '—') + ' ms';
      modeEl.textContent = renders ? '渲染中' : '静止';
      draw();
      renders = renderTime = frames = frameTime = 0;
      start = now;
    }
    raf = requestAnimationFrame(tick);
  }
  metrics.reset = () => {
    metrics.history.length = 0;
    metrics.fps =
      metrics.frameMs =
      metrics.redrawsPerSecond =
      metrics.renderMs =
      metrics.samples =
        0;
    last = start = frames = frameTime = renders = renderTime = 0;
    fpsEl.textContent = '—';
    msEl.textContent = '— ms / 帧';
    draw();
  };
  function resume() {
    cancelAnimationFrame(raf);
    last = start = frames = frameTime = renders = renderTime = 0;
    if (!document.hidden) raf = requestAnimationFrame(tick);
  }
  addEventListener('visibilitychange', resume);
  addEventListener('pagehide', () => cancelAnimationFrame(raf));
  resume();
}
