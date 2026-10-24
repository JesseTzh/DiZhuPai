import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import { cardDeck, cardFrontPrints, cardBackPrint, cardSvg } from '../src/assets/cards/index.js';
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
console.log(
  `Exported ${cardDeck.length} faces, ${Object.keys(PALS).length} backs and preview.html`,
);
