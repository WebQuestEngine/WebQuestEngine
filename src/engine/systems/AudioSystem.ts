import { AssetManager } from '../core/AssetManager';
import { EventBus } from '../core/EventBus';
import { AudioConfig } from '../types';

export class AudioSystem {
  private static instance: AudioSystem;

  private currentMusicAudio: HTMLAudioElement | null = null;
  private currentMusicUrl: string | null = null;
  private musicFadeInterval: number | null = null;

  private currentVoiceAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;

  private config: AudioConfig = {
    masterVolume: 1.0,
    musicVolume: 0.8,
    sfxVolume: 1.0,
    voiceVolume: 1.0
  };

  private constructor() {
    EventBus.getInstance().on('audio:play_sfx', (payload: { url?: string; type?: 'click' | 'item' | 'door' | 'pickup' }) => {
      this.playSFX(payload.url, payload.type);
    });

    const unlock = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (this.currentMusicAudio && this.currentMusicAudio.paused && this.currentMusicUrl) {
        const targetVol = this.config.masterVolume * this.config.musicVolume;
        this.currentMusicAudio.play().then(() => {
          if (this.currentMusicAudio) this.currentMusicAudio.volume = targetVol;
        }).catch(() => {});
      }
    };
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
  }

  public static getInstance(): AudioSystem {
    if (!AudioSystem.instance) {
      AudioSystem.instance = new AudioSystem();
    }
    return AudioSystem.instance;
  }

  public setConfig(config?: Partial<AudioConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
      this.updateMusicVolume();
    }
  }

  public getConfig(): AudioConfig {
    return { ...this.config };
  }

  public setMasterVolume(vol: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, vol));
    this.updateMusicVolume();
  }

  public setMusicVolume(vol: number): void {
    this.config.musicVolume = Math.max(0, Math.min(1, vol));
    this.updateMusicVolume();
  }

  public setSFXVolume(vol: number): void {
    this.config.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  public setVoiceVolume(vol: number): void {
    this.config.voiceVolume = Math.max(0, Math.min(1, vol));
    if (this.currentVoiceAudio) {
      this.currentVoiceAudio.volume = this.config.masterVolume * this.config.voiceVolume;
    }
  }

  private updateMusicVolume(): void {
    if (this.currentMusicAudio && !this.musicFadeInterval) {
      this.currentMusicAudio.volume = this.config.masterVolume * this.config.musicVolume;
    }
  }

  // --- Background Music per Scene (with smooth fading) ---
  public playMusic(rawUrl: string | null | undefined, fadeDurationMs = 1000): void {
    if (!rawUrl) {
      this.stopMusic(fadeDurationMs);
      return;
    }

    const resolved = AssetManager.getInstance().resolveImageSrc(rawUrl);
    if (this.currentMusicUrl === resolved && this.currentMusicAudio && !this.currentMusicAudio.paused) {
      return; // Already playing this track
    }

    this.stopMusic(fadeDurationMs / 2, () => {
      try {
        const audio = new Audio(resolved);
        audio.loop = true;
        audio.volume = 0;
        this.currentMusicAudio = audio;
        this.currentMusicUrl = resolved;

        const targetVol = this.config.masterVolume * this.config.musicVolume;
        audio.play().then(() => {
          this.fadeIn(audio, targetVol, fadeDurationMs);
        }).catch(err => {
          console.warn('[AudioSystem] Music autoplay blocked or failed:', err);
        });
      } catch (err) {
        console.error('[AudioSystem] Failed to play music track:', err);
      }
    });
  }

  public stopMusic(fadeDurationMs = 1000, onComplete?: () => void): void {
    if (!this.currentMusicAudio) {
      if (onComplete) onComplete();
      return;
    }

    const audioToStop = this.currentMusicAudio;
    this.currentMusicAudio = null;
    this.currentMusicUrl = null;

    this.fadeOut(audioToStop, fadeDurationMs, () => {
      audioToStop.pause();
      audioToStop.removeAttribute('src');
      if (onComplete) onComplete();
    });
  }

  private fadeIn(audio: HTMLAudioElement, targetVol: number, durationMs: number): void {
    if (durationMs <= 0) {
      audio.volume = targetVol;
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      audio.volume = targetVol * progress;
      if (progress >= 1) {
        clearInterval(interval);
      }
    }, 50);
  }

  private fadeOut(audio: HTMLAudioElement, durationMs: number, onComplete?: () => void): void {
    if (durationMs <= 0) {
      audio.volume = 0;
      if (onComplete) onComplete();
      return;
    }

    const initialVol = audio.volume;
    const startTime = Date.now();
    if (this.musicFadeInterval) clearInterval(this.musicFadeInterval);

    this.musicFadeInterval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      audio.volume = initialVol * (1 - progress);
      if (progress >= 1) {
        if (this.musicFadeInterval) clearInterval(this.musicFadeInterval);
        this.musicFadeInterval = null;
        if (onComplete) onComplete();
      }
    }, 50);
  }

  // --- Recorded Dialogues / Voiceover ---
  public playVoice(rawUrl: string, onEnded?: () => void): void {
    this.stopVoice();
    if (!rawUrl) return;

    try {
      const resolved = AssetManager.getInstance().resolveImageSrc(rawUrl);
      const audio = new Audio(resolved);
      audio.volume = this.config.masterVolume * this.config.voiceVolume;
      this.currentVoiceAudio = audio;

      if (onEnded) {
        audio.onended = () => {
          this.currentVoiceAudio = null;
          onEnded();
        };
      }

      audio.play().catch(err => {
        console.warn('[AudioSystem] Voice audio play blocked or failed:', err);
      });
    } catch (err) {
      console.error('[AudioSystem] Failed to play voice audio:', err);
    }
  }

  public stopVoice(): void {
    if (this.currentVoiceAudio) {
      this.currentVoiceAudio.pause();
      this.currentVoiceAudio.removeAttribute('src');
      this.currentVoiceAudio = null;
    }
  }

  // --- Sound Effects (Custom Files + Procedural Web Audio API) ---
  public playSFX(rawUrl?: string | null, synthType: 'click' | 'item' | 'door' | 'pickup' = 'click'): void {
    const vol = this.config.masterVolume * this.config.sfxVolume;
    if (vol <= 0) return;

    if (rawUrl) {
      try {
        const resolved = AssetManager.getInstance().resolveImageSrc(rawUrl);
        const sfxAudio = new Audio(resolved);
        sfxAudio.volume = vol;
        sfxAudio.play().catch(() => {
          this.playProceduralSFX(synthType, vol);
        });
        return;
      } catch (err) {
        console.warn('[AudioSystem] SFX audio failed, falling back to procedural synthesizer');
      }
    }

    this.playProceduralSFX(synthType, vol);
  }

  private playProceduralSFX(type: 'click' | 'item' | 'door' | 'pickup', volume: number): void {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) this.audioCtx = new AudioCtxClass();
      }
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'pickup' || type === 'item') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(volume * 0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'door') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(90, now + 0.3);
        gain.gain.setValueAtTime(volume * 0.5, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(400, now + 0.03);
        gain.gain.setValueAtTime(volume * 0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      }
    } catch (e) {
      // Ignore Web Audio errors
    }
  }
}
