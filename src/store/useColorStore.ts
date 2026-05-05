import { create } from 'zustand';

export interface ColorGradeState {
  // Basic Correction
  temperature: number;
  tint: number;
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  saturation: number;

  // Creative
  vibrance: number;
  sharpen: number;
  fadedFilm: number;

  // Lift, Gamma, Gain (Color Wheels) - rgb weights
  lift: [number, number, number];
  gamma: [number, number, number];
  gain: [number, number, number];
  
  // HSL Secondary
  secondaryHue: number;
  secondarySaturation: number;
  secondaryLightness: number;
  secondaryRange: number; // The width of the hue selection
  secondaryMask: boolean; // Show mask
  
  // Vignette
  vignetteAmount: number;
  vignetteMidpoint: number;
  vignetteRoundness: number;
  vignetteFeather: number;

  // Luts
  lutIntensity: number;
  lutUrl?: string;
  
  // Curves (simplification: points array for each channel and composite)
  curveRGB: [number, number][];
  curveR: [number, number][];
  curveG: [number, number][];
  curveB: [number, number][];

  // HDR
  colorSpace: 'Rec.709' | 'Rec.2020' | 'P3-D65' | 'sRGB';
}

const defaultColorGrade: ColorGradeState = {
  temperature: 0,
  tint: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  saturation: 1,

  vibrance: 0,
  sharpen: 0,
  fadedFilm: 0,

  lift: [0, 0, 0],
  gamma: [0, 0, 0],
  gain: [0, 0, 0],

  secondaryHue: 0,
  secondarySaturation: 0,
  secondaryLightness: 0,
  secondaryRange: 0.1,
  secondaryMask: false,

  vignetteAmount: 0,
  vignetteMidpoint: 50,
  vignetteRoundness: 50,
  vignetteFeather: 50,

  lutIntensity: 100,
  
  curveRGB: [[0, 0], [1, 1]],
  curveR: [[0, 0], [1, 1]],
  curveG: [[0, 0], [1, 1]],
  curveB: [[0, 0], [1, 1]],

  colorSpace: 'Rec.709'
};

interface ColorStore {
  grades: Record<string, ColorGradeState>;
  getGrade: (clipId: string) => ColorGradeState;
  updateGrade: (clipId: string, updates: Partial<ColorGradeState>) => void;
}

export const useColorStore = create<ColorStore>((set, get) => ({
  grades: {},
  getGrade: (clipId) => get().grades[clipId] || defaultColorGrade,
  updateGrade: (clipId, updates) => set((state) => ({
    grades: {
      ...state.grades,
      [clipId]: {
        ...(state.grades[clipId] || defaultColorGrade),
        ...updates
      }
    }
  }))
}));
