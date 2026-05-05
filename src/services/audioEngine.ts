import { VideoClip } from "../types";

export interface AudioLevels {
  peakL: number;
  peakR: number;
  rms: number;
}

export class AudioEngine {
  public context: AudioContext;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();
  // Clip EQ nodes mapped by clip id
  private eqNodes: Map<string, { low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode }> = new Map();
  private pannerNodes: Map<string, StereoPannerNode> = new Map();

  // Track channels (0 to 3) + master
  public trackGains: GainNode[] = [];
  public trackPanners: StereoPannerNode[] = [];
  public trackAnalysers: AnalyserNode[] = [];
  
  public masterGain: GainNode;
  public masterAnalyser: AnalyserNode;
  public masterLimiter: DynamicsCompressorNode;
  
  private defaultReverbBuffer: AudioBuffer | null = null;
  private clipTimeInfos: Map<string, { contextStartTime: number, clipOffset: number, duration: number }> = new Map();

  public globalMute: boolean = false;
  public masterVolume: number = 1.0;

  constructor() {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Setup Master Chain
    this.masterGain = this.context.createGain();
    this.masterLimiter = this.context.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -0.5; // Ceiling
    this.masterLimiter.knee.value = 0.0;
    this.masterLimiter.ratio.value = 20.0;
    this.masterLimiter.attack.value = 0.005;
    this.masterLimiter.release.value = 0.05;
    
    this.masterAnalyser = this.context.createAnalyser();
    this.masterAnalyser.fftSize = 2048;

    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.context.destination);

