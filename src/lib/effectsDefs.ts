import { EffectNode } from '../types';

export interface EffectDef {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultParams: Record<string, any>;
  uniforms: string[];
  fragmentSource: string;
  controls: EffectControlDef[]; // For UI rendering
}

export interface EffectControlDef {
  key: string;
  label: string;
  type: 'slider' | 'color' | 'checkbox' | 'select' | 'vector2';
  min?: number;
  max?: number;
  step?: number;
  options?: {label: string, value: any}[];
}

export const EFFECT_DEFS: EffectDef[] = [
  {
    id: 'blur',
    name: 'Gaussian Blur',
    category: 'Blur',
    description: 'Smooths the image',
    defaultParams: { amount: 5 },
    uniforms: ["u_resolution", "u_amount"],
    controls: [{ key: 'amount', label: 'Amount', type: 'slider', min: 0, max: 20, step: 0.1 }],
    fragmentSource: `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform float u_amount;
      varying vec2 v_texCoord;

      void main() {
        vec4 color = vec4(0.0);
        float total = 0.0;
        float radius = u_amount / u_resolution.x;
        // Simple fast blur approximation in one pass since WebGL1 doesn't easily do separated pass in a single invocation without pingpong
        for(float x = -2.0; x <= 2.0; x++) {
          for(float y = -2.0; y <= 2.0; y++) {
             color += texture2D(u_image, v_texCoord + vec2(x, y) * radius);
             total += 1.0;
          }
        }
        gl_FragColor = color / total;
      }
    `
  },
  {
    id: 'waveWarp',
    name: 'Wave Warp',
    category: 'Distortion',
    description: 'Creates a rippling effect',
    defaultParams: { amount: 0.05, speed: 1.0, frequency: 10.0 },
    uniforms: ["u_time", "u_amount", "u_speed", "u_frequency"],
    controls: [
      { key: 'amount', label: 'Amount', type: 'slider', min: 0, max: 0.5, step: 0.01 },
      { key: 'speed', label: 'Speed', type: 'slider', min: 0, max: 5.0, step: 0.1 },
      { key: 'frequency', label: 'Frequency', type: 'slider', min: 0, max: 50.0, step: 0.1 }
    ],
    fragmentSource: `
      precision mediump float;
      uniform sampler2D u_image;
      uniform float u_time;
      uniform float u_amount;
      uniform float u_speed;
      uniform float u_frequency;
      varying vec2 v_texCoord;

      void main() {
        vec2 uv = v_texCoord;
        uv.x += sin(uv.y * u_frequency + u_time * u_speed) * u_amount;
        gl_FragColor = texture2D(u_image, uv);
      }
    `
  },
  {
    id: 'glitch',
    name: 'Glitch',
    category: 'Social/Viral',
    description: 'Digital displacement effect',
    defaultParams: { intensity: 0.02 },
    uniforms: ["u_time", "u_intensity"],
    controls: [{ key: 'intensity', label: 'Intensity', type: 'slider', min: 0, max: 0.2, step: 0.001 }],
    fragmentSource: `
      precision mediump float;
      uniform sampler2D u_image;
      uniform float u_time;
      uniform float u_intensity;
      varying vec2 v_texCoord;

      float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

      void main() {
        vec2 uv = v_texCoord;
        float shift = (rand(vec2(floor(uv.y * 50.0), u_time)) - 0.5) * u_intensity;
        vec4 r = texture2D(u_image, vec2(uv.x + shift, uv.y));
        vec4 g = texture2D(u_image, vec2(uv.x, uv.y));
        vec4 b = texture2D(u_image, vec2(uv.x - shift, uv.y));
        gl_FragColor = vec4(r.r, g.g, b.b, g.a);
      }
    `
  },
  {
    id: 'posterize',
    name: 'Posterize',
    category: 'Stylize',
    description: 'Reduces color depth',
    defaultParams: { levels: 4 },
    uniforms: ["u_levels"],
    controls: [{ key: 'levels', label: 'Levels', type: 'slider', min: 2, max: 32, step: 1 }],
    fragmentSource: `
      precision mediump float;
      uniform sampler2D u_image;
      uniform float u_levels;
      varying vec2 v_texCoord;

      void main() {
        vec4 c = texture2D(u_image, v_texCoord);
        c.rgb = floor(c.rgb * u_levels) / u_levels;
        gl_FragColor = c;
      }
    `
  },
  {
    id: 'chromaKey',
    name: 'Chroma Key',
    category: 'Keying',
    description: 'Removes a specific color',
    defaultParams: { keyColor: [0, 1, 0], similarity: 0.4, smoothness: 0.1 },
    uniforms: ["u_keyColor", "u_similarity", "u_smoothness"],
    controls: [
       { key: 'similarity', label: 'Similarity', type: 'slider', min: 0, max: 1, step: 0.01 },
       { key: 'smoothness', label: 'Smoothness', type: 'slider', min: 0, max: 1, step: 0.01 }
       // Color picker can be added later
    ],
    fragmentSource: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec3 u_keyColor;
        uniform float u_similarity;
        uniform float u_smoothness;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float chromaDist = distance(color.rgb, u_keyColor);
            float baseMask = chromaDist - u_similarity;
            float fullMask = pow(clamp(baseMask / u_smoothness, 0.0, 1.0), 1.5);
            gl_FragColor = vec4(color.rgb, color.a * fullMask);
        }
    `
  },
  {
    id: 'mosaic',
    name: 'Mosaic',
    category: 'Stylize',
    description: 'Pixelates the image',
    defaultParams: { size: 10 },
    uniforms: ["u_resolution", "u_size"],
    controls: [{ key: 'size', label: 'Block Size', type: 'slider', min: 1, max: 100, step: 1 }],
    fragmentSource: `
      precision mediump float;
      uniform sampler2D u_image;
      uniform vec2 u_resolution;
      uniform float u_size;
      varying vec2 v_texCoord;

      void main() {
        vec2 grid = vec2(u_size) / u_resolution;
        vec2 uv = floor(v_texCoord / grid) * grid + grid / 2.0;
        gl_FragColor = texture2D(u_image, uv);
      }
    `
  },
  {
    id: 'lensDistortion',
    name: 'Lens Distortion',
    category: 'Distortion',
    description: 'Simulates lens curvature',
    defaultParams: { distortion: -0.2 },
    uniforms: ["u_distortion"],
    controls: [{ key: 'distortion', label: 'Distortion', type: 'slider', min: -1.0, max: 1.0, step: 0.01 }],
    fragmentSource: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_distortion;
        varying vec2 v_texCoord;

        void main() {
            vec2 p = v_texCoord - 0.5;
            float p2 = dot(p, p);
            vec2 uv = v_texCoord + p * p2 * u_distortion;
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                gl_FragColor = vec4(0.0);
            } else {
                gl_FragColor = texture2D(u_image, uv);
            }
        }
    `
  }
];

