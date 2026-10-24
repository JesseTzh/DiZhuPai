import { loadSaveSlots, serializeSave, SLOT_KEYS } from '../game/save.js';

// Browser persistence for the single save. Save parsing stays in game/save.js.
export function createSaveSession(storage) {
  let slots = loadSaveSlots(storage);
  const initialSave = slots[0].save;
  let activeSlot = initialSave ? 0 : null;
  let fingerprint = '';
  let status = slots.map((slot) => slot.error).find(Boolean) || '开始游戏后自动保存到此浏览器';

  function select(index) {
    if (index !== 0) throw new Error('仅支持一个存档');
    activeSlot = index;
    fingerprint = '';
  }
  return {
    initialSave,
    get activeSlot() {
      return activeSlot;
    },
    get status() {
      return status;
    },
    readSlots() {
      slots = loadSaveSlots(storage);
      return slots;
    },
    select,
    save(game, options) {
      if (activeSlot === null || !game.round) return;
      const next = JSON.stringify([game, options]);
      if (next === fingerprint) return;
      try {
        storage.setItem(SLOT_KEYS[activeSlot], serializeSave(game, options));
        fingerprint = next;
        status = `已自动保存 · ${new Date().toLocaleString()}`;
      } catch {
        status = '本地保存失败，请导出存档备份（浏览器存储不可用或空间不足）';
      }
    },
    export(index, game, options) {
      return activeSlot === index && game.round
        ? serializeSave(game, options)
        : storage.getItem(SLOT_KEYS[index]);
    },
    import(index, save) {
      if (index !== 0) throw new Error('仅支持一个存档');
      storage.setItem(SLOT_KEYS[index], JSON.stringify(save));
      select(index);
    },
    delete(index) {
      if (index !== 0) throw new Error('仅支持一个存档');
      storage.setItem('dizhupai-single-save-migrated', '1');
      storage.removeItem(SLOT_KEYS[index]);
      if (activeSlot === index) activeSlot = null;
      status = '存档已删除';
    },
  };
}
