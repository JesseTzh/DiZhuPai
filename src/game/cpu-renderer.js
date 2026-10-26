import { isMobileLandscape } from '../ui/device-mode.js';
import { ModelCanvas } from './model-canvas.js';
import { P, paintOrder, setCameraPitch, viewKey } from '../engine/camera.js';
import { SpriteCache } from '../engine/sprite-cache.js';
import { patchSvg } from '../engine/svg-dom.js';
import { cpuArt } from './cpu-art.js';
import { sceneFrame, fitScene, handPose } from './scene-frame.js';
import { layoutFor } from './scene-layout.js';
import { tableGeometry } from './table-geometry.js';
import { tableItemModel } from './table-items.js';
import { world } from './table.js';
import { paintTable } from './table-layer.js';
import { cardParts, bagParts, coinParts, itemParts } from './scene-parts.js';
import { labelMarkup } from './scene-overlay.js';
import { createHover } from './hover.js';

/* One frame: camera → layout → framing → retained table layer → shadows → painter's parts →
 * paper grain → SVG interaction shell. `host.invalidate()` (the figure's frame driver) asks
 * for redraws, so hover, resize and settings never start a second animation loop. */
export async function createRenderer(art, svg, host) {
  const images = await cpuArt(),
    canvas = new ModelCanvas(svg),
    sprites = new SpriteCache(),
    hover = createHover();
  const layer = document.createElementNS(svg.namespaceURI, 'g');
  art.append(layer);
  let current,
    disposed = false,
    fallback = 0,
    anchors = null;
  svg.classList.add('cpu-active');
  // Stable DOM anchors; per-frame lookups would cost more than the draw itself.
  let stageEl, topbarEl, wbEl;
  const invalidate = () => {
    if (disposed) return;
    if (host?.invalidate) return host.invalidate();
    fallback ||= requestAnimationFrame(() => {
      fallback = 0;
      if (current) draw(...current);
    });
  };
  const updateHover = (id) => {
    if (hover.set(id == null ? null : Number(id), performance.now())) invalidate();
  };
  const setHover = (event) => {
    updateHover(event.target.closest?.('[data-card]')?.dataset.card ?? null);
  };
  const leave = () => updateHover(null);
  const focusOut = (event) => {
    updateHover(event.relatedTarget?.closest?.('[data-card]')?.dataset.card ?? null);
  };
  // Aim the camera and fit the view box; phones look straight down with a compact frame.
  function aim(st, layout, mobile) {
    const entry = st.visual.entry;
    const progress = entry ? Math.min(1, Math.max(0, (entry.time - 0.16) / 0.56)) : 1;
    const home = st.visual.home && !entry;
    setCameraPitch(
      mobile ? 90 : (entry?.pitch ?? (home ? 90 : 68)),
      mobile || home || progress === 0 ? 0 : 1800 / progress,
    );
    // CSS transforms must not change the viewport or raster resolution.
    canvas.size = { width: svg.clientWidth, height: svg.clientHeight };
    stageEl ||= svg.closest('.stage');
    topbarEl ||= stageEl?.querySelector('.game-topbar');
    let framing = {};
    if (!home && mobile) {
      /* Phone gameplay frames a tighter window than the home board. Interpolate
       * between the two while the entry animation runs, so switching modes never
       * jumps the table. `tall` headroom is folded into the bounds at the end. */
      const t = entry ? progress : 1,
        wide = { u0: -372, u1: 372, v0: -273, v1: 273 },
        tight = layout.bounds,
        mix = (a, b) => a + (b - a) * t;
      framing = {
        zoom: 1,
        bounds: {
          u0: mix(wide.u0, tight.u0),
          u1: mix(wide.u1, tight.u1),
          v0: mix(wide.v0, tight.v0),
          v1: mix(wide.v1, tight.v1),
        },
        padX: 45 * (1 - t),
        padY: 55 * (1 - t),
        tall: 82 * (1 - t),
      };
    } else if (!home && topbarEl) {
      const { A, B } = tableGeometry(st.tableStyle);
      framing = {
        zoom: 1.02,
        surface: [...A, ...B],
        centerY:
          (topbarEl.offsetTop + topbarEl.offsetHeight + stageEl.clientHeight) / 2 -
          svg.parentElement.offsetTop,
      };
    }
    fitScene(svg, canvas.size, framing);
  }
  // Anchor controls to the gap between resting cards, so selection and dealing never move them.
  function anchorControls(st, layout, view) {
    const handCount = st.game.hands[0].length || 18,
      key = `${view}|${handCount}|${layout.handScale}|${layout.playScale}`;
    if (anchors?.key !== key) {
      const hand = canvas.cardGeometry(handPose(0, handCount - 1, handCount, layout)),
        played = canvas.cardGeometry({ u: 0, v: 0, z: 6, scale: layout.playScale });
      const handTop = Math.min(...[...hand.A, ...hand.B].map((point) => P(...point)[1])),
        playedBottom = Math.max(...[...played.A, ...played.B].map((point) => P(...point)[1]));
      anchors = {
        key,
        center: String((handTop + playedBottom) / 2),
        // The HTML pills need the hand's top edge as well as the middle of the gap:
        // on very short screens the gap cannot hold them at full size.
        gap: String(handTop - playedBottom),
      };
    }
    if (svg.dataset.actionCenter !== anchors.center || svg.dataset.actionGap !== anchors.gap) {
      svg.dataset.actionCenter = anchors.center;
      svg.dataset.actionGap = anchors.gap;
      svg.dispatchEvent(new Event('scene-layout'));
    }
  }
  function draw(st, material) {
    if (disposed) return;
    current = [st, material];
    const home = st.visual.home && !st.visual.entry,
      mobile = isMobileLandscape(),
      layout = layoutFor(mobile);
    aim(st, layout, mobile);
    const frame = sceneFrame(st, layout),
      table = tableGeometry(st.tableStyle);
    canvas.begin();
    const view = `${viewKey()}|${canvas.transformKey()}`;
    sprites.begin(view);
    anchorControls(st, layout, view);
    const items = (home ? [] : st.game.items).map((id, index) => {
      const place = layout.itemLayout
        ? {
            u: layout.itemLayout.u,
            v: layout.itemLayout.v + index * layout.itemLayout.step,
            scale: layout.itemLayout.scale || 0.25,
          }
        : null;
      return { id, model: tableItemModel(id, place), key: `item|${id}|${JSON.stringify(place)}` };
    });
    sprites.draw(canvas, `table|${st.tableStyle}|${items.map((i) => i.key).join()}`, null, () =>
      paintTable(
        canvas,
        table,
        items.map((i) => i.model),
      ),
    );
    const now = performance.now(),
      lift = hover.sample(now);
    const scene = { canvas, sprites, layout, parts: [], overlay: [], hits: [] };
    cardParts(scene, frame, st, images, lift.values);
    bagParts(scene, frame, images);
    coinParts(scene, frame, images);
    itemParts(scene, items);
    // One flat fill for every tabletop shadow collected above (single clip, single fill).
    canvas.flushShadows(table.B);
    scene.parts.sort(paintOrder);
    scene.hits.sort(paintOrder);
    for (const part of scene.parts) sprites.draw(canvas, part.key, part.extent, part.draw);
    sprites.end();
    canvas.finish(+((wbEl ||= document.getElementById('wb'))?.value ?? 2.4));
    const overlay = scene.overlay;
    for (const target of scene.hits) overlay.push(target.markup);
    for (const label of frame.labels)
      overlay.push(labelMarkup(label, P(...world(label.u, label.v, label.z))));
    const markup = overlay.join('');
    if (markup !== layer._markup) {
      patchSvg(layer, markup);
      layer._markup = markup;
    }
    if (lift.moving) invalidate();
  }
  svg.addEventListener('pointerover', setHover);
  svg.addEventListener('focusin', setHover);
  svg.addEventListener('pointerleave', leave);
  svg.addEventListener('focusout', focusOut);
  addEventListener('render-settings-change', invalidate);
  svg.addEventListener('cpu-resize', invalidate);
  document.getElementById('wb').addEventListener('input', invalidate);
  return {
    draw,
    dispose() {
      disposed = true;
      cancelAnimationFrame(fallback);
      svg.removeEventListener('pointerover', setHover);
      svg.removeEventListener('focusin', setHover);
      svg.removeEventListener('pointerleave', leave);
      svg.removeEventListener('focusout', focusOut);
      removeEventListener('render-settings-change', invalidate);
      svg.removeEventListener('cpu-resize', invalidate);
      document.getElementById('wb').removeEventListener('input', invalidate);
      svg.classList.remove('cpu-active');
      sprites.clear();
      canvas.dispose();
      layer.remove();
    },
  };
}
