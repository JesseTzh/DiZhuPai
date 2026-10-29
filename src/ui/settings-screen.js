import {
  renderDprSetting,
  setRenderDprSetting,
  RENDER_DPR_OPTIONS,
} from '../engine/render-pixel-ratio.js';
import { mountBuildVersion } from './build-version.js';

const ink = '#292a28';
const speaker = `<path d="M8 17H15L24 10V34L15 27H8Z" fill="#f4b829" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><g class="sound-waves" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"><path d="M30 16Q36 22 30 28M35 11Q46 22 35 33"/></g><path class="toggle-cross" d="M30 17L40 27M40 17L30 27" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
const musicNote = `<g class="music-note"><path d="M27 14V31M39 11V28M27 14L39 11L39 16L27 19Z" fill="#f4b829" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><ellipse cx="22" cy="32" rx="6" ry="4.5" fill="#f4b829" stroke="${ink}" stroke-width="2"/><ellipse cx="34" cy="29" rx="6" ry="4.5" fill="#f4b829" stroke="${ink}" stroke-width="2"/></g><path class="toggle-cross" d="M25 17L36 28M36 17L25 28" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
const toggle = (id, labelId, icon) =>
  `<button id="${id}" class="settings-toggle" type="button" role="switch" aria-checked="true" aria-labelledby="${labelId}"><svg viewBox="0 0 136 52" aria-hidden="true"><path d="M5 9L126 6 130 45 9 48Z" fill="#6487bd"/><path class="toggle-paper" d="M3 4L124 3 126 41 6 43Z" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>${icon}<text class="toggle-value" x="78" y="28" text-anchor="middle">开启</text><circle class="toggle-indicator" cx="110" cy="22" r="4" fill="${ink}"/></svg></button>`;
const scaleButton = (value) =>
  `<button type="button" role="radio" aria-checked="false" data-scale="${value}" aria-label="${value === 'auto' ? '自动，最高 2 倍' : `${value} 倍`}"><svg viewBox="0 0 72 54" aria-hidden="true"><path class="scale-shadow" d="M7 8L65 6 68 45 10 48Z"/><path class="scale-paper" d="M4 4L63 3 65 42 6 44Z"/><text x="35" y="28" text-anchor="middle">${value === 'auto' ? '自动' : `${value}×`}</text><path class="scale-check" d="M48 35L52 38 59 31"/></svg></button>`;

