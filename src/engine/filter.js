import { SVG_NS, svgElement } from './svg-dom.js';

export const filterFor = (
  k,
) => `<filter id="hand" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="${(0.045 / k).toFixed(4)}" numOctaves="2" seed="4" result="warp"/>
  <feDisplacementMap id="wob" in="SourceGraphic" in2="warp" scale="${(2.4 * k).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="wob"/>
  <feTurbulence type="fractalNoise" baseFrequency="${(0.9 / k).toFixed(4)}" numOctaves="3" seed="11" result="n1"/>
  <feColorMatrix in="n1" type="matrix" values=".3 0 0 0 .84  .3 0 0 0 .84  .3 0 0 0 .84  0 0 0 0 1" result="grain"/>
  <feTurbulence type="fractalNoise" baseFrequency="${(0.012 / k).toFixed(4)}" numOctaves="2" seed="7" result="n2"/>
  <feColorMatrix in="n2" type="matrix" values=".3 0 0 0 .85  .3 0 0 0 .85  .3 0 0 0 .85  0 0 0 0 1" result="blot"/>
  <feBlend in="wob" in2="grain" mode="multiply" result="g1"/><feBlend in="g1" in2="blot" mode="multiply" result="g2"/>
  <feComposite in="g2" in2="wob" operator="in"/></filter>`;

const DENSITY = 2;
const MAX_PIXELS = 16_000_000;
const fits = (region) => region[2] * region[3] * DENSITY ** 2 <= MAX_PIXELS;
const covers = (region, { x, y, width, height }) =>
  region &&
  x - width * 0.1 >= region[0] &&
  y - height * 0.1 >= region[1] &&
  x + width * 1.1 <= region[0] + region[2] &&
  y + height * 1.1 <= region[1] + region[3];

/** Grow in fixed drawing coordinates, avoiding texture drift as the camera turns.
 * If the union is too large, start a fresh region; oversized views use live noise.
 */
export function noiseRegion({ x, y, width, height }, previous = null) {
  const left = Math.floor(Math.min(x - width * 0.25, previous?.[0] ?? Infinity) / 128) * 128;
  const top = Math.floor(Math.min(y - height * 0.25, previous?.[1] ?? Infinity) / 128) * 128;
  const right =
    Math.ceil(Math.max(x + width * 1.25, previous ? previous[0] + previous[2] : -Infinity) / 128) *
    128;
  const bottom =
    Math.ceil(Math.max(y + height * 1.25, previous ? previous[1] + previous[3] : -Infinity) / 128) *
    128;
  const region = [left, top, right - left, bottom - top];
  if (fits(region)) return region;
  return previous ? noiseRegion({ x, y, width, height }) : null;
}

/** Keep filter definitions alive. Only smooth noise is rasterized; fine grain stays
 * procedural for zoom. Failed, oversized or obsolete jobs retain live SVG noise.
 */
export function createHandFilter(svg, defs, scale) {
  defs.innerHTML = filterFor(scale);
  const filter = defs.firstElementChild;
  const layers = [...filter.querySelectorAll('feTurbulence')]
    .filter((node) => node.getAttribute('result') !== 'n1')
    .map((node) => ({
      source: node.cloneNode(),
      node,
      region: null,
      requested: null,
      generation: 0,
      failed: '',
    }));
  const pending = new Set();
  let disposed = false;
  const countCached = () => {
    filter.dataset.cachedLayers = String(layers.filter((layer) => layer.region).length);
  };
  countCached();

  function restore(layer) {
    if (!layer.region) return;
    const live = layer.source.cloneNode();
    layer.node.replaceWith(live);
    layer.node = live;
    layer.region = null;
    countCached();
  }

  function bake(layer, region) {
    const generation = ++layer.generation;
    const [x, y, width, height] = region;
    const pixelWidth = Math.ceil(width * DENSITY),
      pixelHeight = Math.ceil(height * DENSITY);
    const primitive = layer.source.cloneNode();
    primitive.removeAttribute('result');
    const source = `<svg xmlns="${SVG_NS}" width="${pixelWidth}" height="${pixelHeight}" viewBox="${region.join(' ')}"><filter id="noise" filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${width}" height="${height}" color-interpolation-filters="sRGB">${primitive.outerHTML}</filter><rect x="${x}" y="${y}" width="${width}" height="${height}" filter="url(#noise)"/></svg>`;
    const task = new Promise((resolve) => {
      const image = new Image();
      const current = () => !disposed && generation === layer.generation && layer.node.isConnected;
      const fail = () => {
        if (current()) {
          layer.failed = region.join();
          layer.requested = null;
        }
        resolve();
      };
      image.onerror = fail;
      image.onload = () => {
        if (!current()) {
          resolve();
          return;
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, pixelWidth, pixelHeight);
          // Match SVG's unpremultiplied noise colour channels.
          for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = 255;
          context.putImageData(pixels, 0, 0);
          const cached = svgElement('feImage', {
            x,
            y,
            width,
            height,
            preserveAspectRatio: 'none',
            result: layer.source.getAttribute('result'),
            href: canvas.toDataURL('image/png'),
          });
          layer.node.replaceWith(cached);
          layer.node = cached;
          layer.region = region;
          countCached();
          canvas.width = canvas.height = 0;
        } catch {
          fail();
          return;
        }
        resolve();
      };
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    });
    pending.add(task);
    task.finally(() => pending.delete(task));
  }

  function update() {
    if (disposed || !filter.isConnected) return;
    const view = svg.viewBox.baseVal;
    if (!view.width || !view.height) return;
    for (const layer of layers) {
      if (covers(layer.requested, view)) continue;
      // Never display a cropped old noise image while the new region is loading.
      const previous = layer.region;
      if (!covers(previous, view)) restore(layer);
      const region = noiseRegion(view, previous);
      if (!region) {
        layer.generation++;
        layer.requested = null;
        continue;
      }
      if (region.join() === layer.failed) continue;
      layer.requested = region;
      bake(layer, region);
    }
  }
  return {
    update,
    async ready() {
      while (pending.size) await Promise.all([...pending]);
    },
    dispose() {
      disposed = true;
      layers.forEach((layer) => layer.generation++);
    },
  };
}
