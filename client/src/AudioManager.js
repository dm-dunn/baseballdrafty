/**
 * AudioManager.js
 * MP3-based audio for Baseball Drafty.
 * Drop your sound files into client/public/sounds/ and they'll be served at /sounds/*.mp3
 *
 * Expected files:
 *   /sounds/game-start.mp3   — horn blast + "play ball" call
 *   /sounds/bg-music.mp3     — looping boardwalk/ragtime music
 *   /sounds/positive.mp3     — crack of bat + crowd cheering
 *   /sounds/negative.mp3     — crowd boos + womp womp organ
 */

class AudioManager {
  constructor() {
    this._sounds = {};      // { key: HTMLAudioElement }
    this._bgMusic = null;   // reference to the looping bg track
    this._load();
  }

  // ── Pre-load all audio elements ─────────────────────────────────────────────
  _load() {
    const files = {
      'game-start': '/sounds/game-start.mp3',
      'bg-music':   '/sounds/bg-music.mp3',
      'positive':   '/sounds/positive.mp3',
      'negative':   '/sounds/negative.mp3',
    };

    for (const [key, src] of Object.entries(files)) {
      const audio = new Audio(src);
      audio.preload = 'auto';
      if (key === 'bg-music') {
        audio.loop = true;
        audio.volume = 0.35;
        this._bgMusic = audio;
      } else {
        audio.volume = 0.8;
      }
      this._sounds[key] = audio;
    }
  }

  // ── Helper: play a one-shot sound (clones so rapid re-triggers work) ────────
  _play(key) {
    const src = this._sounds[key];
    if (!src) return;
    // Clone so overlapping plays don't interrupt each other
    const clone = src.cloneNode();
    clone.volume = src.volume;
    clone.play().catch(() => {
      // Autoplay blocked — silently ignore (user gesture unlocks it on next event)
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Horn blast + "play ball" sound at game start */
  playGameStart() {
    this._play('game-start');
  }

  /** Start looping boardwalk/ragtime background music */
  playBackgroundMusic() {
    if (!this._bgMusic) return;
    this._bgMusic.currentTime = 0;
    this._bgMusic.play().catch(() => {});
  }

  /** Stop background music with a short fade-out */
  stopBackgroundMusic() {
    if (!this._bgMusic) return;
    const music = this._bgMusic;
    const step = 0.05;
    const interval = setInterval(() => {
      if (music.volume > step) {
        music.volume = Math.max(0, music.volume - step);
      } else {
        music.volume = 0;
        music.pause();
        music.currentTime = 0;
        clearInterval(interval);
      }
    }, 80);
  }

  /** Crack of bat + crowd cheering (positive/boost events) */
  playPositiveEvent() {
    this._play('positive');
  }

  /** Crowd boos + womp womp organ (negative/stun/reverse events) */
  playNegativeEvent() {
    this._play('negative');
  }

  /** Clean up — pause everything */
  dispose() {
    for (const audio of Object.values(this._sounds)) {
      audio.pause();
      audio.src = '';
    }
    this._sounds = {};
    this._bgMusic = null;
  }
}

export default AudioManager;