    // Track channels (0 to 3 + some extras if needed)
    for (let i = 0; i < 6; i++) {
      const trackGain = this.context.createGain();
      const trackPanner = this.context.createStereoPanner();
      const trackAnalyser = this.context.createAnalyser();
      trackAnalyser.fftSize = 2048;

      trackPanner.connect(trackGain);
      trackGain.connect(trackAnalyser);
      trackAnalyser.connect(this.masterGain);

      this.trackGains.push(trackGain);
      this.trackPanners.push(trackPanner);
      this.trackAnalysers.push(trackAnalyser);
    }
  }

  public setGlobalMute(muted: boolean) {
    this.globalMute = muted;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : this.masterVolume, this.context.currentTime, 0.05);
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = vol;
    if (!this.globalMute) {
      this.masterGain.gain.setTargetAtTime(vol, this.context.currentTime, 0.05);
    }
  }

  public setTrackVolume(trackIndex: number, db: number) {
     if (this.trackGains[trackIndex]) {
        // Convert dB to linear
        const linearOffset = Math.pow(10, db / 20);
        this.trackGains[trackIndex].gain.setTargetAtTime(linearOffset, this.context.currentTime, 0.05);
     }
  }

  public setTrackPan(trackIndex: number, pan: number) {
    if (this.trackPanners[trackIndex]) {
        this.trackPanners[trackIndex].pan.setTargetAtTime(pan, this.context.currentTime, 0.05);
    }
  }

  public getLevels(analyser: AnalyserNode): AudioLevels {
    if (!analyser) return { peakL: 0, peakR: 0, rms: 0 };
    const array = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(array);
    let peakL = 0;
    let peakR = 0;
    let sumSquares = 0;
    for (let i = 0; i < array.length; i++) {
        const val = array[i];
        if (i % 2 === 0) peakL = Math.max(peakL, Math.abs(val));
        else peakR = Math.max(peakR, Math.abs(val));
        sumSquares += val * val;
    }
    return {
      peakL,
      peakR,
      rms: Math.sqrt(sumSquares / array.length)
    };
  }

  private getReverbBuffer() {
    if (this.defaultReverbBuffer) return this.defaultReverbBuffer;
    const duration = 2;
    const decay = 2;
    const sampleRate = this.context.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.context.createBuffer(2, length, sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    this.defaultReverbBuffer = buffer;
    return buffer;
  }

  async loadAudio(url: string, id: string): Promise<AudioBuffer | null> {
    if (!url) return null;
    if (this.buffers.has(url)) return this.buffers.get(url)!;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) {
        console.warn(`Empty audio buffer for clip ${id}`);
        return null;
      }

      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.buffers.set(url, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.warn(`Audio decoding failed for clip ${id}:`, error);
      return null;
    }
  }

  getWaveform(buffer: AudioBuffer | null, points: number = 100): number[] {
    if (!buffer) return Array(points).fill(0);
    const rawData = buffer.getChannelData(0);
    const samplesPerPoint = Math.floor(rawData.length / points);
    const data: number[] = [];

    for (let i = 0; i < points; i++) {
      let sum = 0;
      for (let j = 0; j < samplesPerPoint; j++) {
        sum += Math.abs(rawData[i * samplesPerPoint + j]);
      }
      data.push(sum / samplesPerPoint);
    }
    const max = Math.max(...data);
    if (max === 0) return data;
    return data.map(v => v / max);
  }

  async playClip(clip: VideoClip, currentTime: number, isPlaying: boolean) {
    this.stopClip(clip.id);
    if (!isPlaying || clip.audio?.muted) return;

    try {
      const buffer = await this.loadAudio(clip.url, clip.id);
      if (!buffer) return;

      const offset = Math.max(0, currentTime - clip.startTime);
      if (offset >= clip.duration) return;

      const source = this.context.createBufferSource();
      source.buffer = buffer;

      let lastNode: AudioNode = source;

      // Noise reduction (AI)
      if (clip.audio?.aiNoiseReduction || clip.audio?.denoise?.enabled) {
         // High pass
         const rumbleCut = this.context.createBiquadFilter();
         rumbleCut.type = 'highpass';
         rumbleCut.frequency.value = 80;
         
         const compressor = this.context.createDynamicsCompressor();
         compressor.threshold.value = -30;
         compressor.ratio.value = 4;
         
         lastNode.connect(rumbleCut);
         rumbleCut.connect(compressor);
         lastNode = compressor;
      }

      // 5-band EQ or 3-band classic EQ
      const low = this.context.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = 320;
      low.gain.value = clip.audio?.eq?.low ?? 0;

      const mid = this.context.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1000;
      mid.Q.value = 1;
      mid.gain.value = clip.audio?.eq?.mid ?? 0;

      const high = this.context.createBiquadFilter();
      high.type = "highshelf";
      high.frequency.value = 3200;
      high.gain.value = clip.audio?.eq?.high ?? 0;

      lastNode.connect(low);
      low.connect(mid);
      mid.connect(high);
      lastNode = high;
      this.eqNodes.set(clip.id, { low, mid, high });

      // Clip dynamics (Compressor)
      if (clip.audio?.compressor?.enabled) {
         const comp = this.context.createDynamicsCompressor();
         comp.threshold.value = clip.audio.compressor.threshold;
         comp.ratio.value = clip.audio.compressor.ratio;
         comp.attack.value = clip.audio.compressor.attack;
         comp.release.value = clip.audio.compressor.release;
         comp.knee.value = clip.audio.compressor.knee;
         
         const makeup = this.context.createGain();
         makeup.gain.value = Math.pow(10, clip.audio.compressor.makeupGain / 20); // dB to linear

         lastNode.connect(comp);
         comp.connect(makeup);
         lastNode = makeup;
      }

      // Clip Limiter
      if (clip.audio?.limiter?.enabled) {
         const lim = this.context.createDynamicsCompressor();
         lim.threshold.value = clip.audio.limiter.ceiling;
         lim.ratio.value = 20; // High ratio for limiting
         lim.attack.value = 0.005;
         lim.release.value = 0.05;

         lastNode.connect(lim);
         lastNode = lim;
      }
      
      // Delay & Reverb (Parallel)
      const dryGain = this.context.createGain();
      dryGain.gain.value = 1.0;
      
      const pannerNode = this.context.createStereoPanner();
      pannerNode.pan.value = clip.audio?.pan ?? 0;

      lastNode.connect(pannerNode);

      // Reverb
      if (clip.audio?.effects?.reverb) {
         const reverbNode = this.context.createConvolver();
         reverbNode.buffer = this.getReverbBuffer();
         const reverbGain = this.context.createGain();
         reverbGain.gain.value = clip.audio.effects.reverb;
         pannerNode.connect(reverbNode);
         reverbNode.connect(reverbGain);
         
         const trackDest = this.trackPanners[clip.trackIndex] || this.masterGain;
         reverbGain.connect(trackDest);
      }

      // Delay
      if (clip.audio?.effects?.delay) {
         const delayNode = this.context.createDelay(2.0);
         delayNode.delayTime.value = 0.3;
         const delayGain = this.context.createGain();
         delayGain.gain.value = clip.audio.effects.delay;
         const fb = this.context.createGain(); fb.gain.value = 0.4;
         delayNode.connect(fb); fb.connect(delayNode);

         pannerNode.connect(delayNode);
         delayNode.connect(delayGain);
         const trackDest = this.trackPanners[clip.trackIndex] || this.masterGain;
         delayGain.connect(trackDest);
      }
      
      const gainNode = this.context.createGain();
      gainNode.gain.value = clip.audio?.muted ? 0 : (clip.audio?.volume ?? 1);

      // Fades
      if (clip.audio?.fadeIn && offset < clip.audio.fadeIn) {
          gainNode.gain.setValueAtTime(0, this.context.currentTime);
          gainNode.gain.linearRampToValueAtTime(clip.audio.volume, this.context.currentTime + (clip.audio.fadeIn - offset));
      }
      
      const remainingTime = clip.duration - offset;
      if (clip.audio?.fadeOut && remainingTime < clip.audio.fadeOut) {
          gainNode.gain.setValueAtTime(clip.audio.volume, this.context.currentTime);
          gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + remainingTime);
      } else if (clip.audio?.fadeOut) {
          gainNode.gain.setValueAtTime(clip.audio.volume, this.context.currentTime + (remainingTime - clip.audio.fadeOut));
          gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + remainingTime);
      }

      pannerNode.connect(gainNode);

      // Route to correct track
      if (this.trackPanners[clip.trackIndex]) {
          gainNode.connect(this.trackPanners[clip.trackIndex]);
      } else {
          gainNode.connect(this.masterGain);
      }

      source.playbackRate.value = clip.speed ?? 1;
      const sourceStart = clip.sourceStart + offset;
      source.start(0, sourceStart, (clip.duration - offset) / (clip.speed ?? 1));

      this.sources.set(clip.id, source);
      this.gainNodes.set(clip.id, gainNode);
      this.pannerNodes.set(clip.id, pannerNode);
      this.clipTimeInfos.set(clip.id, { contextStartTime: this.context.currentTime, clipOffset: offset, duration: clip.duration });

    } catch (error) {
      console.warn(`Failed to play audio for clip ${clip.id}:`, error);
    }
  }

  updateClipAudio(clip: VideoClip) {
    const gainNode = this.gainNodes.get(clip.id);
    const pannerNode = this.pannerNodes.get(clip.id);
    const eq = this.eqNodes.get(clip.id);
    const timeInfo = this.clipTimeInfos.get(clip.id);

    if (gainNode) {
      gainNode.gain.cancelScheduledValues(this.context.currentTime);
      const targetVolume = clip.audio?.muted ? 0 : (clip.audio?.volume ?? 1);

      if (timeInfo && !clip.audio?.muted) {
        const currentOffset = timeInfo.clipOffset + (this.context.currentTime - timeInfo.contextStartTime);
        const remainingTime = clip.duration - currentOffset;

        if (clip.audio?.fadeIn && currentOffset < clip.audio.fadeIn) {
           gainNode.gain.setValueAtTime(0, this.context.currentTime);
           const fadeEndTime = timeInfo.contextStartTime + (clip.audio.fadeIn - timeInfo.clipOffset);
           gainNode.gain.linearRampToValueAtTime(targetVolume, Math.max(this.context.currentTime, fadeEndTime));
        } else if (clip.audio?.fadeOut && remainingTime < clip.audio.fadeOut) {
           gainNode.gain.setValueAtTime(targetVolume, this.context.currentTime);
           gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + remainingTime);
        } else {
           gainNode.gain.setTargetAtTime(targetVolume, this.context.currentTime, 0.05);

           if (clip.audio?.fadeOut) {
             const fadeOutStartTime = timeInfo.contextStartTime + clip.duration - timeInfo.clipOffset - clip.audio.fadeOut;
             if (fadeOutStartTime > this.context.currentTime) {
               gainNode.gain.setValueAtTime(targetVolume, fadeOutStartTime);
               gainNode.gain.linearRampToValueAtTime(0, fadeOutStartTime + clip.audio.fadeOut);
             }
           }
        }
      } else {
        gainNode.gain.setTargetAtTime(targetVolume, this.context.currentTime, 0.05);
      }
    }
    if (pannerNode) {
      pannerNode.pan.setTargetAtTime(clip.audio?.pan ?? 0, this.context.currentTime, 0.05);
    }
    if (eq && clip.audio?.eq) {
      eq.low.gain.setTargetAtTime(clip.audio.eq.low, this.context.currentTime, 0.05);
      eq.mid.gain.setTargetAtTime(clip.audio.eq.mid, this.context.currentTime, 0.05);
      eq.high.gain.setTargetAtTime(clip.audio.eq.high, this.context.currentTime, 0.05);
    }
  }

  stopClip(id: string) {
    const source = this.sources.get(id);
    if (source) {
      try {
        source.stop();
      } catch (e) {}
      this.sources.delete(id);
      this.clipTimeInfos.delete(id);
    }
  }

  stopAll() {
    this.sources.forEach((_, id) => this.stopClip(id));
  }

  resume() {
    if (this.context.state === 'suspended') {
      this.context.resume().catch(console.error);
    }
  }
}

export const audioEngine = new AudioEngine();
