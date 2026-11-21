import keyPressUrl from '../assets/sfx/walkman/key-press.wav';
import keyReleaseUrl from '../assets/sfx/walkman/key-release.wav';
import buttonUrl from '../assets/sfx/walkman/button.wav';
import dialUrl from '../assets/sfx/walkman/dial.wav';
import detentUrl from '../assets/sfx/walkman/detent.wav';
import insertUrl from '../assets/sfx/walkman/insert.wav';
import ejectUrl from '../assets/sfx/walkman/eject.wav';
import deadUrl from '../assets/sfx/walkman/dead.wav';

/**
 * Sons mecânicos do walkman. Os cliques são amostras curtas (WAV mono, ~90 KB no
 * total, geradas com o banco do earshot; o clique pequeno e o interruptor vêm de
 * gravações CC0 de qubodup e IanStarGem no Freesound). O motor do rebobinar e a
 * mola do ejetar continuam sintetizados. Toda a energia fica acima de ~400 Hz,
 * a faixa que o alto-falante de celular reproduz.
 *
 * Cada toque varia um pouco o tom e o volume, para repetição não soar idêntica.
 * O mesmo som pedido duas vezes em menos de 180 ms toca uma vez só: os controles
 * chamam no pointerdown (o clique sai quando o dedo afunda a tecla) e de novo no
 * click (teclado), sem dobrar.
 */
const SAMPLE_URLS = {
  keyPress: keyPressUrl,
  keyRelease: keyReleaseUrl,
  button: buttonUrl,
  dial: dialUrl,
  detent: detentUrl,
  insert: insertUrl,
  eject: ejectUrl,
  dead: deadUrl,
} as const;

type SampleName = keyof typeof SAMPLE_URLS;

const DEDUPE_MS = 180;

class WalkmanSfx {
  private static instance: WalkmanSfx;
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<SampleName, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private lastPlayed = new Map<string, number>();

  static getInstance(): WalkmanSfx {
    if (!WalkmanSfx.instance) WalkmanSfx.instance = new WalkmanSfx();
    return WalkmanSfx.instance;
  }

