import { MAX_SAVE_SIZE, parseSave } from '../game/save.js';

export function mountSaveScreen({ session, exportSlot, onNew, onRestore }) {
  const element = document.createElement('main');
  element.id = 'saves-screen';
  element.hidden = true;
  element.innerHTML = `<div class="saves-content"><button id="close-saves" class="back-button">← 返回</button><h1>游戏存档</h1><div id="save-slots" class="save-slots"></div><p id="save-status" role="status" aria-live="polite"></p><div id="import-confirm" hidden><p>已有游戏进度，是否用导入的存档替换？</p><button id="confirm-import">确认替换</button><button id="cancel-import">取消</button></div><input id="save-file" type="file" accept=".json,application/json" hidden></div>`;
  document.body.append(element);
  const status = element.querySelector('#save-status');
  const confirmation = element.querySelector('#import-confirm');
  const fileInput = element.querySelector('#save-file');
  let slots,
    importSlot = null,
    pendingImport = null,
    pendingDelete = null;

  function render() {
    slots = session.readSlots();
    element.querySelector('#save-slots').innerHTML = slots
      .map(({ save, error }, index) => {
        const g = save?.game;
        return `<section class="save-slot" data-slot="${index}"><h2>${save ? `第 ${g.stage} 大关 · 第 ${g.substage} 小关` : error ? '存档待修复' : '暂无存档'}</h2><p>${save ? `金币 ${g.coins[0]} · 胜场 ${g.wins[0]} : ${g.wins[1]}` : '开始一场新游戏'}</p><time>${save ? new Date(save.savedAt).toLocaleString() : '尚未开始'}</time><div class="slot-actions"><button class="figure-button figure-primary" data-slot-action="${save ? 'resume' : 'new'}">${save ? '继续游戏' : '新建游戏'}</button><button data-slot-action="import">导入存档</button><button data-slot-action="export" ${save ? '' : 'disabled'}>导出存档</button>${save ? `<button data-slot-action="delete">${pendingDelete === index ? '确认删除' : '删除存档'}</button>` : ''}</div></section>`;
      })
      .join('');
    syncStatus();
  }
  function syncStatus() {
    status.textContent = slots?.map((slot) => slot.error).find(Boolean) || session.status;
  }
  function download(text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `dizhupai-save-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function commitImport() {
    if (!pendingImport) return;
    const { index, save } = pendingImport;
    try {
      session.import(index, save);
      pendingImport = null;
      confirmation.hidden = true;
      onRestore(save);
    } catch {
      status.textContent = '导入失败：本地存储不可用，原有进度已保留';
    }
  }
  element.querySelector('#save-slots').onclick = (event) => {
    const button = event.target.closest('[data-slot-action]');
    if (!button) return;
    const index = +button.closest('[data-slot]').dataset.slot;
    const action = button.dataset.slotAction;
    if (action !== 'delete') pendingDelete = null;
    if (action === 'import') {
      importSlot = index;
      fileInput.click();
    } else if (action === 'export') download(exportSlot(index));
    else if (action === 'delete') {
      if (pendingDelete === index) {
        session.delete(index);
        pendingDelete = null;
      } else pendingDelete = index;
      render();
    } else {
      session.select(index);
      if (action === 'resume') onRestore(slots[index].save);
      else onNew();
    }
  };
  element.querySelector('#confirm-import').onclick = commitImport;
  element.querySelector('#cancel-import').onclick = () => {
    pendingImport = null;
    confirmation.hidden = true;
  };
  fileInput.onchange = async (event) => {
    const file = event.target.files[0];
    const index = importSlot;
    event.target.value = '';
    if (!file || index === null) return;
    try {
      if (file.size > MAX_SAVE_SIZE) throw new Error('存档文件过大（最多 256 KB）');
      const save = parseSave(await file.text());
      pendingImport = { index, save };
      if (slots[index].save) {
        confirmation.hidden = false;
        element.querySelector('#confirm-import').focus();
      } else commitImport();
    } catch (error) {
      status.textContent = `导入失败：${error.message}，当前进度已保留`;
    }
  };
  return {
    element,
    syncStatus,
    open() {
      pendingImport = null;
      pendingDelete = null;
      importSlot = null;
      confirmation.hidden = true;
      render();
    },
  };
}