export function mountSettings({ state, ui, audio }) {
  const settings = document.createElement('dialog');
  settings.id = 'settings-screen';
  settings.setAttribute('aria-labelledby', 'settings-title');
  settings.innerHTML = `<div class="settings-content">
    <svg class="settings-paper" viewBox="0 0 440 368" preserveAspectRatio="none" aria-hidden="true"><path d="M12 12L428 9 432 353 18 360 7 348Z" fill="#6487bd"/><path d="M5 4L421 3 425 343 12 349 3 336Z" fill="#fff8e7" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><path d="M15 339L414 334M414 14L417 324" fill="none" stroke="#d5c7a9" stroke-width="1.3"/><path d="M26 86Q203 83 399 87" fill="none" stroke="#b4a381" stroke-width="1.2"/></svg>
    <div class="settings-heading"><h1 id="settings-title"><span class="sr-only">设置</span><svg viewBox="0 0 170 52" aria-hidden="true"><path d="M3 43L111 43" stroke="#f4b829" stroke-width="9"/><text x="3" y="34">设置</text><path d="M125 19L131 23 137 19 135 27 141 32 133 33 129 40 126 33 118 30 125 26Z" fill="#93d3b0" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/></svg></h1>
    <button id="close-settings" aria-label="关闭设置"><svg viewBox="0 0 44 44" aria-hidden="true"><path d="M6 8L35 5 39 35 9 39Z" fill="#6487bd"/><path d="M4 4L33 3 36 32 6 35Z" fill="#fff8e7" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><path d="M13 12L26 25M26 12L13 25" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/></svg></button></div>
    <div class="settings-sound-row"><span id="sound-label">音效</span>${toggle('sound-enabled', 'sound-label', speaker)}</div>
    <div class="settings-sound-row"><span id="music-label">音乐</span>${toggle('music-enabled', 'music-label', musicNote)}</div>
    <div class="settings-sound-row settings-seed-row"><span id="seed-title">本局种子</span><span id="seed-value"></span></div>
    <div id="render-scale" role="radiogroup" aria-labelledby="scale-label"><span id="scale-label">渲染倍率</span><div class="scale-options">${RENDER_DPR_OPTIONS.map(scaleButton).join('')}</div></div>
    <div class="settings-actions"><button id="restart-game" type="button"><svg viewBox="0 0 180 54" aria-hidden="true"><path d="M8 9L170 6 174 46 11 49Z" fill="#6487bd"/><path d="M4 4L167 3 170 41 7 44Z" fill="#93d3b0" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><path d="M36 18A10 10 0 1 0 38 29M36 12V20H28" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="104" y="29" text-anchor="middle">重新开始</text></svg><span class="sr-only">重新开始</span></button>
    <button id="return-home" type="button"><svg viewBox="0 0 180 54" aria-hidden="true"><path d="M8 9L170 6 174 46 11 49Z" fill="#6487bd"/><path d="M4 4L167 3 170 41 7 44Z" fill="#f4b829" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><path d="M29 16L21 24 29 32M22 24H42" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="104" y="29" text-anchor="middle">返回主界面</text></svg><span class="sr-only">返回主界面</span></button></div>
  </div>`;
  document.body.append(settings);
  mountBuildVersion(settings.querySelector('.settings-content'));
  const sound = settings.querySelector('#sound-enabled');
  const music = settings.querySelector('#music-enabled');
  const syncToggle = (button, on) => {
    button.setAttribute('aria-checked', String(on));
    button.querySelector('.toggle-value').textContent = on ? '开启' : '关闭';
  };
  let enabled = localStorage.getItem('sound-enabled') !== 'off';
  let musicEnabled = localStorage.getItem('music-enabled') !== 'off';
  const syncSound = () => {
    audio.mute(!enabled);
    syncToggle(sound, enabled);
  };
  const syncMusic = () => {
    audio.muteMusic(!musicEnabled);
    syncToggle(music, musicEnabled);
  };
  syncSound();
  syncMusic();
  const savedVolume = Number(localStorage.getItem('sound-volume') ?? 35);
  audio.setVolume(Number.isFinite(savedVolume) ? savedVolume / 100 : 0.35);
  sound.onclick = () => {
    enabled = !enabled;
    syncSound();
    localStorage.setItem('sound-enabled', enabled ? 'on' : 'off');
  };
  music.onclick = () => {
    musicEnabled = !musicEnabled;
    syncMusic();
    localStorage.setItem('music-enabled', musicEnabled ? 'on' : 'off');
  };
  const choices = [...settings.querySelectorAll('[data-scale]')];
  const refresh = () => {
    const value = renderDprSetting();
    choices.forEach((button) => {
      const selected = button.dataset.scale === value;
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    settings.querySelector('#seed-value').textContent = state.game.seed ?? '未指定（真随机）';
  };
  const choose = (button) => {
    setRenderDprSetting(button.dataset.scale);
    refresh();
    ui.render();
  };
  choices.forEach((button, index) => {
    button.onclick = () => choose(button);
    button.onkeydown = (event) => {
      let next;
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % choices.length;
      if (['ArrowLeft', 'ArrowUp'].includes(event.key))
        next = (index + choices.length - 1) % choices.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = choices.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      choices[next].focus();
      choose(choices[next]);
    };
  });
  settings.querySelector('#close-settings').onclick = () => settings.close();
  settings.addEventListener('click', (event) => {
    if (event.target !== settings) return;
    const rect = settings.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      settings.close();
  });
  refresh();
  return { element: settings, refresh, syncTableChoices() {} };
}
