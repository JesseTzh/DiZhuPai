import { INK } from '../engine/palette.js';
import { TOYS } from '../assets/items/index.js';

// One description model for the shop, tabletop and compact inventory.
export function itemDetails(item) {
  return {
    title: item.name,
    description: item.description,
    footer: `${item.effect} · 本场持续生效`,
    accessible: `${item.name}，${item.description}`,
  };
}

const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

export function itemTooltipMarkup(item) {
  const { title, description, footer } = itemDetails(item);
  return `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(description)}</span><small>${escapeHTML(footer)}</small>`;
}

// The same 48×48 paths and shadow base drawIcon paints on canvas (topbar-art.js), as inline SVG.
export function itemIconMarkup(id) {
  const icon = TOYS[id]?.icon || [
    ['M12 12H36V36H12Z', '#fff4d6'],
    ['M18 24H30M24 18V30', null],
  ];
  const inked = ([d, fill]) =>
    `<path d="${d}" fill="${fill || 'none'}" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 39 30 44 44 36 21 32Z" fill="#829ac7"/>${icon.map(inked).join('')}</svg>`;
}

export function wrapItemText(ctx, text, width) {
  const rows = [];
  let row = '';
  for (const char of text) {
    if (row && ctx.measureText(row + char).width > width) {
      rows.push(row);
      row = '';
    }
    row += char;
  }
  if (row) rows.push(row);
  return rows;
}
