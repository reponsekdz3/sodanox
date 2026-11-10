/**
 * Web Audio API synthesizer for Ducate:
 * - Real phone ringtone, connected beep, call end tone
 * - Modern acoustic message sent sound (soft pop/whoosh)
 * - Modern crystal message received chime (dual harmonic glass bell)
 * - Modern notification alert chime
 * - Reaction bubble pops
 * - Voice waveform synthesis
 */

class AudioSynthService {
  private ctx: AudioContext | null = null;
  private ringInterval: number | null = null;

  public initCtx(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
   * Modern acoustic chime when a message is sent (subtle swoosh + soft pop)
   */
  public playSentSound() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Subtle whoosh
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Audio suppressed by browser policy
    }
  }

  /**
   * Modern dual-tone crystal chime when a message is received from peer
   */
  public playReceivedSound() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 880Hz (A5) followed immediately by 1174.66Hz (D6)
      const tones = [
        { freq: 880, start: 0, dur: 0.22, vol: 0.07 },
        { freq: 1174.66, start: 0.07, dur: 0.35, vol: 0.09 },
      ];

      tones.forEach(({ freq, start, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(vol, now + start);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      });
    } catch {
      // Audio suppressed
    }
  }

  /**
   * Modern notification bell chime
   */
  public playNotificationSound() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const chord = [659.25, 830.61, 987.77]; // E major triad
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        gain.gain.setValueAtTime(0.05, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.48);
      });
    } catch {
      // Audio suppressed
    }
  }

  /**
   * Bubble pop for reactions and likes
   */
  public playPop(frequency = 720) {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.exponentialRampToValueAtTime(frequency * 0.3, now + 0.06);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // Audio suppressed
    }
  }

  /**
   * Play a gentle soft telephone ringtone
   */
  public startRinging() {
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

  public stopRinging() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  /**
   * Play call connected chime
   */
  public playConnectedChime() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  /**
   * Play call end tone
   */
  public playEndChime() {
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
   * Play synthetic preview sound for voice note
   */
  public playVoiceWaveform(durationSeconds: number, onTick?: (progress: number) => void, onComplete?: () => void) {
    const ctx = this.initCtx();
    if (!ctx) {
      if (onComplete) onComplete();
      return () => {};
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
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
