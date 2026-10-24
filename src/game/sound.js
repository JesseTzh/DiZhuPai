const urls =
  typeof __GAME_SOUNDS__ !== 'undefined'
    ? __GAME_SOUNDS__
    : [
        './assets/sound/发牌.mp3',
        './assets/sound/敲桌子.mp3',
        './assets/sound/洗牌.mp3',
        './assets/sound/menu.mp3',
      ];
export function createSounds() {
  const tracks = urls.map((url) => {
    const audio = new Audio(url);
    audio.preload = 'none';
    audio.volume = 0.35;
    return audio;
  });
  let muted = false,
    dealing = false;
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
  const hover = (index = 3) => {
    if (muted || document.hidden) return;
    stop(index);
    tracks[index].play().catch(() => {});
  };
  if (tracks[3]) {
    tracks[3].preload = 'auto';
    tracks[3].load();
  }
  const stopDeal = () => {
    dealing = false;
    tracks[0].pause();
    tracks[0].currentTime = 0;
    tracks[0].loop = false;
  };
  const startDeal = () => {
    dealing = true;
    tracks[0].loop = true;
    play(0);
  };
  const suspend = () => tracks.forEach((audio) => audio.pause());
  const resume = () => {
    if (dealing && !muted && !document.hidden) tracks[0].play().catch(() => {});
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? suspend() : resume()));
  addEventListener('pagehide', suspend);
  addEventListener('pageshow', resume);
  return {
    tracks,
    setVolume(value) {
      const volume = Math.max(0, Math.min(1, value));
      tracks.forEach((track) => {
        track.volume = volume;
      });
    },
    play,
    hover,
    stop,
    startDeal,
    stopDeal,
    mute(value) {
      muted = value;
      if (muted) suspend();
      else resume();
    },
    get muted() {
      return muted;
    },
  };
}