  private init(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 1.5);
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    void this.load();
    return this.ctx;
  }

  /** Baixa e decodifica as amostras uma vez. Falha de rede deixa a síntese como reserva. */
  private load(): Promise<void> {
    if (this.loading) return this.loading;
    if (typeof window === 'undefined') return Promise.resolve();
    // Decodifica num contexto offline: dá para preparar antes do primeiro gesto
    // e o AudioBuffer serve em qualquer contexto.
    let ctx: BaseAudioContext | null = this.ctx;
    if (!ctx) {
      const Offline = window.OfflineAudioContext
        || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      if (!Offline) return Promise.resolve();
      try { ctx = new Offline(1, 1, 44100); } catch { return Promise.resolve(); }
    }
    const decoder = ctx;
    this.loading = Promise.all(
      (Object.keys(SAMPLE_URLS) as SampleName[]).map(async (name) => {
        try {
          const res = await fetch(SAMPLE_URLS[name]);
          const raw = await res.arrayBuffer();
          const buf = await new Promise<AudioBuffer>((resolve, reject) => {
            // Safari antigo só aceita a forma com callbacks
            const p = decoder.decodeAudioData(raw, resolve, reject);
            if (p && typeof p.then === 'function') p.then(resolve, reject);
          });
          this.buffers.set(name, buf);
        } catch { /* fica na síntese */ }
      }),
    ).then(() => undefined);
    return this.loading;
  }

  /** Baixa as amostras ao abrir o walkman, antes do primeiro toque. */
  preload() {
    void this.load();
  }

  private isDuplicate(key: string): boolean {
    const now = performance.now();
    const last = this.lastPlayed.get(key) ?? -Infinity;
    if (now - last < DEDUPE_MS) return true;
    this.lastPlayed.set(key, now);
    return false;
  }

  /** Toca a amostra com leve variação; devolve false se ainda não carregou. */
  private sample(name: SampleName, at: number, gain = 1, rate = 1): boolean {
    const buf = this.buffers.get(name);
    if (!buf || !this.ctx || !this.master) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    const g = this.ctx.createGain();
    g.gain.value = gain * (0.85 + Math.random() * 0.15);
    src.connect(g).connect(this.master);
    src.start(at);
    return true;
  }

  /** Estalo de ruído filtrado (reserva e camadas sintéticas). */
  private burst(at: number, dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(at, Math.random() * 1.2);
    src.stop(at + dur + 0.02);
  }

  private run(key: string, fn: (t: number) => void) {
    if (this.isDuplicate(key)) return;
    const ctx = this.init();
    if (!ctx || !this.noise) return;
    try { fn(ctx.currentTime + 0.003); } catch { /* sem som */ }
  }

  /** Amostra com reserva sintética enquanto o arquivo não chegou. */
  private play(name: SampleName, fallback: (t: number) => void, gain = 1) {
    this.run(name, (t) => {
      if (!this.sample(name, t, gain)) fallback(t);
    });
  }

  /** Tecla de play descendo e travando. */
  keyPress() {
    this.play('keyPress', (t) => {
      this.burst(t, 0.03, 3200, 1.2, 0.9);
      this.burst(t + 0.045, 0.05, 1600, 2, 0.6);
    });
  }

  /** Tecla destravando (pause/stop): clique e a mola devolvendo a tecla. */
  keyRelease() {
    this.play('keyRelease', (t) => {
      this.burst(t, 0.025, 2600, 1.5, 0.8);
    });
  }

  /** Tecla apertada sem efeito (sem fita, sem sistema): afunda e volta, seca. */
  dead() {
    this.play('dead', (t) => {
      this.burst(t, 0.03, 900, 1, 0.6);
    }, 0.8);
  }

  /** Motor rebobinando: tecla, zumbido que acelera e o tranco ao parar. */
  rewind(durationMs = 1400) {
    this.run('rewind', (t) => {
      const ctx = this.ctx!;
      const d = durationMs / 1000;
      if (!this.sample('keyPress', t)) this.burst(t, 0.03, 3200, 1.2, 0.9);
      const start = t + 0.06;
      // Motor: serra filtrada, fundamental baixa mas harmônicos na faixa do celular
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, start);
      o.frequency.exponentialRampToValueAtTime(260, start + d * 0.6);
      o.frequency.exponentialRampToValueAtTime(210, start + d);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100;
      bp.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.09, start + 0.15);
      g.gain.setValueAtTime(0.09, start + d - 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, start + d);
      o.connect(bp).connect(g).connect(this.master!);
      o.start(start);
      o.stop(start + d + 0.05);
      // Fita chiando no cabeçote
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4000;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, start);
      ng.gain.exponentialRampToValueAtTime(0.06, start + 0.25);
      ng.gain.exponentialRampToValueAtTime(0.0001, start + d);
      src.connect(hp).connect(ng).connect(this.master!);
      src.start(start);
      src.stop(start + d + 0.05);
      // Fim da fita: a tecla desarma sozinha
      if (!this.sample('keyRelease', start + d)) this.burst(start + d, 0.04, 2200, 1.5, 0.7);
    });
  }

  /** Ejetar: trava solta, mola abre a tampa. */
  eject() {
    this.run('eject', (t) => {
      if (!this.sample('eject', t)) this.burst(t, 0.025, 3500, 1.4, 0.8);
      this.burst(t + 0.03, 0.2, 5200, 6, 0.1); // mola
    });
  }

  /** Fita deslizando no compartimento e a tampa travando. */
  insert() {
    this.play('insert', (t) => {
      this.burst(t, 0.12, 900, 0.8, 0.3, 'lowpass');
      this.burst(t + 0.12, 0.04, 2400, 1.2, 0.8);
    });
  }

  /** Clique da roda de modo. */
  tick() {
    this.play('dial', (t) => {
      this.burst(t, 0.018, 4200, 3, 0.5);
    });
  }

  /** Dente do volume. Mais baixo e sem dedupe longo: o arraste passa por vários. */
  detent() {
    const key = 'detent';
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < 35) return;
    this.lastPlayed.set(key, now);
    const ctx = this.init();
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime + 0.003;
    try {
      if (!this.sample('detent', t, 0.55)) this.burst(t, 0.015, 4800, 3, 0.3);
    } catch { /* sem som */ }
  }

  /** Botão pequeno (perfil, seletor de sistemas, câmera). */
  button() {
    this.play('button', (t) => {
      this.burst(t, 0.022, 2800, 1.6, 0.6);
    });
  }
}

export const walkmanSfx = WalkmanSfx.getInstance();