export const TRANSITION_DEFS = [
  { id: 'cut', name: 'Cut', category: 'Basic' },
  { id: 'cross-dissolve', name: 'Cross Dissolve', category: 'Basic' },
  { id: 'slide-left', name: 'Slide Left', category: 'Slide' },
  { id: 'slide-right', name: 'Slide Right', category: 'Slide' },
  { id: 'zoom-in', name: 'Zoom In', category: 'Zoom' },
  { id: 'blur', name: 'Blur Transition', category: 'Stylize' },
  { id: 'glitch', name: 'Glitch Transition', category: 'Stylize' },
  { id: 'pulse', name: 'Pulse', category: 'Stylize' },
  { id: 'wipe', name: 'Wipe', category: 'Basic' },
  { id: 'iris', name: 'Iris', category: 'Basic' },
  { id: 'rotate', name: 'Rotate', category: 'Transform' },
  { id: 'spiral', name: 'Spiral', category: 'Transform' }
];

export const MOTION_PRESETS = [
  { id: 'fly-in', name: 'Fly In', category: 'In' },
  { id: 'fade-in', name: 'Fade In', category: 'In' },
  { id: 'bounce', name: 'Bounce', category: 'In' },
  { id: 'scale-up', name: 'Scale Up', category: 'In' },
  { id: 'swipe', name: 'Swipe', category: 'In' }
];
