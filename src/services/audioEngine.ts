import { VideoClip } from "../types";

export class AudioEngine {
  private context: AudioContext;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();
  private pannerNodes: Map<string, StereoPannerNode> = new Map();
  private eqNodes: Map<string, { low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode }> = new Map();

  constructor() {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async loadAudio(url: string, id: string): Promise<AudioBuffer | null> {
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
      // Browsers like Chrome throw non-Error objects for some decode issues
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

    const gainNode = this.context.createGain();
    const pannerNode = this.context.createStereoPanner();
    
    // EQ setup
    const low = this.context.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 320;

    const mid = this.context.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1000;
    mid.Q.value = 1;

    const high = this.context.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 3200;

    // Apply settings
    gainNode.gain.value = clip.audio?.muted ? 0 : (clip.audio?.volume ?? 1);
    pannerNode.pan.value = clip.audio?.pan ?? 0;
    low.gain.value = clip.audio?.eq?.low ?? 0;
    mid.gain.value = clip.audio?.eq?.mid ?? 0;
    high.gain.value = clip.audio?.eq?.high ?? 0;

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

    // Connect chain
    source.connect(low);
    low.connect(mid);
    mid.connect(high);
    high.connect(pannerNode);
    pannerNode.connect(gainNode);
    gainNode.connect(this.context.destination);

    const sourceStart = clip.sourceStart + offset;
    source.start(0, sourceStart, clip.duration - offset);

    this.sources.set(clip.id, source);
    this.gainNodes.set(clip.id, gainNode);
    this.pannerNodes.set(clip.id, pannerNode);
    this.eqNodes.set(clip.id, { low, mid, high });
    } catch (error) {
      console.warn(`Failed to play audio for clip ${clip.id}:`, error);
    }
  }

  updateClipAudio(clip: VideoClip) {
    const gainNode = this.gainNodes.get(clip.id);
    const pannerNode = this.pannerNodes.get(clip.id);
    const eq = this.eqNodes.get(clip.id);

    if (gainNode) {
      gainNode.gain.setTargetAtTime(clip.audio?.muted ? 0 : (clip.audio?.volume ?? 1), this.context.currentTime, 0.05);
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
    }
  }

  stopAll() {
    this.sources.forEach((_, id) => this.stopClip(id));
  }

  resume() {
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }
}

export const audioEngine = new AudioEngine();
