/**
 * Web Audio API synthesizer for ringtones, call beeps, and audio waveform simulation
 */

class AudioSynthService {
  private ctx: AudioContext | null = null;
  private ringOscillator: OscillatorNode | null = null;
  private ringGain: GainNode | null = null;
  private ringInterval: number | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Play a gentle soft telephone ringtone
   */
  startRinging() {
    const ctx = this.initCtx();
    if (!ctx) return;

    this.stopRinging();

    const playChime = () => {
      if (!this.ctx || this.ctx.state === 'closed') return;
      const now = this.ctx.currentTime;

      // Soft harmonic chime 440Hz + 480Hz
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.7);
      osc2.stop(now + 1.7);
    };

    playChime();
    this.ringInterval = window.setInterval(playChime, 3000);
  }

  stopRinging() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  /**
   * Play a gentle call connected beep
   */
  playConnectedChime() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  /**
   * Play call end tone
   */
  playEndChime() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.25);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  /**
   * Play synthetic preview sound for voice note if no audio file is provided
   */
  playVoiceWaveform(durationSeconds: number, onTick?: (progress: number) => void, onComplete?: () => void) {
    const ctx = this.initCtx();
    if (!ctx) {
      if (onComplete) onComplete();
      return () => {};
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    // Gentle melodic frequency modulation
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(320, now + durationSeconds * 0.3);
    osc.frequency.linearRampToValueAtTime(290, now + durationSeconds * 0.7);
    osc.frequency.linearRampToValueAtTime(260, now + durationSeconds);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.setValueAtTime(0.04, now + durationSeconds - 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSeconds);

    const startTime = performance.now();
    const totalMs = durationSeconds * 1000;
    let animId: number;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / totalMs);
      if (onTick) onTick(progress);
      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      } else {
        if (onComplete) onComplete();
      }
    };
    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      try {
        osc.stop();
        gain.disconnect();
      } catch {
        // already stopped
      }
    };
  }
}

export const audioSynth = new AudioSynthService();
