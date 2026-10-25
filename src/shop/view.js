import { ITEMS } from '../game/items.js';
import { itemDetails, itemTooltipMarkup } from '../ui/item-presentation.js';
import { mountShopScene, BUY_TIME } from './scene.js';

export function mountShop(stage, buy, next) {
  const shop = document.createElement('section');
  shop.id = 'shop';
  shop.hidden = true;
  shop.setAttribute('aria-label', '关间道具商店');
  shop.innerHTML = `<div class="shop-box"><div class="shop-stage"><svg id="shop-art" role="img" aria-label="鹅掌柜杂货铺：大鹅掌柜站在当铺式柜台后，柜台上摆着算盘和三件玩具"></svg><button id="leave-shop" aria-label="前往下一关"><span class="sr-only exit-accessible-label">前往下一关</span></button><div class="goose-bubble" aria-hidden="true">嘎嘎～承惠承惠！</div>${ITEMS.map((item) => `<article class="shop-product toy-${item.id}" data-item="${item.id}" style="--toy-color:${item.color}"><div class="toy-hit" tabindex="0" role="img" aria-label="${itemDetails(item).accessible}"></div><div class="toy-tooltip" role="tooltip">${itemTooltipMarkup(item)}</div><button class="price-tag" data-buy="${item.id}" aria-label="购买${item.name}，${item.price}金币"><b>${item.name}</b><span></span></button></article>`).join('')}</div><p id="shop-notice" role="status" aria-live="polite"></p></div>`;
  stage.append(shop);
  const svg = shop.querySelector('#shop-art'),
    scene = mountShopScene(svg),
    bubble = shop.querySelector('.goose-bubble');
  shop
    .querySelector('.shop-box')
    .style.setProperty('--ratio', (scene.width / scene.height).toFixed(4));
  const pct = (v, total) => `${((v / total) * 100).toFixed(2)}%`;
  const exit = scene.exitBounds;
  Object.assign(shop.querySelector('#leave-shop').style, {
    left: pct(exit.x0, scene.width),
    top: pct(exit.y0, scene.height),
    width: pct(exit.x1 - exit.x0, scene.width),
    height: pct(exit.y1 - exit.y0, scene.height),
  });
  for (const item of ITEMS) {
    const article = shop.querySelector(`[data-item="${item.id}"]`);
    const on = () => scene.hover(item.id, true),
      off = () => scene.hover(item.id, false);
    article.addEventListener('pointerenter', on);
    article.addEventListener('pointerleave', off);
    article.addEventListener('focusin', on);
    article.addEventListener('focusout', (e) => !article.contains(e.relatedTarget) && off());
  }
  const head = scene.headAt();
  bubble.style.left = pct(head[0], scene.width);
  bubble.style.top = pct(head[1], scene.height);
  let bubbleTimer = 0;
  for (const b of shop.querySelectorAll('[data-buy]'))
    b.onclick = () => {
      if (!buy(b.dataset.buy)?.item) return;
      // the shopkeeper books the sale, then laughs
      scene.purchase();
      clearTimeout(bubbleTimer);
      bubble.classList.remove('show');
      bubbleTimer = setTimeout(() => {
        bubble.classList.add('show');
        bubbleTimer = setTimeout(() => bubble.classList.remove('show'), (BUY_TIME - 2.35) * 1000);
      }, 2350);
    };
  shop.querySelector('#leave-shop').onclick = next;
  let last = '';
  return (game, visible) => {
    if (shop.hidden !== !visible && !visible) scene.reset();
    shop.hidden = !visible;
    if (!visible) return;
    const key = JSON.stringify([game.coins[0], game.items, game.shopStock, game.round]);
    if (last === key) return;
    last = key;
    const exitLabel = game.substage === 3 ? `进入第 ${game.stage + 1} 大关` : '前往下一关';
    shop.querySelector('.exit-sign-label').textContent = exitLabel;
    shop.querySelector('.exit-accessible-label').textContent = exitLabel;
    shop.querySelector('#leave-shop').setAttribute('aria-label', exitLabel);
    // Featured toys take the three stands in stock order; everything else leaves the counter.
    const stock =
      game.shopStock ?? ITEMS.filter((i) => !game.items.includes(i.id)).map((i) => i.id);
    scene.setStock(stock);
    for (const item of ITEMS) {
      const article = shop.querySelector(`[data-item="${item.id}"]`),
        b = article.querySelector('button');
      const stocked = stock.includes(item.id);
      article.hidden = !stocked;
      if (!stocked) {
        b.disabled = true;
        continue;
      }
      const box = scene.toyBox(item.id),
        price = scene.priceAt(item.id),
        pad = 6;
      // the hover area covers the toy at its biggest pose and runs down to its price card on the counter front
      Object.assign(article.style, {
        left: pct(box.x0 - pad, scene.width),
        top: pct(box.y0 - pad, scene.height),
        width: pct(box.x1 - box.x0 + pad * 2, scene.width),
        height: pct(price[1] - box.y0 + pad, scene.height),
      });
      article.style.setProperty(
        '--price-x',
        pct(price[0] - (box.x0 - pad), box.x1 - box.x0 + pad * 2),
      );
      const affordable = game.coins[0] >= item.price;
      b.disabled = !affordable;
      b.querySelector('span').innerHTML =
        `${item.price} 金币<em> · ${affordable ? '买下' : '不够'}</em>`;
    }
  };
}
