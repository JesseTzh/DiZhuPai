import { ITEMS } from '../game/items.js';
import { itemDetails, itemIconMarkup } from './item-presentation.js';

const ink = '#292a28';
// The catalogue card carries the shop's toy colour, description model and icon art.
const card = (item, owned) => {
  const { title, description, footer } = itemDetails(item);
  return `<article class="catalogue-card${owned ? ' owned' : ''}" style="--toy-color:${item.color}"><div class="catalogue-icon">${itemIconMarkup(item.id)}</div><h3>${title}</h3><p>${description}</p><footer><span>${footer}</span><b>${item.price} 金币</b></footer>${owned ? '<em class="catalogue-owned">已拥有</em>' : ''}</article>`;
};

export function mountItemCatalogue({ state }) {
  const catalogue = document.createElement('dialog');
  catalogue.id = 'item-catalogue';
  catalogue.setAttribute('aria-labelledby', 'catalogue-title');
  catalogue.innerHTML = `<div class="catalogue-content">
    <svg class="settings-paper" viewBox="0 0 440 368" preserveAspectRatio="none" aria-hidden="true"><path d="M12 12L428 9 432 353 18 360 7 348Z" fill="#6487bd"/><path d="M5 4L421 3 425 343 12 349 3 336Z" fill="#fff8e7" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><path d="M15 339L414 334M414 14L417 324" fill="none" stroke="#d5c7a9" stroke-width="1.3"/><path d="M26 86Q203 83 399 87" fill="none" stroke="#b4a381" stroke-width="1.2"/></svg>
    <div class="settings-heading"><h1 id="catalogue-title"><span class="sr-only">道具图鉴</span><svg viewBox="0 0 178 52" aria-hidden="true"><path d="M3 43L170 43" stroke="#f4b829" stroke-width="9"/><text x="3" y="34">道具图鉴</text></svg>${itemIconMarkup('frog')}</h1>
    <button id="close-catalogue" aria-label="关闭道具图鉴"><svg viewBox="0 0 44 44" aria-hidden="true"><path d="M6 8L35 5 39 35 9 39Z" fill="#6487bd"/><path d="M4 4L33 3 36 32 6 35Z" fill="#fff8e7" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><path d="M13 12L26 25M26 12L13 25" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/></svg></button></div>
    <p class="catalogue-note">鹅掌柜杂货铺的全部玩具：每次进店随机上架三件，买下后本场持续生效。</p>
    <div class="catalogue-grid"></div>
  </div>`;
  document.body.append(catalogue);
  const grid = catalogue.querySelector('.catalogue-grid');
  catalogue.querySelector('#close-catalogue').onclick = () => catalogue.close();
  catalogue.addEventListener('click', (event) => {
    if (event.target !== catalogue) return;
    const rect = catalogue.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      catalogue.close();
  });
  return {
    element: catalogue,
    open() {
      grid.innerHTML = ITEMS.map((item) => card(item, state.game.items.includes(item.id))).join('');
      catalogue.showModal();
      catalogue.querySelector('#close-catalogue').focus({ preventScroll: true });
    },
  };
}
