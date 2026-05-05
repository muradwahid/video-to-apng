export interface Keyframe {
  id: string;
  time: number; // Time relative to clip start (0 to duration)
  properties: {
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
    opacity?: number;
  };
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier';
  bezierParams?: [number, number, number, number];
}

export interface GraphicLayer {
  id: string;
  type: 'text' | 'image' | 'shape';
  name: string;
  isVisible: boolean;
  isLocked: boolean;
  transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
  keyframes?: Keyframe[]; // Layer animation
  text?: {
    content: string;
    fontFamily: string;
    fontSize: number;
    color: string;
    textAlign: 'left' | 'center' | 'right';
    bold: boolean;
    italic: boolean;
    fillType?: 'solid' | 'gradient';
    gradient?: { type: 'linear'|'radial', colors: string[] };
    depth?: number;
    perspective?: number;
    bevel?: number;
  };
  shape?: {
    type: 'rectangle' | 'ellipse' | 'polygon';
    fill: string;
    fillType?: 'solid' | 'gradient';
    gradient?: { type: 'linear'|'radial', colors: string[] };
    stroke: string;
    strokeWidth: number;
  };
  image?: {
    url: string;
  };
  animationPreset?: string; // e.g., 'Fly In', 'Fade', 'Scale Up', 'Slide', 'Bounce'
}

export interface EffectNode {
  id: string;
  type: string;
  enabled: boolean;
  params: Record<string, any>;
}

export interface VideoClip {
  id: string;
  name: string;
  url: string;
  type: 'video' | 'audio' | 'image' | 'text' | 'caption' | 'graphic';
  duration: number;
  startTime: number; // Start time on timeline (seconds)
  sourceStart: number; // Start time within source file
  sourceEnd: number; // End time within source file
  trackIndex: number;
  volume: number;
  speed: number;
  locked?: boolean;
  groupId?: string;
  keyframes?: Keyframe[];
  effects?: EffectNode[];
  text?: {
    content: string;
    fontFamily: string;
    fontSize: number;
    color: string;
    align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
    bold: boolean;
    italic: boolean;
    underline?: boolean;
    letterSpacing?: number;
    lineHeight?: number;
    stroke?: { color: string; width: number };
    backgroundColor?: string;
    backgroundPadding?: number;
    borderRadius?: number;
    shadow?: { color: string; angle: number; distance: number; blur: number };
    captionTrackId?: string; // used for captions
    depth?: number; // 3D depth
    perspective?: number; // 3D perspective
    bevel?: number; // 3D bevel
  };
  graphic?: {
    templateId?: string;
    layers: GraphicLayer[];
  };
  transform: {
    scale: number;
    rotation: number;
    x?: number;
    y?: number;
    opacity?: number;
    flipX?: boolean;
    flipY?: boolean;
    blendMode?: GlobalCompositeOperation;
    dropShadow?: {
      color: string;
      blur: number;
      x: number;
      y: number;
      opacity: number;
    };
    crop?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    mask?: {
      type: 'none' | 'circle' | 'square' | 'star' | 'heart' | 'triangle' | 'custom';
      path?: string;
      invert?: boolean;
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
    hueRotate?: number; // 0 default
    vignette: number;   // 0 default (strength)
    grain: number;      // 0 default (strength)
  };
  audio?: {
    category?: 'dialogue' | 'music' | 'sfx' | 'ambience';
    volume: number;
    fadeIn: number;
    fadeOut: number;
    muted: boolean;
    pan?: number; // -1 (left) to 1 (right)
    aiNoiseReduction?: boolean;
    eq?: {
      low: number;
      mid: number;
      high: number;
      bands?: { frequency: number, gain: number, type: BiquadFilterType, Q?: number }[];
    };
    compressor?: {
      enabled: boolean;
      threshold: number;
      ratio: number;
      attack: number;
      release: number;
      knee: number;
      makeupGain: number;
    };
    limiter?: {
      enabled: boolean;
      ceiling: number;
    };
    denoise?: {
      enabled: boolean;
      amount: number;
    };
    dereverb?: {
      enabled: boolean;
      amount: number;
    };
    effects?: {
      reverb: number;
      delay: number;
      pitch: number;
      chorus?: number;
      stereoWidth?: number;
    };
    routing?: 'mono' | 'stereo' | 'left' | 'right';
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
  proxyUrl?: string;
  proxyStatus?: 'generating' | 'ready' | 'failed';
  sourceSettings?: {
    colorSpace: 'rec709' | 'slog2' | 'vlog' | 'clog' | 'auto';
    gammaCurve: string;
    whiteBalance: number;
  };
  metadata?: {
    codec?: string;
    resolution?: string;
    fps?: number;
    colorSpace?: string;
    bitDepth?: number;
    sampleRate?: number;
    fileSize?: number;
    creationDate?: string;
    gps?: string;
    xmp?: string;
    tags?: string[];
    description?: string;
    labels?: string[];
  };
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

export interface Marker {
  id: string;
  time: number;
  name: string;
  color: string;
  notes: string;
}

export interface TimelineState {
  clips: VideoClip[];
  assets: MediaAsset[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackSpeed: number;
  toolMode: 'selection' | 'ripple' | 'roll' | 'slip' | 'slide' | 'razor' | 'rateStretch';
  selectedClipId: string | null;
  selectedClipIds: string[];
  selectedTransitionId?: string | null;
  zoomLevel: number;
  background: BackgroundConfig;
  transitions: Transition[];
  globalAudioMute?: boolean;
  masterVolume?: number; // dB or multiplier (default 1)
  markers?: Marker[];
  useProxies?: boolean;
  currentProjectId?: string | null;
  currentProjectName?: string;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
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
