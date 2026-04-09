// src/audio/BinauralEngine.ts
/**
 * NeuroFlow Binaural Beat Engine
 *
 * Architecture:
 *   AudioContext
 *   ├── Left Channel: OscillatorNode(carrierFreq) → GainNode → ChannelMergerNode → MasterGain → Destination
 *   └── Right Channel: OscillatorNode(carrierFreq + beatFreq) → GainNode ↗
 *
 * The perceived binaural beat = |leftFreq - rightFreq|
 * Both oscillators must be below 1500 Hz for the brain to synthesize the beat.
 */

export class BinauralEngine {
  private ctx: AudioContext | null = null;
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private leftGain: GainNode | null = null;
  private rightGain: GainNode | null = null;
  private binauralGain: GainNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Ambient audio nodes
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientBuffer: AudioBuffer | null = null;
  private ambientGain: GainNode | null = null;

  private _carrierFreq = 200; // Hz — must be audible, <1500 Hz
  private _beatFreq = 18;     // Hz — the binaural beat frequency
  private _binauralVolume = 0.6;
  private _ambientVolume = 0.5;
  private _masterVolume = 0.8;
  private _isPlaying = false;

  // Fade time for smooth transitions (seconds)
  private readonly FADE_TIME = 0.05;

  get isPlaying() { return this._isPlaying; }
  get carrierFreq() { return this._carrierFreq; }
  get beatFreq() { return this._beatFreq; }
  get binauralVolume() { return this._binauralVolume; }
  get ambientVolume() { return this._ambientVolume; }
  get masterVolume() { return this._masterVolume; }

