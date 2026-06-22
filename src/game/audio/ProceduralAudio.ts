type AudioCue =
  | 'checkpoint'
  | 'coin'
  | 'dash'
  | 'death'
  | 'jump'
  | 'land'
  | 'mutation'
  | 'portal'
  | 'warning';

type AudioContextConstructor = typeof AudioContext;

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: AudioContextConstructor;
}

const cueMap: Record<AudioCue, Array<{ duration: number; frequency: number; gain: number; type?: OscillatorType }>> = {
  checkpoint: [
    { duration: 0.07, frequency: 520, gain: 0.05 },
    { duration: 0.1, frequency: 740, gain: 0.045 }
  ],
  coin: [
    { duration: 0.055, frequency: 780, gain: 0.045 },
    { duration: 0.08, frequency: 1180, gain: 0.04 }
  ],
  dash: [
    { duration: 0.08, frequency: 180, gain: 0.055, type: 'sawtooth' },
    { duration: 0.06, frequency: 420, gain: 0.035, type: 'triangle' }
  ],
  death: [
    { duration: 0.13, frequency: 180, gain: 0.06, type: 'sawtooth' },
    { duration: 0.18, frequency: 82, gain: 0.055, type: 'square' }
  ],
  jump: [
    { duration: 0.075, frequency: 330, gain: 0.045 },
    { duration: 0.06, frequency: 520, gain: 0.03 }
  ],
  land: [
    { duration: 0.055, frequency: 110, gain: 0.045, type: 'triangle' }
  ],
  mutation: [
    { duration: 0.09, frequency: 95, gain: 0.055, type: 'sawtooth' },
    { duration: 0.12, frequency: 620, gain: 0.035, type: 'square' }
  ],
  portal: [
    { duration: 0.16, frequency: 420, gain: 0.045 },
    { duration: 0.18, frequency: 840, gain: 0.04 }
  ],
  warning: [
    { duration: 0.09, frequency: 480, gain: 0.045, type: 'triangle' },
    { duration: 0.09, frequency: 240, gain: 0.035, type: 'triangle' }
  ]
};

export class ProceduralAudio {
  private context: AudioContext | null = null;
  private muted = false;
  private music: {
    bass: OscillatorNode;
    shimmer: OscillatorNode;
    filter: BiquadFilterNode;
    master: GainNode;
    pulseTimer: number;
  } | null = null;

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stopMusic();
  }

  unlock() {
    if (this.muted) return;
    const context = this.getContext();
    void context?.resume().catch(() => {
      this.muted = true;
    });
  }

  startMusic(intensity = 0.45) {
    if (this.muted || this.music) return;

    const context = this.getContext();
    if (!context) return;

    void context.resume().catch(() => {
      this.muted = true;
    });

    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const bass = context.createOscillator();
    const shimmer = context.createOscillator();

    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(55, context.currentTime);
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(165, context.currentTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, context.currentTime);
    filter.Q.setValueAtTime(7, context.currentTime);
    master.gain.setValueAtTime(0.0001, context.currentTime);

    bass.connect(filter);
    shimmer.connect(filter);
    filter.connect(master);
    master.connect(context.destination);

    bass.start();
    shimmer.start();

    this.music = {
      bass,
      shimmer,
      filter,
      master,
      pulseTimer: window.setInterval(() => {
        if (!this.muted) this.scheduleTone(context, 880, 0.045, 0.018, 0, 'triangle');
      }, 3450)
    };
    this.setMusicIntensity(intensity);
  }

  setMusicIntensity(intensity: number) {
    if (!this.music || !this.context) return;
    const amount = Math.max(0, Math.min(1, intensity));
    const now = this.context.currentTime;
    this.music.master.gain.cancelScheduledValues(now);
    this.music.master.gain.linearRampToValueAtTime(0.012 + amount * 0.035, now + 0.22);
    this.music.filter.frequency.cancelScheduledValues(now);
    this.music.filter.frequency.linearRampToValueAtTime(420 + amount * 980, now + 0.28);
  }

  stopMusic() {
    if (!this.music) return;
    window.clearInterval(this.music.pulseTimer);
    const { bass, shimmer, master } = this.music;
    const now = this.context?.currentTime ?? 0;
    try {
      master.gain.cancelScheduledValues(now);
      master.gain.linearRampToValueAtTime(0.0001, now + 0.08);
      bass.stop(now + 0.1);
      shimmer.stop(now + 0.1);
    } catch {
      // Audio nodes can already be stopped if the WebView tears down quickly.
    }
    this.music = null;
  }

  play(cue: AudioCue) {
    if (this.muted) return;

    const context = this.getContext();
    if (!context) return;

    void context.resume().catch(() => {
      this.muted = true;
    });

    let offset = 0;
    for (const note of cueMap[cue]) {
      this.scheduleTone(context, note.frequency, note.duration, note.gain, offset, note.type ?? 'sine');
      offset += note.duration * 0.62;
    }

    if (cue === 'dash') this.scheduleNoise(context, 0.05, 0.025, 0);
    if (cue === 'mutation' || cue === 'death') this.scheduleNoise(context, 0.14, 0.04, 0.02);
  }

  private getContext() {
    if (this.context) return this.context;

    try {
      const AudioCtor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioCtor) return null;
      this.context = new AudioCtor();
      return this.context;
    } catch {
      this.muted = true;
      return null;
    }
  }

  private scheduleTone(
    context: AudioContext,
    frequency: number,
    duration: number,
    peakGain: number,
    offset: number,
    type: OscillatorType
  ) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + offset;
    const end = start + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * 0.72), end);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  private scheduleNoise(context: AudioContext, duration: number, peakGain: number, offset: number) {
    const sampleRate = context.sampleRate;
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const start = context.currentTime + offset;
    const end = start + duration;

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, start);
    filter.frequency.exponentialRampToValueAtTime(120, end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(start);
    source.stop(end + 0.02);
  }
}
