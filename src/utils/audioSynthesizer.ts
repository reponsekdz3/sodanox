/**
 * Web Audio API Acoustic Soundscape & Tactile Synthesizer
 * Generates calming ambient soundscapes (Rain, Vinyl, Forest, Alpha Waves)
 * and gentle tactile feedback clicks using native browser audio nodes.
 */

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private currentAmbientNode: { stop: () => void } | null = null;
  private currentMode: 'off' | 'rain' | 'vinyl' | 'binaural' | 'forest' = 'off';

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Gentle tactile acoustic click for button and logo interactions
   */
  public playClick(freq = 600, duration = 0.04) {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio not permitted yet
    }
  }

  /**
   * Warm harmonic chime
   */
  public playChime() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      [528, 660, 792].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);

        gain.gain.setValueAtTime(0.04, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.08 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.6);
      });
    } catch {
      // Audio suppressed
    }
  }

  /**
   * Set ambient studio soundscape
   */
  public setAmbient(mode: 'off' | 'rain' | 'vinyl' | 'binaural' | 'forest') {
    if (this.currentMode === mode) return;

    // Stop current ambient
    if (this.currentAmbientNode) {
      try {
        this.currentAmbientNode.stop();
      } catch {
        // Ignored
      }
      this.currentAmbientNode = null;
    }

    this.currentMode = mode;
    if (mode === 'off') return;

    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      if (mode === 'binaural') {
        // 432 Hz + 440 Hz alpha wave beat
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(432, ctx.currentTime);
        osc2.frequency.setValueAtTime(438, ctx.currentTime);

        gain.gain.setValueAtTime(0.03, ctx.currentTime);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();

        this.currentAmbientNode = {
          stop: () => {
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
            setTimeout(() => {
              osc1.stop();
              osc2.stop();
            }, 300);
          },
        };
      } else {
        // Noise-based generators (rain, vinyl, forest)
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          if (mode === 'rain') {
            // Brown/Pink noise for soothing rain
            output[i] = (lastOut + 0.02 * white) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5;
          } else if (mode === 'vinyl') {
            // Subtle hiss with occasional crackle
            const crackle = Math.random() > 0.998 ? (Math.random() * 2 - 1) * 0.8 : 0;
            output[i] = white * 0.05 + crackle;
          } else {
            // Forest breeze
            output[i] = (lastOut + 0.01 * white) / 1.01;
            lastOut = output[i];
            output[i] *= 2.0;
          }
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = mode === 'rain' ? 'lowpass' : mode === 'vinyl' ? 'bandpass' : 'lowpass';
        filter.frequency.setValueAtTime(mode === 'rain' ? 800 : mode === 'vinyl' ? 2400 : 450, ctx.currentTime);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.025, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        whiteNoise.start();

        this.currentAmbientNode = {
          stop: () => {
            gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
            setTimeout(() => {
              whiteNoise.stop();
            }, 300);
          },
        };
      }
    } catch (e) {
      console.warn('Could not start ambient audio:', e);
    }
  }

  public getMode() {
    return this.currentMode;
  }
}

export const auraAudio = new AudioSynthesizer();
export const studioAudio = auraAudio;
