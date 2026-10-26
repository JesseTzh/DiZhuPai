export const BUILD_VERSION =
  typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__ : 'Version:dev-test';

export function mountBuildVersion(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'settings-version';
  canvas.width = 720;
  canvas.height = 36;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', BUILD_VERSION);
  canvas.textContent = BUILD_VERSION;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#7a6c56';
  ctx.font = '12px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(BUILD_VERSION, 180, 13, 352);
  container.append(canvas);
}
