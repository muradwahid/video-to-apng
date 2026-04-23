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
}

export interface TimelineState {
  clips: VideoClip[];
  assets: MediaAsset[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  zoomLevel: number;
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
