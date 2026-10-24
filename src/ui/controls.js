import { cardFlip } from '../cards/animation.js';
import { cardGroup } from '../cards/constants.js';

// Chinese labels for the Colorfigures page shell, shared by every page in this project.
export function mountShell(ui, { palette, swatches }) {
  document.querySelector('header').remove();
  document.querySelector('#lblctl').hidden = true;
  document.querySelectorAll('.ctl > label').forEach((label, i) => {
    label.textContent = ['笔触', palette, '标签'][i] || '';
  });
  document.querySelectorAll('.sw').forEach((swatch, i) => {
    if (swatches[i] == null) {
      swatch.hidden = true;
      return;
    }
    swatch.title = swatches[i];
    swatch.setAttribute('aria-label', swatch.title);
  });
  addEventListener('resize', () => ui.invalidate());
}

export function mountControls(ui) {
  const html = document.documentElement;
  html.classList.toggle('nolabels', new URLSearchParams(location.search).get('labels') !== '1');
  mountShell(ui, {
    palette: '牌背配色',
    swatches: ['芥末黄', '番茄红', '薄荷绿', '钴蓝', '玫瑰粉'],
  });
  const switches = document.createElement('div');
  switches.className = 'vset';
  switches.innerHTML =
    '<div class="vrow"><button class="act" id="lblb" aria-pressed="false">牌名</button></div>';
  document.querySelector('.stage').append(switches);
  const labels = document.getElementById('lblb');
  const syncLabels = () =>
    labels.setAttribute('aria-pressed', !html.classList.contains('nolabels'));
  labels.onclick = () => {
    html.classList.toggle('nolabels');
    syncLabels();
  };
  syncLabels();
  addEventListener('keydown', (event) => {
    if (/input|textarea|button/i.test(event.target.tagName)) return;
    if (event.key === '1') cardFlip(ui.st, ui, cardGroup(0));
    if (event.key === '3') cardFlip(ui.st, ui, cardGroup(2));
    if (event.key === '2') cardFlip(ui.st, ui, cardGroup(1));
  });
}
