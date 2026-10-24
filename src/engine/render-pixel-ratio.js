const AUTO_MAX = 2;
const STORAGE_KEY = 'render-scale';
export const RENDER_DPR_OPTIONS = ['auto', '0.75', '1', '1.5', '2', '3', '4'];

export function renderDprSetting() {
  const query = new URLSearchParams(location.search).get('dpr');
  if (RENDER_DPR_OPTIONS.includes(query)) return query;
  const saved = localStorage.getItem(STORAGE_KEY);
  return RENDER_DPR_OPTIONS.includes(saved) ? saved : '2';
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
