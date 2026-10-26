import { INK } from '../engine/palette.js';

// SVG interaction shell above the Canvas scene: hit areas, labels and test hooks.
// Each builder returns markup for one part; `ring` is a projected path string.
export const deckMarkup = ({ player, deckCount }, thickness, ring) =>
  `<g class="card-deck" data-player="${player}" data-count="${deckCount}" data-thickness="${thickness}" role="img" aria-label="余牌 ${deckCount} 张"><path d="${ring}" fill="none" pointer-events="none"/></g>`;

export const wildMarkup = (id, { wild, revealing }, ring) =>
  `<g class="${wild ? 'wild-card-model' : 'wild-card-reveal'}" id="wild-card-${id}" data-card-model="frog-wild" data-wild-card="${id}" data-revealing="${!!revealing}" role="img" aria-label="青蛙赖子牌" pointer-events="none"><path d="${ring}" fill="none" pointer-events="none"/></g>`;

export const handCardMarkup = (id, { act, selected, name }, hover, ring) =>
  `<g data-act="${act}" data-card="${id}" data-hover="${hover.toFixed(3)}" class="hand-card${selected ? ' selected' : ''}" role="button" tabindex="0" aria-label="${name}" aria-pressed="${!!selected}"><path d="${ring}" fill="transparent" pointer-events="all"/></g>`;

export const bagMarkup = (player, palette, fill, hit) =>
  `<g class="money-bag" data-player="${player}" data-palette="${palette}" data-fill="${fill.toFixed(4)}"${player === 0 ? ' data-act="poke-bag" role="button" tabindex="0" aria-label="点击钱袋吐金币"' : ''}>${player === 0 ? `<path d="${hit}" fill="transparent" pointer-events="all"/>` : ''}</g>`;

export const itemMarkup = (item, hit) =>
  `<g class="table-item" id="table-item-${item.id}" data-item="${item.id}" role="img" tabindex="0" aria-label="${item.name}：${item.effect}" aria-describedby="item-tooltip"><path d="${hit}" fill="transparent" pointer-events="all"/></g>`;

export const labelMarkup = ({ text, cls }, [x, y]) =>
  `<text class="${cls}" x="${x}" y="${y}" text-anchor="middle" fill="${INK}" font-size="12" font-weight="600">${text}</text>`;
