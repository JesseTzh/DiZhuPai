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
const MUSIC_URLS = ['./assets/sound/theme-1.m4a', './assets/sound/theme-2.m4a'];
const MUSIC_LEVEL = 0.6;
export function createSounds() {
  const tracks = urls.map((url) => {
    const audio = new Audio(url);
    audio.preload = 'none';
    audio.volume = 0.35;
    return audio;
  });
  // 两首曲子按顺序轮播，末尾接回第一首即形成循环。
  const musicTracks = MUSIC_URLS.map((url) => {
    const track = new Audio(url);
    track.preload = 'none';
    track.volume = 0.35 * MUSIC_LEVEL;
    return track;
  });
  let musicIndex = 0,
    muted = false,
    musicMuted = false,
    dealing = false,
    musicWanted = false,
    waitingGesture = false;
  const currentMusic = () => musicTracks[musicIndex];
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
    currentMusic()
      .play()
      .catch(() => {
        if (musicWanted && !musicMuted && !document.hidden) retryMusicOnGesture();
      });
  };
  musicTracks.forEach((track, index) => {
    track.addEventListener('ended', () => {
      if (index !== musicIndex || !musicWanted || musicMuted || document.hidden) return;
      musicIndex = (musicIndex + 1) % musicTracks.length;
      currentMusic().preload = 'auto';
      currentMusic().currentTime = 0;
      attemptMusic();
    });
  });
  const startMusic = () => {
    musicWanted = true;
    currentMusic().preload = 'auto';
    attemptMusic();
  };
  // 暂停时保留播放位置，下次启动时继续。
  const stopMusic = () => {
    musicWanted = false;
    currentMusic().pause();
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
    musicTracks.forEach((audio) => audio.pause());
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
    musicTracks,
    get music() {
      return currentMusic();
    },
    setVolume(value) {
      const volume = Math.max(0, Math.min(1, value));
      tracks.forEach((track) => {
        track.volume = volume;
      });
      musicTracks.forEach((track) => {
        track.volume = volume * MUSIC_LEVEL;
      });
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
      if (musicMuted) currentMusic().pause();
      else attemptMusic();
    },
    get musicMuted() {
      return musicMuted;
    },
  };
}
