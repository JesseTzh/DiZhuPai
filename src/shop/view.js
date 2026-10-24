import { ITEMS } from '../game/items.js';
import { mountShopScene, BUY_TIME } from './scene.js';

export function mountShop(stage, buy, next) {
  const shop = document.createElement('section');
  shop.id = 'shop';
  shop.hidden = true;
  shop.setAttribute('aria-label', '关间道具商店');
  shop.innerHTML = `<div class="shop-box"><header class="shop-heading"><div><span class="eyebrow">关间补给 · 掌柜今日精选</span><h1>好运玩具铺</h1><p id="shop-result"></p></div><div class="shop-wallet"><span>你的金币</span><strong id="shop-balance"></strong></div></header><div class="shop-stage"><svg id="shop-art" role="img" aria-label="好运玩具铺：大鹅掌柜站在当铺式柜台后，柜台上摆着算盘和三件玩具"></svg><div class="goose-bubble" aria-hidden="true">嘎嘎～承惠承惠！</div>${ITEMS.map((item) => `<article class="shop-product toy-${item.id}" data-item="${item.id}" style="--toy-color:${item.color}"><div class="toy-hit" tabindex="0" role="img" aria-label="${item.toy}：${item.name}，${item.description}"></div><div class="toy-tooltip" role="tooltip"><strong>${item.toy} · ${item.name}</strong><span>${item.description}</span><small>${item.effect} · 本场持续生效</small></div><button class="price-tag" data-buy="${item.id}" aria-label="购买${item.name}，${item.price}金币"><b>${item.name}<i class="owned-mark" hidden>已购</i></b><span></span></button></article>`).join('')}</div><footer class="shop-footer"><span>悬停玩具看效果 · 买下后下一小局生效</span><button id="leave-shop">继续下一小关 ↗</button></footer><p id="shop-notice" role="status" aria-live="polite"></p></div>`;
  stage.append(shop);
  const svg = shop.querySelector('#shop-art'),
    scene = mountShopScene(svg),
    bubble = shop.querySelector('.goose-bubble');
  shop
    .querySelector('.shop-box')
    .style.setProperty('--ratio', (scene.width / scene.height).toFixed(4));
  const pct = (v, total) => `${((v / total) * 100).toFixed(2)}%`;
  for (const item of ITEMS) {
    const article = shop.querySelector(`[data-item="${item.id}"]`),
      b = scene.toyBox(item.id),
      price = scene.priceAt(item.id),
      pad = 6;
    // the hover area covers the toy at its biggest pose and runs down to its price card on the counter front
    Object.assign(article.style, {
      left: pct(b.x0 - pad, scene.width),
      top: pct(b.y0 - pad, scene.height),
      width: pct(b.x1 - b.x0 + pad * 2, scene.width),
      height: pct(price[1] - b.y0 + pad, scene.height),
    });
    article.style.setProperty('--price-x', pct(price[0] - (b.x0 - pad), b.x1 - b.x0 + pad * 2));
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
    const key = JSON.stringify([game.coins[0], game.items, game.round]);
    if (last === key) return;
    last = key;
    shop.querySelector('#shop-balance').textContent = game.coins[0];
    shop.querySelector('#shop-result').textContent =
      `第 ${game.stage}-${game.substage} 小关${game.winner === 0 ? '获胜' : '结束'} · 胜场 ${game.wins[0]} : ${game.wins[1]}`;
    shop.querySelector('#leave-shop').textContent =
      game.substage === 3 ? `进入第 ${game.stage + 1} 大关 ↗` : '继续下一小关 ↗';
    for (const item of ITEMS) {
      const article = shop.querySelector(`[data-item="${item.id}"]`),
        b = article.querySelector('button');
      const owned = game.items.includes(item.id),
        affordable = game.coins[0] >= item.price;
      article.classList.toggle('is-owned', owned);
      article.querySelector('.owned-mark').hidden = !owned;
      b.disabled = owned || !affordable;
      b.querySelector('span').innerHTML = owned
        ? '已装入道具箱'
        : `${item.price} 金币<em> · ${affordable ? '买下' : '不够'}</em>`;
    }
  };
}
