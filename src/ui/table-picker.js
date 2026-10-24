import { TABLES } from '../game/table.js';
export function tableChoices(className = '') {
  return `<div class="table-choices ${className}" role="group" aria-label="牌桌材质">${TABLES.map((table, i) => `<button type="button" data-table="${table.id}" aria-pressed="${i === 0}" style="--table-color:${table.color}"><span class="table-sample ${table.id}"><i></i></span><span>${table.name}</span></button>`).join('')}</div>`;
}
export function bindTableChoices(root, state, render) {
  const sync = () =>
    document
      .querySelectorAll('[data-table]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', button.dataset.table === state.tableStyle),
      );
  root.querySelectorAll('[data-table]').forEach(
    (button) =>
      (button.onclick = () => {
        state.tableStyle = button.dataset.table;
        sync();
        render();
      }),
  );
  sync();
  return sync;
}
