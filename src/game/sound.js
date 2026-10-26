// 音效索引与资源命名一一对应；构建时 __GAME_SOUNDS__ 会替换为内嵌的 data URL。
export const SOUND = Object.freeze({ deal: 0, knock: 1, shuffle: 2, hover: 3, win: 4 });
const urls =
  typeof __GAME_SOUNDS__ !== 'undefined'
    ? __GAME_SOUNDS__
    : [
        './assets/sound/deal.mp3',
        './assets/sound/knock.mp3',
        './assets/sound/shuffle.mp3',
        './assets/sound/hover.mp3',
        './assets/sound/win.mp3',
      ];
// 背景音乐以独立文件发布，不内嵌进 bundle，避免入口体积随音乐增长。
const MUSIC_URL = './assets/sound/theme.m4a';
const MUSIC_LEVEL = 0.6;
export function createSounds() {
  const tracks = urls.map((url) => {
    const audio = new Audio(url);
    audio.preload = 'none';
    audio.volume = 0.35;
    return audio;
  });
  const music = new Audio(MUSIC_URL);
  music.loop = true;
  music.preload = 'none';
  music.volume = 0.35 * MUSIC_LEVEL;
  let muted = false,
    musicMuted = false,
    dealing = false,
    musicWanted = false,
    waitingGesture = false;
  const play = (index) => {
    if (muted || document.hidden) return;
    tracks[index].currentTime = 0;
    tracks[index].play().catch(() => {});
  };
  const stop = (index) => {
    const track = tracks[index];
    if (!track) return;
    track.pause();
    track.currentTime = 0;
  };
  const hover = (index = SOUND.hover) => {
    if (muted || document.hidden) return;
    stop(index);
    tracks[index].play().catch(() => {});
  };
  const retryMusicOnGesture = () => {
    if (waitingGesture) return;
    waitingGesture = true;
    const retry = () => {
      removeEventListener('pointerdown', retry);
      removeEventListener('keydown', retry);
      waitingGesture = false;
      attemptMusic();
    };
    addEventListener('pointerdown', retry);
    addEventListener('keydown', retry);
  };
  // 浏览器会拦截无用户手势的自动播放；首次交互后再续上音乐。
  const attemptMusic = () => {
    if (!musicWanted || musicMuted || document.hidden) return;
    music.play().catch(() => {
      if (musicWanted && !musicMuted && !document.hidden) retryMusicOnGesture();
    });
  };
  const startMusic = () => {
    musicWanted = true;
    music.preload = 'auto';
    attemptMusic();
  };
  // 页面切走只暂停，回到对局时从原位置继续。
  const stopMusic = () => {
    musicWanted = false;
    music.pause();
  };
  if (tracks[SOUND.hover]) {
    tracks[SOUND.hover].preload = 'auto';
    tracks[SOUND.hover].load();
  }
  const stopDeal = () => {
    dealing = false;
    tracks[SOUND.deal].pause();
    tracks[SOUND.deal].currentTime = 0;
    tracks[SOUND.deal].loop = false;
  };
  const startDeal = () => {
    dealing = true;
    tracks[SOUND.deal].loop = true;
    play(SOUND.deal);
  };
  const suspend = () => {
    tracks.forEach((audio) => audio.pause());
    music.pause();
  };
  const resume = () => {
    if (dealing && !muted && !document.hidden) tracks[SOUND.deal].play().catch(() => {});
    attemptMusic();
  };
  const mute = (value) => {
    muted = value;
    if (muted) tracks.forEach((audio) => audio.pause());
    else if (dealing && !document.hidden) tracks[SOUND.deal].play().catch(() => {});
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? suspend() : resume()));
  addEventListener('pagehide', suspend);
  addEventListener('pageshow', resume);
  return {
    tracks,
    music,
    setVolume(value) {
      const volume = Math.max(0, Math.min(1, value));
      tracks.forEach((track) => {
        track.volume = volume;
      });
      music.volume = volume * MUSIC_LEVEL;
    },
    play,
    hover,
    stop,
    startDeal,
    stopDeal,
    startMusic,
    stopMusic,
    mute,
    get muted() {
      return muted;
    },
    muteMusic(value) {
      musicMuted = value;
      if (musicMuted) music.pause();
      else attemptMusic();
    },
    get musicMuted() {
      return musicMuted;
    },
  };
}
