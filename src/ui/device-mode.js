// 手机端检测的唯一事实来源:触屏 = 主输入没有悬停且为粗指针,方向 = 横屏。
// 这两条媒体查询与 styles/mobile.css 逐字一致,两边必须同步修改。
// 带触摸屏的桌面机主指针仍是鼠标(hover: hover + pointer: fine),不会误判成手机。
export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';
export const LANDSCAPE_QUERY = '(orientation: landscape)';
const touch = matchMedia(TOUCH_QUERY);
const landscape = matchMedia(LANDSCAPE_QUERY);

export const isTouchDevice = () => touch.matches;
export const isLandscape = () => landscape.matches;
export const isMobileLandscape = () => touch.matches && landscape.matches;

// 触屏能力或方向每次变化都回调(注册时先回调一次同步现状),返回取消监听函数。
export function watchMobileMode(listener) {
  const notify = () => listener({ touch: touch.matches, landscape: landscape.matches });
  notify();
  touch.addEventListener('change', notify);
  landscape.addEventListener('change', notify);
  return () => {
    touch.removeEventListener('change', notify);
    landscape.removeEventListener('change', notify);
  };
}

// 横屏模式守卫:触屏设备竖屏持机时盖住整页提示转到横屏,转回横屏后自动消失。
export function mountMobileOrientationGuard() {
  const overlay = document.createElement('div');
  overlay.id = 'rotate-hint';
  overlay.hidden = true;
  overlay.setAttribute('role', 'alert');
  overlay.innerHTML =
    '<svg viewBox="0 0 96 96" aria-hidden="true">' +
    '<g fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round">' +
    '<rect x="32" y="14" width="32" height="60" rx="7"/>' +
    '<line x1="43" y1="23" x2="53" y2="23"/>' +
    '<line x1="43" y1="65" x2="53" y2="65"/>' +
    '</g></svg>' +
    '<p class="rotate-title">请横屏游玩</p>' +
    '<p class="rotate-text">地主牌桌面按横屏设计，把手机转过来再开始。</p>';
  document.body.append(overlay);
  watchMobileMode(({ touch, landscape }) => {
    overlay.hidden = !touch || landscape;
  });
}
