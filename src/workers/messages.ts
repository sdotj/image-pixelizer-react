export type RGB = { r: number; g: number; b: number };

export type PaletteStylePreset =
  | "auto"
  | "portrait_warm"
  | "retro_comic"
  | "pico8"
  | "nes"
  | "gameboy"
  | "muted_pastel";

export type ProcessPixelArtRequest = {
  type: "PROCESS_PIXEL_ART";
  srcWidth: number;
  srcHeight: number;
  srcBuffer: ArrayBuffer;
  outWidth: number;
  outHeight: number;
  gridMax: 100 | 250;
  paletteSize: number;
  palettePreset: PaletteStylePreset;
  paletteSmoothing: boolean;
  polishedPortrait: boolean;
  ditherStrength: number;
  edgeEnabled: boolean;
  edgeThreshold: number;
};

export type ProcessPixelArtDoneMessage = {
  type: "PROCESS_PIXEL_ART_DONE";
  outWidth: number;
  outHeight: number;
  outBuffer: ArrayBuffer;
};
