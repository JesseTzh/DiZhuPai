const AUTO_MAX = 2;
const STORAGE_KEY = 'render-scale';
export const RENDER_DPR_OPTIONS = ['auto', '0.75', '1', '1.5', '2', '3', '4'];

/* The renderer asks for its pixel ratio every frame, so the URL and storage are
 * re-read only when the search string, the storage object or a settings event changed. */
let cache = null,
  listening = false;
function readSetting() {
  const search = String(location.search),
    storage = typeof localStorage === 'undefined' ? null : localStorage;
  if (cache && cache.search === search && cache.storage === storage) return cache;
  const query = new URLSearchParams(search).get('dpr'),
    saved = storage?.getItem?.(STORAGE_KEY);
  cache = {
    search,
    storage,
    value: RENDER_DPR_OPTIONS.includes(query)
      ? query
      : RENDER_DPR_OPTIONS.includes(saved)
        ? saved
        : '2',
  };
  return cache;
}
export function renderDprSetting() {
  if (!listening) {
    listening = true;
    globalThis.addEventListener?.('render-settings-change', () => (cache = null));
    globalThis.addEventListener?.('storage', () => (cache = null));
  }
  return readSetting().value;
}
export function setRenderDprSetting(value) {
  if (!RENDER_DPR_OPTIONS.includes(value)) return;
  localStorage.setItem(STORAGE_KEY, value);
  const url = new URL(location.href);
  url.searchParams.delete('dpr');
  history.replaceState(history.state, '', url);
  dispatchEvent(new Event('render-settings-change'));
}
export function renderPixelRatio() {
  const setting = renderDprSetting();
  return setting === 'auto' ? Math.min(devicePixelRatio || 1, AUTO_MAX) : Number(setting);
}
export function renderScaleOptions() {
  return RENDER_DPR_OPTIONS.map(
    (value) =>
      `<option value="${value}">${value === 'auto' ? '自动（最高 2×）' : `${value}×`}</option>`,
  ).join('');
}
