export interface VideoClip {
  id: string;
  name: string;
  url: string;
  type: 'video' | 'audio' | 'image';
  duration: number;
  startTime: number; // Start time on timeline (seconds)
  sourceStart: number; // Start time within source file
  sourceEnd: number; // End time within source file
  trackIndex: number;
  volume: number;
  speed: number;
  transform: {
    scale: number;
    rotation: number;
    x?: number;
    y?: number;
    opacity?: number;
    crop?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  filters?: {
    brightness: number; // 1.0 default
    contrast: number;   // 1.0 default
    saturation: number; // 1.0 default
    blur: number;       // 0 default
    grayscale: number;  // 0 default
    sepia: number;      // 0 default
    invert: number;     // 0 default
    vignette: number;   // 0 default (strength)
    grain: number;      // 0 default (strength)
  };
  audio?: {
    volume: number;
    fadeIn: number;
    fadeOut: number;
    muted: boolean;
    pan?: number; // -1 (left) to 1 (right)
    eq?: {
      low: number;
      mid: number;
      high: number;
    };
    effects?: {
      reverb: number;
      delay: number;
      pitch: number;
    };
    noiseReduction?: boolean;
    voiceClarity?: boolean;
    waveform?: number[];
  };
  cutout?: {
    enabled: boolean;
    type: 'chroma' | 'ai';
    keyColor?: string;
    similarity?: number;
    smoothness?: number;
  };
}

export interface MediaAsset {
  id: string;
  name: string;
  url: string;
  type: 'video' | 'audio' | 'image';
  duration?: number;
  thumbnail?: string;
  size: number;
  audioWaveform?: number[];
}

export interface BackgroundConfig {
  type: 'solid' | 'gradient' | 'image' | 'video' | 'blur';
  color?: string;
  gradient?: {
    from: string;
    to: string;
    angle: number;
  };
  mediaUrl?: string;
  opacity: number;
  blurIntensity: number;
  fit: 'cover' | 'contain' | 'stretch';
  overlayColor?: string;
  overlayOpacity?: number;
}

export interface Transition {
  id: string;
  type: 'fade' | 'cross-dissolve' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom-in' | 'zoom-out' | 'blur' | 'glitch';
  duration: number; // seconds
  fromClipId: string;
  toClipId: string;
  easing: 'ease-in' | 'ease-out' | 'linear';
}

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  state: Partial<TimelineState>;
  category: 'social' | 'marketing' | 'slideshow' | 'intro' | 'podcast';
}

export interface TimelineState {
  clips: VideoClip[];
  assets: MediaAsset[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  zoomLevel: number;
  background: BackgroundConfig;
  transitions: Transition[];
}

export interface APNGOptions {
  fps: number;
  quality: number; // 0-100
  compression: number; // 0-9
  dithering: boolean;
  maxWidth?: number;
  maxHeight?: number;
  loopCount?: number;
  scale?: number;
  loopDelay?: number; // seconds
  format?: 'apng' | 'webm';
}
