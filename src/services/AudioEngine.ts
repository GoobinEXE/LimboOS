export class AudioEngine {
  private static instance: AudioEngine;
  private audio: HTMLAudioElement | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onErrorCallback: ((code: number | null) => void) | null = null;
  private onBufferingCallback: ((buffering: boolean) => void) | null = null;
  private onLoadedMetadataCallback: ((duration: number) => void) | null = null;
  private buffering = false;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;
  // Volume desejado pelo usuário (0-1). Os fades de pause/stop zeram o volume
  // do elemento, então o alvo precisa viver fora dele para o play restaurar.
  private targetVolume = 0.8;

  private constructor() {}

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public init() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'metadata';

      this.audio.addEventListener('ended', () => {
        if (this.onEndedCallback) this.onEndedCallback();
      });

      this.audio.addEventListener('error', (e) => {
        // Ignora erro se não houver SRC (comum ao limpar a faixa)
        if (!this.audio?.src || this.audio.src === window.location.href) return;
        console.warn('[AudioEngine] Elemento de áudio reportou um problema:', e);
        this.emitBuffering(false);
        this.onErrorCallback?.(this.audio.error?.code ?? null);
      });

      // Buffering: waiting/stalled só contam com a fita em reprodução
      const onStall = () => {
        if (this.audio && !this.audio.paused) this.emitBuffering(true);
      };
      this.audio.addEventListener('waiting', onStall);
      this.audio.addEventListener('stalled', onStall);
      this.audio.addEventListener('playing', () => this.emitBuffering(false));
      this.audio.addEventListener('canplay', () => this.emitBuffering(false));
      this.audio.addEventListener('pause', () => this.emitBuffering(false));

      this.audio.addEventListener('loadedmetadata', () => {
        const d = this.audio?.duration;
        this.onLoadedMetadataCallback?.(d !== undefined && Number.isFinite(d) ? d : 0);
      });
    }
  }

  public loadTrack(url: string) {
    this.init();
    if (this.audio) {
      try {
        this.clearFade();
        this.audio.src = url;
        this.audio.load();
      } catch (error) {
        console.error('[AudioEngine] Erro ao carregar faixa:', error);
      }
    }
  }

  public async play(): Promise<void> {
    if (!this.audio || !this.audio.src) return;
    this.clearFade();

    // Fade in suave (0.15s) para evitar estalos
    this.audio.volume = 0;
    try {
      await this.audio.play();
      this.fadeVolume(this.targetVolume, 150);
    } catch (error) {
      this.audio.volume = this.targetVolume;
      console.warn('[AudioEngine] Autoplay bloqueado ou erro ao reproduzir:', error);
      throw error;
    }
  }

  public pause() {
    if (this.audio && !this.audio.paused) {
      // Fade out suave antes de pausar
      this.fadeVolume(0, 100, () => {
        this.audio?.pause();
      });
    }
  }

  public stop() {
    if (!this.audio) return;
    if (this.audio.paused) {
      this.audio.currentTime = 0;
      return;
    }
    this.fadeVolume(0, 100, () => {
      if (this.audio) {
        this.audio.pause();
        this.audio.currentTime = 0;
      }
    });
  }

  private clearFade() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  private fadeVolume(target: number, duration: number, onComplete?: () => void) {
    if (!this.audio) return;
    this.clearFade();

    const startVol = this.audio.volume;
    const steps = 10;
    const stepTime = duration / steps;
    const volStep = (target - startVol) / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (!this.audio) {
        this.clearFade();
        return;
      }

      currentStep++;
      const nextVol = startVol + volStep * currentStep;
      this.audio.volume = Math.max(0, Math.min(1, nextVol));

      if (currentStep >= steps) {
        this.clearFade();
        this.audio.volume = target;
        if (onComplete) onComplete();
      }
    }, stepTime);
  }

  public setVolume(volume: number) {
    this.init();
    // Volume de 0 a 1 no HTML5 Audio
    this.targetVolume = Math.max(0, Math.min(100, volume)) / 100;
    if (this.audio && !this.fadeInterval) {
      this.audio.volume = this.targetVolume;
    }
  }

  public setOnEnded(callback: () => void) {
    this.onEndedCallback = callback;
  }

  /** Erro do elemento de áudio com uma fonte válida; recebe o `MediaError.code` (1 a 4) ou null. */
  public setOnError(callback: ((code: number | null) => void) | null) {
    this.onErrorCallback = callback;
  }

  /** true quando a reprodução trava esperando dados; false quando volta, pausa ou falha. */
  public setOnBuffering(callback: ((buffering: boolean) => void) | null) {
    this.onBufferingCallback = callback;
  }

  /** Metadados carregados; recebe a duração em segundos (0 se desconhecida). */
  public setOnLoadedMetadata(callback: ((duration: number) => void) | null) {
    this.onLoadedMetadataCallback = callback;
  }

  private emitBuffering(value: boolean) {
    if (this.buffering === value) return;
    this.buffering = value;
    this.onBufferingCallback?.(value);
  }

  /** Posiciona a fita em `t` segundos, limitado a [0, duração]. */
  public seekTo(t: number) {
    if (!this.audio || !Number.isFinite(t)) return;
    const d = this.getDuration();
    this.audio.currentTime = Math.max(0, d > 0 ? Math.min(t, d) : t);
  }

  /** Avança ou recua `deltaSeconds`, limitado a [0, duração]. */
  public seekBy(deltaSeconds: number) {
    if (!this.audio) return;
    this.seekTo(this.audio.currentTime + deltaSeconds);
  }

  public getCurrentTime(): number {
    return this.audio ? this.audio.currentTime : 0;
  }

  public getDuration(): number {
    return this.audio && !isNaN(this.audio.duration) ? this.audio.duration : 0;
  }

  public clearTrack() {
    if (this.audio) {
      this.clearFade();
      this.audio.pause();
      this.audio.src = '';
      this.emitBuffering(false);
    }
  }
}

export const audioEngine = AudioEngine.getInstance();
