import {
  PALS,
  setOrigin,
  setCenter,
  P,
  f,
  INK_K,
  INK_REF_VB,
  setInkScale,
  inkScale,
  setLight,
} from './index.js';
import { patchSvg } from './svg-dom.js';
import { createHandFilter } from './filter.js';
export function mountFigure(cfg) {
  document.title = cfg.title;
  document.body.innerHTML = `
    <header><h1>Fig. ${cfg.fig} — ${cfg.title}</h1></header>
    <div class="stage">
      ${cfg.buttons && cfg.buttons.length ? `<div class="actions" id="btns"></div>` : ''}
      ${cfg.stats ? '<div class="stats" id="stats"></div>' : ''}
      <div class="toast" id="toast" role="status"></div>
      <svg id="fig" role="img" aria-label="${cfg.title}"><defs id="fdefs"></defs><g id="art" filter="url(#hand)"></g></svg>
    </div>
    <div id="readout"></div>
    ${cfg.idea ? `<p class="idea"><strong>The big idea</strong>${cfg.idea}</p>` : ''}
    <div class="controls">
      <div class="ctl"><label for="wb">Hand-drawn wobble</label><input id="wb" type="range" min="0" max="7" step="0.1" value="2.4"></div>
      <div class="ctl"><label>Colour</label><div class="row" id="pals"></div></div>
      <div class="ctl" id="lblctl" hidden><label>Labels</label><div class="row"><button id="lbl" aria-pressed="true">On</button></div></div>
    </div>
    ${cfg.credit === false ? '' : '<footer class="made-with"><a href="https://april-zhu.com/colorfigures" target="_blank" rel="noopener">Made with Colorfigures ↗</a></footer>'}`;
  const st = cfg.state || {}; // kept as the same object, so a figure may hold on to it
  if (!st.pal) st.pal = cfg.palette || 'mustard';
  if (st.az == null) st.az = 105;
  const q = new URLSearchParams(location.search);
  if (PALS[q.get('pal')]) st.pal = q.get('pal');
  if (cfg.params) cfg.params(st, q);

  // frame on the object itself: centred, filling ~60% of the width / ~78% of the height of a 4:3 view.
  // The cast shadow is allowed to spill outside the frame (svg overflow is visible).
  const [W, D, H] = cfg.size,
    pts = [];
  setOrigin(0, 0);
  setCenter(cfg.center || [W / 2, D / 2], H / 2);
  for (const x of [0, W]) for (const y of [0, D]) for (const z of [0, H]) pts.push(P(x, y, z));
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const bw = Math.max(...xs) - Math.min(...xs),
    bh = Math.max(...ys) - Math.min(...ys);
  // the object fills ~74% of the width / ~88% of the height, nudged right of centre so the buttons (top left) stay clear
  const A = 0.75,
    vbW = Math.max(bw / 0.74, bh / 0.88 / A),
    vbH = vbW * A;
  setOrigin((vbW - bw) / 2 + vbW * 0.06 - Math.min(...xs), vbH * 0.04 - Math.min(...ys)); // sit a little high: shadows fall downward
  const svg = document.getElementById('fig');
  svg.setAttribute('viewBox', `0 0 ${f(vbW)} ${f(vbH)}`);
  setInkScale(cfg.inkScale ?? vbW / INK_REF_VB);
  const filter = createHandFilter(svg, document.getElementById('fdefs'), INK_K);

  const art = document.getElementById('art'),
    readout = document.getElementById('readout');
  const ui = { st };
  const renderScene = cfg.renderer
    ? cfg.renderer(art, svg)
    : (state, material) => patchSvg(art, inkScale(cfg.scene(state, material)));
  let lastPalette;
  ui.render = () => {
    if (lastPalette !== st.pal) {
      document.documentElement.style.setProperty('--accent', PALS[st.pal].l);
      lastPalette = st.pal;
    }
    renderScene(st, PALS[st.pal]);
    if (!['cpu', 'pending'].includes(svg.dataset.renderer)) filter.update();
    if (!ui._flash) {
      const text = cfg.readout ? cfg.readout(st) : '';
      if (readout.textContent !== text) readout.textContent = text;
    }
    if (ui.drawStats) ui.drawStats();
  };
  ui.filter = filter;
  ui.ready = async () => {
    await renderScene.ready;
    if (!['cpu', 'pending'].includes(svg.dataset.renderer)) await filter.ready();
  };
  // big numbers in the top-right corner (credit, change, score…); a value that changes gets a little bump
  const statsEl = document.getElementById('stats'),
    prevStats = {};
  ui.drawStats = () => {
    if (!statsEl) return;
    const list = cfg.stats(st).filter(Boolean),
      html = list
        .map(
          (x) =>
            `<div class="stat${x.small ? ' small' : ''}"><div class="k">${x.label}</div><div class="v" data-k="${x.label}">${x.value}</div></div>`,
        )
        .join('');
    if (statsEl._html !== html) {
      statsEl._html = html;
      statsEl.innerHTML = html;
      statsEl.querySelectorAll('.v').forEach((v) => {
        if (prevStats[v.dataset.k] != null && prevStats[v.dataset.k] !== v.textContent)
          v.classList.add('bump');
        prevStats[v.dataset.k] = v.textContent;
      });
    }
  };
  let flashT = 0;
  const toast = document.getElementById('toast');
  ui.flash = (text, ms = 1600) => {
    ui._flash = true;
    readout.textContent = text;
    toast.textContent = text;
    toast.style.top =
      (document.getElementById('btns')
        ? document.getElementById('btns').offsetTop + document.getElementById('btns').offsetHeight
        : 0) +
      8 +
      'px';
    toast.classList.add('show');
    clearTimeout(flashT);
    flashT = setTimeout(() => {
      ui._flash = false;
      toast.classList.remove('show');
      ui.render();
    }, ms);
  };
  // One frame driver for every running animation: each frame runs all the steps, then draws once (two animations at
  // the same time no longer draw twice). It follows the screen's frames, with a timer fallback for when frames don't
  // come (headless shots, a hidden tab). ui.invalidate() asks for one redraw on the next frame.
  const steps = new Set();
  let scheduled = false,
    lastT = 0,
    raf = 0,
    timer = 0;
  const frame = () => {
    if (!scheduled) return;
    scheduled = false;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    const now = performance.now(),
      dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000));
    lastT = now;
    for (const step of [...steps]) if (step(dt) === false) steps.delete(step);
    ui.render();
    if (steps.size) drive();
  };
  const drive = () => {
    if (scheduled) return;
    scheduled = true;
    raf = requestAnimationFrame(frame);
    timer = setTimeout(frame, 60);
  };
  ui.animate = (step) => {
    if (!steps.size && !scheduled) lastT = performance.now();
    steps.add(step);
    drive();
  };
  ui.invalidate = drive;

  // Delegate presses so retained SVG parts share one interaction handler.
  svg.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    const a = e.target.closest('[data-act]');
    if (!a || !cfg.acts || !cfg.acts[a.dataset.act]) return;
    e.preventDefault();
    cfg.acts[a.dataset.act](st, a, ui);
    ui.render();
  });
  const btns = document.getElementById('btns');
  const stepEls = [];
  if (btns)
    cfg.buttons.forEach((b, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'stepwrap';
      const el = document.createElement('button');
      el.className = 'act';
      el.innerHTML = `${b.label}${b.choices ? '<span class="car">▾</span>' : ''}`;
      wrap.appendChild(el);
      btns.appendChild(wrap);
      stepEls.push(el);
      if (!b.choices) {
        el.onclick = () => {
          closeChips();
          b.onClick(st, ui);
          ui.render();
        };
        return;
      }
      const chips = document.createElement('div');
      chips.className = 'chips';
      wrap.appendChild(chips);
      el.onclick = (e) => {
        e.stopPropagation();
        const open = !wrap.classList.contains('open');
        closeChips();
        if (!open) return;
        chips.innerHTML = '';
        // every choice stays clickable, so nothing silently ignores a press:
        //   current:true  = the one in use (shown selected); a press just says so
        //   disabled:true = not possible right now (shown faded); a press says why (c.why, or a generic note)
        for (const c of b.choices(st)) {
          const ch = document.createElement('button');
          ch.className = 'chip' + (c.current ? ' current' : c.disabled ? ' off' : '');
          ch.textContent = c.label;
          if (c.current) ch.setAttribute('aria-pressed', 'true');
          ch.onclick = (ev) => {
            ev.stopPropagation();
            closeChips();
            if (c.current) return ui.flash(`${c.label} — already set`);
            if (c.disabled) return ui.flash(c.why || `${c.label} isn't possible right now`);
            c.onClick(st, ui);
            ui.render();
          };
          chips.appendChild(ch);
        }
        wrap.classList.add('open');
      };
    });
  function closeChips() {
    document.querySelectorAll('.stepwrap.open').forEach((w) => w.classList.remove('open'));
  }
  document.addEventListener('click', closeChips);

  document.getElementById('wb').oninput = (e) =>
    document.getElementById('wob').setAttribute('scale', (e.target.value * INK_K).toFixed(2));
  const pals = document.getElementById('pals');
  for (const [k, p] of Object.entries(PALS)) {
    const b = document.createElement('button');
    b.className = 'sw';
    b.title = k;
    b.style.background = p.l;
    b.setAttribute('aria-pressed', k === st.pal);
    b.onclick = () => {
      st.pal = k;
      [...pals.children].forEach((c) => c.setAttribute('aria-pressed', c === b));
      ui.render();
    };
    pals.appendChild(b);
  }
  // labels: the switch appears when the figure draws any tag(); ?labels=0 starts with them hidden
  const lblctl = document.getElementById('lblctl'),
    lbl = document.getElementById('lbl');
  const setLabels = (on) => {
    document.documentElement.classList.toggle('nolabels', !on);
    lbl.textContent = on ? 'On' : 'Off';
    lbl.setAttribute('aria-pressed', on);
  };
  lbl.onclick = () => setLabels(document.documentElement.classList.contains('nolabels'));
  if (q.get('labels') === '0') setLabels(false);
  // testing: ?press=Label@ms,Label@ms clicks the buttons whose text starts with Label at those times after load
  // (any order, repeats allowed); Label>Choice picks a choice from a picker button (?press=Speed>3@300).
  // Script errors and unknown labels are recorded on <html data-errors="…">
  window.__st = st;
  const noteErr = (m) => {
    document.documentElement.dataset.errors =
      (document.documentElement.dataset.errors || '') + ' ' + m + ';';
  };
  const starts = (el, t) => el.textContent.trim().toLowerCase().startsWith(t.trim().toLowerCase());
  if (q.has('press'))
    q.get('press')
      .split(',')
      .forEach((item) => {
        const [what, ms] = item.split('@'),
          [label, choice] = what.split('>');
        setTimeout(() => {
          const b = [...document.querySelectorAll('.act')].find((b) => starts(b, label));
          if (!b) return noteErr(`no button "${label}"`);
          b.click();
          if (choice == null) return;
          const c = [...b.parentElement.querySelectorAll('.chip')].find((c) => starts(c, choice));
          if (c && !c.disabled) c.click();
          else noteErr(`no choice "${choice}" in "${label}"`);
        }, +ms || 0);
      });
  setLight(st.az);
  ui.render();
  if (art.querySelector('.tag')) lblctl.hidden = false;
  return ui;
}