  /** Initialize or resume AudioContext (must be called from user gesture) */
  async init(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') return;

    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 44100 });
      this.buildGraph();
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  private buildGraph(): void {
    if (!this.ctx) return;

    // Master output gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._masterVolume;

    // Analyser for visualizations
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    // Binaural gain (controls binaural beat level in mix)
    this.binauralGain = this.ctx.createGain();
    this.binauralGain.gain.value = this._binauralVolume;

    // Ambient gain
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = this._ambientVolume;

    // Stereo channel merger (2 inputs → 1 stereo output)
    this.merger = this.ctx.createChannelMerger(2);

    // Left channel gain (panned hard left via channel 0)
    this.leftGain = this.ctx.createGain();
    this.leftGain.gain.value = 1.0;

    // Right channel gain (panned hard right via channel 1)
    this.rightGain = this.ctx.createGain();
    this.rightGain.gain.value = 1.0;

    // Wire: leftGain → merger[0], rightGain → merger[1]
    this.leftGain.connect(this.merger, 0, 0);
    this.rightGain.connect(this.merger, 0, 1);

    // merger → binauralGain → masterGain → analyser → destination
    this.merger.connect(this.binauralGain);
    this.binauralGain.connect(this.masterGain);
    this.ambientGain.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  private createOscillators(): void {
    if (!this.ctx || !this.leftGain || !this.rightGain) return;

    // Create left oscillator
    this.leftOsc = this.ctx.createOscillator();
    this.leftOsc.type = 'sine';
    this.leftOsc.frequency.setValueAtTime(this._carrierFreq, this.ctx.currentTime);
    this.leftOsc.connect(this.leftGain);

    // Create right oscillator (carrier + beat offset)
    this.rightOsc = this.ctx.createOscillator();
    this.rightOsc.type = 'sine';
    this.rightOsc.frequency.setValueAtTime(
      this._carrierFreq + this._beatFreq,
      this.ctx.currentTime
    );
    this.rightOsc.connect(this.rightGain);

    this.leftOsc.start();
    this.rightOsc.start();
  }

  private destroyOscillators(): void {
    try { this.leftOsc?.stop(); } catch (_) {}
    try { this.rightOsc?.stop(); } catch (_) {}
    this.leftOsc?.disconnect();
    this.rightOsc?.disconnect();
    this.leftOsc = null;
    this.rightOsc = null;
  }

  /** Start binaural beat generation */
  async play(): Promise<void> {
    await this.init();
    if (this._isPlaying) return;

    this.createOscillators();

    // Fade in master to avoid click
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(
        this._masterVolume,
        this.ctx.currentTime + this.FADE_TIME
      );
    }

    this._isPlaying = true;
  }

  /** Pause (fade out + suspend context) */
  async pause(): Promise<void> {
    if (!this._isPlaying || !this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    this.masterGain.gain.linearRampToValueAtTime(0, now + this.FADE_TIME);

    await new Promise(r => setTimeout(r, this.FADE_TIME * 1000 + 50));
    this.destroyOscillators();
    this._isPlaying = false;
  }

  /** Full stop and reset */
  async stop(): Promise<void> {
    await this.pause();
    this.stopAmbient();
    await this.ctx?.suspend();
  }

  /** Update beat frequency smoothly */
  setBeatFrequency(hz: number): void {
    this._beatFreq = Math.max(0.5, Math.min(hz, 100));
    if (!this.ctx || !this.rightOsc) return;

    this.rightOsc.frequency.exponentialRampToValueAtTime(
      this._carrierFreq + this._beatFreq,
      this.ctx.currentTime + 0.5
    );
  }

  /** Update carrier frequency */
  setCarrierFrequency(hz: number): void {
    this._carrierFreq = Math.max(100, Math.min(hz, 500));
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    this.leftOsc?.frequency.exponentialRampToValueAtTime(this._carrierFreq, now + 0.5);
    this.rightOsc?.frequency.exponentialRampToValueAtTime(
      this._carrierFreq + this._beatFreq,
      now + 0.5
    );
  }

  /** Set binaural beat volume in the mix */
  setBinauralVolume(vol: number): void {
    this._binauralVolume = Math.max(0, Math.min(vol, 1));
    if (!this.ctx || !this.binauralGain) return;
    this.binauralGain.gain.linearRampToValueAtTime(
      this._binauralVolume,
      this.ctx.currentTime + 0.1
    );
  }

  /** Set ambient track volume in the mix */
  setAmbientVolume(vol: number): void {
    this._ambientVolume = Math.max(0, Math.min(vol, 1));
    if (!this.ctx || !this.ambientGain) return;
    this.ambientGain.gain.linearRampToValueAtTime(
      this._ambientVolume,
      this.ctx.currentTime + 0.1
    );
  }

  /** Set master output volume */
  setMasterVolume(vol: number): void {
    this._masterVolume = Math.max(0, Math.min(vol, 1));
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.linearRampToValueAtTime(
      this._masterVolume,
      this.ctx.currentTime + 0.1
    );
  }

  /** Load and play ambient track (loops seamlessly) */
  async playAmbient(url: string): Promise<void> {
    if (!url) { this.stopAmbient(); return; }
    await this.init();
    if (!this.ctx || !this.ambientGain) return;

    this.stopAmbient();

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.ambientBuffer = await this.ctx.decodeAudioData(arrayBuffer);

      this.ambientSource = this.ctx.createBufferSource();
      this.ambientSource.buffer = this.ambientBuffer;
      this.ambientSource.loop = true;
      this.ambientSource.connect(this.ambientGain);

      // Fade in ambient
      this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.ambientGain.gain.linearRampToValueAtTime(
        this._ambientVolume,
        this.ctx.currentTime + 1.5
      );

      this.ambientSource.start();
    } catch (err) {
      console.warn('[NeuroFlow] Failed to load ambient track:', err);
    }
  }

  /** Stop ambient playback with fade */
  stopAmbient(): void {
    if (!this.ambientSource || !this.ctx || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    this.ambientGain.gain.linearRampToValueAtTime(0, now + 0.8);
    const src = this.ambientSource;
    setTimeout(() => { try { src.stop(); } catch (_) {} }, 850);
    this.ambientSource = null;
  }

  /** Get analyser data for visualizations */
  getAnalyserData(): Uint8Array | null {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  /** Apply a full session preset */
  applyPreset(beatHz: number, ambientUrl: string, binVol: number, ambVol: number): void {
    this.setBeatFrequency(beatHz);
    this.setBinauralVolume(binVol);
    this.setAmbientVolume(ambVol);
    if (ambientUrl) {
      this.playAmbient(ambientUrl);
    } else {
      this.stopAmbient();
    }
  }

  /** Clean up all resources */
  destroy(): void {
    this.destroyOscillators();
    this.stopAmbient();
    this.ctx?.close();
    this.ctx = null;
  }
}

// Singleton export for popup use
export const engine = new BinauralEngine();