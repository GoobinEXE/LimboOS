/**
 * Sons mecânicos do walkman via Web Audio (sem assets): tecla que trava,
 * mola da tampa, fita encaixando, motor do rebobinar e o clique da roda.
 * Ruído filtrado + transientes curtos, para soar como plástico e metal,
 * não como bipe. Sempre disparado por gesto do usuário (iOS libera o áudio).
 */
class WalkmanSfx {
  private static instance: WalkmanSfx;
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;

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
        this.master.gain.value = 0.4;
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
    return this.ctx;
  }

  /** Estalo de ruído filtrado: o "corpo" de qualquer peça mecânica. */
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

  /** Batida grave curta (massa da carcaça). */
  private thump(at: number, freq: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private run(fn: (t: number) => void) {
    const ctx = this.init();
    if (!ctx || !this.noise) return;
    try { fn(ctx.currentTime + 0.005); } catch { /* sem som */ }
  }

  /** Tecla de play/stop: desce, trava e o mecanismo engata. */
  keyPress() {
    this.run((t) => {
      this.burst(t, 0.03, 3200, 1.2, 0.5);
      this.thump(t, 140, 0.07, 0.45);
      this.burst(t + 0.045, 0.05, 1600, 2, 0.35);
      this.thump(t + 0.045, 95, 0.09, 0.3);
    });
  }

  /** Tecla soltando (stop): um clique só, mais seco. */
  keyRelease() {
    this.run((t) => {
      this.burst(t, 0.025, 2600, 1.5, 0.4);
      this.thump(t, 180, 0.05, 0.25);
    });
  }

  /** Motor rebobinando: zumbido que acelera e o tranco ao parar. */
  rewind(durationMs = 1400) {
    this.run((t) => {
      const ctx = this.ctx!;
      const d = durationMs / 1000;
      this.keyPress();
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, t + 0.06);
      o.frequency.exponentialRampToValueAtTime(190, t + 0.06 + d * 0.6);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.06 + d);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.2);
      g.gain.setValueAtTime(0.07, t + 0.06 + d - 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + d);
      o.connect(lp).connect(g).connect(this.master!);
      o.start(t + 0.06);
      o.stop(t + 0.1 + d);
      // fita chiando no cabeçote
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4000;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t + 0.06);
      ng.gain.exponentialRampToValueAtTime(0.05, t + 0.25);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + d);
      src.connect(hp).connect(ng).connect(this.master!);
      src.start(t + 0.06);
      src.stop(t + 0.1 + d);
      this.thump(t + 0.06 + d, 120, 0.08, 0.35);
      this.burst(t + 0.06 + d, 0.04, 2200, 1.5, 0.3);
    });
  }

  /** Ejetar: trava solta, mola abre a tampa e a fita sobe. */
  eject() {
    this.run((t) => {
      this.burst(t, 0.025, 3500, 1.4, 0.45);
      this.thump(t, 160, 0.06, 0.35);
      this.burst(t + 0.04, 0.18, 5200, 6, 0.12); // mola
      this.burst(t + 0.16, 0.06, 1200, 1.2, 0.3);
      this.thump(t + 0.16, 90, 0.1, 0.3);
    });
  }

  /** Fita entrando no compartimento e a tampa fechando. */
  insert() {
    this.run((t) => {
      this.burst(t, 0.12, 900, 0.8, 0.18, 'lowpass'); // deslizar
      this.burst(t + 0.12, 0.04, 2400, 1.2, 0.45);
      this.thump(t + 0.12, 110, 0.1, 0.45);
      this.burst(t + 0.2, 0.03, 3000, 1.5, 0.25);
    });
  }

  /** Clique da roda de modo / dentes do volume. */
  tick() {
    this.run((t) => {
      this.burst(t, 0.018, 4200, 3, 0.25);
    });
  }

  /** Botão pequeno (perfil, menu de sistemas, câmera). */
  button() {
    this.run((t) => {
      this.burst(t, 0.022, 2800, 1.6, 0.3);
      this.thump(t, 220, 0.04, 0.2);
    });
  }
}

export const walkmanSfx = WalkmanSfx.getInstance();
