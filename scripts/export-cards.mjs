import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import { cardDeck, cardFrontPrints, cardBackPrint, cardSvg } from '../src/assets/cards/index.js';
import { cardWildPrint } from '../src/assets/cards/wild.js';
import { cardCream, cardGold } from '../src/assets/cards/palette.js';
import { suits } from '../src/assets/cards/suits.js';
import { PALS } from '../src/engine/palette.js';

const output = fileURLToPath(new URL('../src/assets/cards/', import.meta.url));
const svgDir = path.join(output, 'svg');
await mkdir(svgDir, { recursive: true });
const assets = cardDeck.map((card) => ({ ...card, print: cardFrontPrints[card.id] }));
const backNames = {
  mustard: '芥末黄',
  tomato: '番茄红',
  mint: '薄荷绿',
  cobalt: '钴蓝',
  blush: '玫瑰粉',
};
for (const [key, material] of Object.entries(PALS)) {
  assets.push({
    key: `back-${key}`,
    name: `牌背 · ${backNames[key]}`,
    kind: 'back',
    print: cardBackPrint(material, key),
  });
}
for (const asset of assets) {
  await writeFile(
    path.join(svgDir, `${asset.key}.svg`),
    cardSvg(asset.print, asset.name, asset.key) + '\n',
  );
}
const tiles = (cards) =>
  cards
    .map(
      ({ key, name }) =>
        `<a href="svg/${key}.svg" target="_blank"><img src="svg/${key}.svg" alt="${name}" width="126" height="176"><span>${name}</span></a>`,
    )
    .join('\n');
const sections = suits
  .map(
    (suit) =>
      `<section><h2>${suit.name} · A–K</h2><div class="cards">${tiles(assets.filter((card) => card.suit === suit.id))}</div></section>`,
  )
  .join('\n');
const preview = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>整副纸牌 · 美术总览</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:36px clamp(16px,4vw,64px);background:#f2efe7;color:#292a28;font-family:ui-monospace,'PingFang SC',sans-serif}header{border-bottom:1px solid #c9bea8;padding-bottom:20px}h1{font-size:24px;margin:0 0 12px}p{font-size:13px;color:#766e60;line-height:1.8}h2{font-size:16px;font-weight:500;margin:30px 0 18px}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:22px 14px}a{display:flex;align-items:center;flex-direction:column;gap:10px;text-decoration:none;color:inherit;font-size:12px}img{width:100%;max-width:126px;height:auto;filter:drop-shadow(3px 4px 0 #41538f22);transition:transform .15s}a:hover img,a:focus-visible img{transform:translateY(-4px)}a:focus-visible{outline:2px solid #6487bd;outline-offset:6px}span{line-height:1.5}@media(prefers-reduced-motion:reduce){img{transition:none}}
</style></head><body><header><h1>整副纸牌 · 美术总览</h1><p>52 张标准牌 · 大小王 · 5 款牌背<br>暖纸色、墨线与复古平涂。点击任意扑克牌查看独立 SVG。</p></header>
${sections}
<section><h2>王牌 · 大小王</h2><div class="cards">${tiles(assets.filter((card) => card.kind === 'joker'))}</div></section>
<section><h2>斑驳金币牌背 · 五款配色</h2><div class="cards">${tiles(assets.filter((card) => card.kind === 'back'))}</div></section>
</body></html>\n`;
await writeFile(
  path.join(output, 'preview.html'),
  await format(preview, { ...(await resolveConfig(output)), parser: 'html' }),
);
// 扑克牌 favicon：芥末金牌背 + 赖子青蛙牌。牌面整体复用 cardWildPrint，
// 仅把墨线加粗一档再缩放进 64×64 图标画布，保证缩小后仍是手绘墨线风格。
const faviconWild = cardWildPrint().replace(
  /stroke-width="([\d.]+)"/g,
  (_, w) => `stroke-width="${(+w * 2).toFixed(2)}"`,
);
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="#41538f" fill-opacity=".13">
    <rect x="13.5" y="11" width="33" height="45" rx="4.5" transform="rotate(-14 27.5 30.5)"/>
    <rect x="22.5" y="14" width="33" height="45" rx="4.5" transform="rotate(11 36.5 33.5)"/>
  </g>
  <g stroke="#292a28" stroke-linejoin="round" stroke-linecap="round">
    <g transform="rotate(-14 27.5 30.5)">
      <rect x="11" y="8" width="33" height="45" rx="4.5" fill="${cardCream}" stroke-width="2.6"/>
      <rect x="14.75" y="11.75" width="25.5" height="37.5" rx="2.6" fill="${cardGold}" stroke-width="1.9"/>
      <path d="M27.5 18.5 L34.5 30.5 L27.5 42.5 L20.5 30.5 Z" fill="none" stroke="${cardCream}" stroke-width="2.4"/>
    </g>
    <g transform="rotate(11 36.5 33.5)">
      <rect x="20" y="11" width="33" height="45" rx="4.5" fill="${cardCream}" stroke-width="2.6"/>
      <g transform="translate(20.4 11) scale(0.5114)">${faviconWild}</g>
    </g>
  </g>
</svg>
`;
await writeFile(fileURLToPath(new URL('../src/assets/favicon.svg', import.meta.url)), favicon);
console.log(
  `Exported ${cardDeck.length} faces, ${Object.keys(PALS).length} backs, preview.html and favicon.svg`,
);
