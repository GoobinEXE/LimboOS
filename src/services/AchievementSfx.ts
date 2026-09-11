import type { AchievementTier } from './AchievementManager';

/**
 * Feedback sonoro de unlock via Web Audio (sem assets).
 * Timbre square alinhado ao NokiaAudioFeedback.
 */
class AchievementSfx {
  private static instance: AchievementSfx;
  private ctx: AudioContext | null = null;

  private constructor() {}

  public static getInstance(): AchievementSfx {
    if (!AchievementSfx.instance) {
      AchievementSfx.instance = new AchievementSfx();
    }
    return AchievementSfx.instance;
  }

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      } catch {
        /* silent */
      }
    }
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private playTone(freq: number, startMs: number, durationMs: number, gainVal: number) {
    this.init();
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + startMs / 1000;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t0);
      gainNode.gain.setValueAtTime(0.0001, t0);
      gainNode.gain.exponentialRampToValueAtTime(gainVal, t0 + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + durationMs / 1000 + 0.02);
    } catch {
      /* ignore */
    }
  }

  /** Acorde curto de medalha; lendárias ganham um tom extra. */
  public playUnlock(tier: AchievementTier = 'common') {
    const base = tier === 'legendary' ? 0.055 : tier === 'rare' ? 0.048 : 0.04;
    this.playTone(523.25, 0, 90, base);       // C5
    this.playTone(659.25, 70, 100, base);     // E5
    this.playTone(783.99, 140, 140, base * 1.1); // G5
    if (tier === 'legendary' || tier === 'rare') {
      this.playTone(1046.5, 220, 180, base * 0.85); // C6
    }
  }
}

export const achievementSfx = AchievementSfx.getInstance();
