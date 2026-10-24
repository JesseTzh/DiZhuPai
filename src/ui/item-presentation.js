// One description model for the shop, tabletop and compact inventory.
export function itemDetails(item) {
  return {
    title: `${item.toy} · ${item.name}`,
    description: item.description,
    footer: `${item.effect} · 本场持续生效`,
    accessible: `${item.toy}：${item.name}，${item.description}`,
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
