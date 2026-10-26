import { isMobileLandscape } from '../ui/device-mode.js';
import { ModelCanvas } from './model-canvas.js';
import { P, pd, paintOrder, setCameraPitch } from '../engine/camera.js';
import { tone, facing } from '../engine/shading.js';
import { norm } from '../engine/math.js';
import { PALS, INK } from '../engine/palette.js';
import { coinShape } from '../coins/coin.js';
import { patchSvg } from '../engine/svg-dom.js';
import { cpuArt } from './cpu-art.js';
import { sceneFrame, fitScene, handPose } from './scene-frame.js';
import { tableGeometry } from './table-geometry.js';
import { world } from './table.js';
import { ITEMS } from './items.js';
import { tableItemModel, drawTableItem, tableItemHit, drawTableItemShadow } from './table-items.js';

export async function createRenderer(art, svg) {
  const images = await cpuArt(),
    canvas = new ModelCanvas(svg);
  const layer = document.createElementNS(svg.namespaceURI, 'g');
  art.append(layer);
  let current,
    disposed = false,
    redraw = 0,
    hover = null,
    animation = 0,
    lastTime = 0;
  const hoverProgress = new Map();
  svg.classList.add('cpu-active');
  // Stable DOM anchors; per-frame lookups would cost more than the draw itself.
  let stageEl, topbarEl, wbEl;
  function refresh() {
    if (!redraw && !disposed)
      redraw = requestAnimationFrame(() => {
        redraw = 0;
        if (current) draw(...current);
      });
  }
  const animate = (time) => {
    const dt = Math.min(32, time - (lastTime || time - 16));
    lastTime = time;
    let moving = false;
    for (const [id, value] of hoverProgress) {
      const target = id === hover ? 1 : 0;
      // Bounded travel: enter in 80 ms, return in 50 ms, with no easing tail.
      const delta = dt / (target ? 80 : 50);
      const next = target ? Math.min(1, value + delta) : Math.max(0, value - delta);
      if (next === 0) hoverProgress.delete(id);
      else hoverProgress.set(id, next);
      moving ||= next !== target;
    }
    if (current) draw(...current);
    animation = moving ? requestAnimationFrame(animate) : 0;
    if (!moving) lastTime = 0;
  };
  const updateHover = (id) => {
    const key = id == null ? null : Number(id);
    if (key === hover) return;
    hover = key;
    if (key != null && !hoverProgress.has(key)) hoverProgress.set(key, 0);
    if (!animation) animation = requestAnimationFrame(animate);
  };
  const setHover = (event) => {
    updateHover(event.target.closest?.('[data-card]')?.dataset.card ?? null);
  };
  const leave = () => updateHover(null);
  const focusOut = (event) => {
    updateHover(event.relatedTarget?.closest?.('[data-card]')?.dataset.card ?? null);
  };
  function draw(st, material) {
    if (disposed) return;
    current = [st, material];
    const entry = st.visual.entry;
    const progress = entry ? Math.min(1, Math.max(0, (entry.time - 0.16) / 0.56)) : 1;
    const home = st.visual.home && !entry;
    setCameraPitch(entry?.pitch ?? (home ? 90 : 68), home || progress === 0 ? 0 : 1800 / progress);
    const frame = sceneFrame(st);
    const table = tableGeometry(st.tableStyle),
      { A, B, outline } = table;
    // CSS transforms must not change the viewport or raster resolution.
    canvas.size = { width: svg.clientWidth, height: svg.clientHeight };
    stageEl ||= svg.closest('.stage');
    topbarEl ||= stageEl?.querySelector('.game-topbar');
    const layout =
      topbarEl && !home
        ? {
            zoom: isMobileLandscape() ? 1.1 : 1.02,
            surface: [...A, ...B],
            centerY: isMobileLandscape()
              ? canvas.size.height / 2
              : (topbarEl.offsetTop + topbarEl.offsetHeight + stageEl.clientHeight) / 2 -
                svg.parentElement.offsetTop,
          }
        : {};
    fitScene(svg, canvas.size, layout);
    canvas.begin();
    // Anchor controls to the gap between resting cards, so selection and dealing never move them.
    const handCount = st.game.hands[0].length || 18;
    const hand = canvas.cardGeometry(handPose(0, handCount - 1, handCount)),
      played = canvas.cardGeometry({ u: 0, v: 0, z: 6, scale: 0.86 });
    const handTop = Math.min(...[...hand.A, ...hand.B].map((point) => P(...point)[1])),
      playedBottom = Math.max(...[...played.A, ...played.B].map((point) => P(...point)[1]));
    const actionCenter = String((handTop + playedBottom) / 2);
    if (svg.dataset.actionCenter !== actionCenter) {
      svg.dataset.actionCenter = actionCenter;
      svg.dispatchEvent(new Event('scene-layout'));
    }
    canvas.shadow([...A, ...B], -22);
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length,
        n = norm(world(outline[j][1] - outline[i][1], outline[i][0] - outline[j][0]));
      if (facing(n)) canvas.polygon([A[i], A[j], B[j], B[i]], tone(n, table.material), INK, 0.5);
    }
    canvas.polygon(B, table.material.l, INK, 1.7);
    for (const { points, color } of table.polygons) canvas.polygon(points, color);
    for (const { points, color, width, closed } of table.lines)
      canvas.line(points, color, width, closed);
    const parts = [],
      overlay = [],
      hitTargets = [];
    const bounds = (points) =>
      [0, 1].map((end) =>
        [0, 1, 2].map((axis) => (end ? Math.max : Math.min)(...points.map((p) => p[axis]))),
      );
    const order = paintOrder;
    for (const { id, pose, options } of frame.cards) {
      const hover = options.act ? hoverProgress.get(id) || 0 : 0;
      // Slide on the tabletop; retain the resting pose for stacking and hit order.
      const lift = options.selected ? 22 : 12 * hover;
      const resting = canvas.cardGeometry(pose);
      const g = lift ? canvas.cardGeometry({ ...pose, v: pose.v - lift }) : resting;
      // Hover never moves its own hit area: a stationary pointer cannot retrigger it.
      const hit = options.selected ? g : resting;
      const ring = facing(hit.N) ? hit.B : hit.A;
      if (options.shadow !== false) canvas.addShadow([...g.A, ...g.B], 0);
      const image =
        facing(g.N) && !options.back
          ? options.wild
            ? images.wild
            : options.stampFace
              ? images.fronts[options.stampFace]
              : images.fronts[id]
          : images.backs[options.palette || st.pal];
      const box = bounds([...resting.A, ...resting.B]);
      parts.push({ at: resting.c, box, draw: () => canvas.card(g, image, options) });
      if (options.deckCount)
        overlay.push(
          '<g class="card-deck" data-player="' +
            options.player +
            '" data-count="' +
            options.deckCount +
            '" data-thickness="' +
            pose.thickness +
            '" role="img" aria-label="余牌 ' +
            options.deckCount +
            ' 张"><path d="' +
            pd(ring) +
            '" fill="none" pointer-events="none"/></g>',
        );
      if (options.wild || options.revealing)
        overlay.push(
          `<g class="${options.wild ? 'wild-card-model' : 'wild-card-reveal'}" id="wild-card-${id}" data-card-model="frog-wild" data-wild-card="${id}" data-revealing="${!!options.revealing}" role="img" aria-label="青蛙赖子牌" pointer-events="none"><path d="${pd(ring)}" fill="none" pointer-events="none"/></g>`,
        );
      if (options.act)
        hitTargets.push({
          at: resting.c,
          box,
          markup: `<g data-act="${options.act}" data-card="${id}" data-hover="${hover.toFixed(3)}" class="hand-card${options.selected ? ' selected' : ''}" role="button" tabindex="0" aria-label="${options.name}" aria-pressed="${!!options.selected}"><path d="${pd(ring)}" fill="transparent" pointer-events="all"/></g>`,
        });
    }
    for (const { pos, state, palette, player } of frame.bags) {
      const model = canvas.sackGeometry(state, player),
        m = model.m;
      const map = (p) => p.map((q, i) => pos[i] + 1.08 * (q - (i === 2 ? 0 : 48)));
      canvas.addShadow([...m.body[2], ...m.body[8], ...m.shell.at(-1)].map(map), 0);
      for (const c of state.coins)
        if (c.mode !== 'rain') {
          const g = canvas.coinGeometry(c);
          canvas.addShadow([...g.A, ...g.B].map(map), 0);
        }
      parts.push({
        at: pos.map((q, i) => q + (i === 2 ? 30 : 0)),
        box: bounds([...m.body.flat(), ...m.shell.flat()].map(map)),
        draw: () => canvas.sack(model, state, PALS[palette], pos, 1.08, images.coin),
      });
      const hit = pd(m.body[5].map(map));
      overlay.push(
        `<g class="money-bag" data-player="${player}" data-palette="${palette}" data-fill="${state.fillShow.toFixed(4)}"${player === 0 ? ' data-act="poke-bag" role="button" tabindex="0" aria-label="点击钱袋吐金币"' : ''}>${player === 0 ? `<path d="${hit}" fill="transparent" pointer-events="all"/>` : ''}</g>`,
      );
    }
    for (const { c, tilt, heading, psi } of frame.coins) {
      const g = coinShape(c, tilt, heading, psi);
      canvas.addShadow([...g.A, ...g.B], 0);
      parts.push({ at: c, box: bounds([...g.A, ...g.B]), draw: () => canvas.coin(g, images.coin) });
    }
    for (const id of home ? [] : st.game.items) {
      const item = ITEMS.find((item) => item.id === id),
        model = tableItemModel(id);
      drawTableItemShadow(canvas, model, B);
      parts.push({ ...model, draw: () => drawTableItem(canvas, model) });
      overlay.push(
        `<g class="table-item" id="table-item-${id}" data-item="${id}" role="img" tabindex="0" aria-label="${item.name}：${item.effect}" aria-describedby="item-tooltip"><path d="${tableItemHit(canvas, model)}" fill="transparent" pointer-events="all"/></g>`,
      );
    }
    // One flat fill for every tabletop shadow collected above (single clip, single fill).
    canvas.flushShadows(B);
    parts.sort(order);
    hitTargets.sort(order);
    overlay.push(...hitTargets.map((target) => target.markup));
    for (const part of parts) part.draw();
    canvas.finish(+((wbEl ||= document.getElementById('wb'))?.value ?? 2.4));
    for (const { text, u, v, z, cls } of frame.labels) {
      const [x, y] = P(...world(u, v, z));
      overlay.push(
        `<text class="${cls}" x="${x}" y="${y}" text-anchor="middle" fill="${INK}" font-size="12" font-weight="600">${text}</text>`,
      );
    }
    const markup = overlay.join('');
    if (markup !== layer._markup) {
      patchSvg(layer, markup);
      layer._markup = markup;
    }
  }
  svg.addEventListener('pointerover', setHover);
  svg.addEventListener('focusin', setHover);
  svg.addEventListener('pointerleave', leave);
  svg.addEventListener('focusout', focusOut);
  addEventListener('render-settings-change', refresh);
  svg.addEventListener('cpu-resize', refresh);
  document.getElementById('wb').addEventListener('input', refresh);
  return {
    draw,
    dispose() {
      disposed = true;
      cancelAnimationFrame(redraw);
      cancelAnimationFrame(animation);
      svg.removeEventListener('pointerover', setHover);
      svg.removeEventListener('focusin', setHover);
      svg.removeEventListener('pointerleave', leave);
      svg.removeEventListener('focusout', focusOut);
      removeEventListener('render-settings-change', refresh);
      svg.removeEventListener('cpu-resize', refresh);
      document.getElementById('wb').removeEventListener('input', refresh);
      svg.classList.remove('cpu-active');
      canvas.dispose();
      layer.remove();
    },
  };
}
