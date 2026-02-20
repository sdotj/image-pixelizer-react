import type {
  PaletteStylePreset,
  ProcessPixelArtDoneMessage,
  ProcessPixelArtRequest,
  RGB,
} from "./messages";

// --------------------- helpers ---------------------

function clamp255(x: number) {
  return x < 0 ? 0 : x > 255 ? 255 : x;
}

function fitWithin(srcW: number, srcH: number, max: number) {
  const scale = Math.min(max / srcW, max / srcH, 1);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  return { w, h };
}

const PRESET_PALETTES: Record<Exclude<PaletteStylePreset, "auto">, RGB[]> = {
  portrait_warm: [
    { r: 255, g: 234, b: 210 },
    { r: 248, g: 206, b: 174 },
    { r: 231, g: 175, b: 145 },
    { r: 212, g: 145, b: 118 },
    { r: 184, g: 113, b: 96 },
    { r: 146, g: 84, b: 72 },
    { r: 113, g: 62, b: 58 },
    { r: 82, g: 46, b: 50 },
    { r: 58, g: 33, b: 38 },
    { r: 37, g: 24, b: 30 },
  ],
  retro_comic: [
    { r: 255, g: 244, b: 219 },
    { r: 255, g: 210, b: 74 },
    { r: 255, g: 129, b: 65 },
    { r: 233, g: 62, b: 89 },
    { r: 162, g: 54, b: 129 },
    { r: 82, g: 64, b: 189 },
    { r: 45, g: 134, b: 196 },
    { r: 64, g: 200, b: 162 },
    { r: 104, g: 207, b: 98 },
    { r: 31, g: 38, b: 56 },
    { r: 94, g: 104, b: 124 },
    { r: 228, g: 235, b: 245 },
  ],
  pico8: [
    { r: 0, g: 0, b: 0 },
    { r: 29, g: 43, b: 83 },
    { r: 126, g: 37, b: 83 },
    { r: 0, g: 135, b: 81 },
    { r: 171, g: 82, b: 54 },
    { r: 95, g: 87, b: 79 },
    { r: 194, g: 195, b: 199 },
    { r: 255, g: 241, b: 232 },
    { r: 255, g: 0, b: 77 },
    { r: 255, g: 163, b: 0 },
    { r: 255, g: 236, b: 39 },
    { r: 0, g: 228, b: 54 },
    { r: 41, g: 173, b: 255 },
    { r: 131, g: 118, b: 156 },
    { r: 255, g: 119, b: 168 },
    { r: 255, g: 204, b: 170 },
  ],
  nes: [
    { r: 124, g: 124, b: 124 },
    { r: 0, g: 0, b: 252 },
    { r: 0, g: 0, b: 188 },
    { r: 68, g: 40, b: 188 },
    { r: 148, g: 0, b: 132 },
    { r: 168, g: 0, b: 32 },
    { r: 168, g: 16, b: 0 },
    { r: 136, g: 20, b: 0 },
    { r: 80, g: 48, b: 0 },
    { r: 0, g: 120, b: 0 },
    { r: 0, g: 104, b: 0 },
    { r: 0, g: 88, b: 0 },
    { r: 0, g: 64, b: 88 },
    { r: 0, g: 0, b: 0 },
    { r: 188, g: 188, b: 188 },
    { r: 248, g: 248, b: 248 },
  ],
  gameboy: [
    { r: 15, g: 56, b: 15 },
    { r: 48, g: 98, b: 48 },
    { r: 139, g: 172, b: 15 },
    { r: 155, g: 188, b: 15 },
  ],
  muted_pastel: [
    { r: 244, g: 232, b: 226 },
    { r: 228, g: 205, b: 200 },
    { r: 214, g: 187, b: 202 },
    { r: 196, g: 186, b: 222 },
    { r: 182, g: 197, b: 230 },
    { r: 178, g: 211, b: 214 },
    { r: 188, g: 216, b: 188 },
    { r: 212, g: 219, b: 176 },
    { r: 232, g: 214, b: 170 },
    { r: 211, g: 181, b: 168 },
    { r: 162, g: 150, b: 160 },
    { r: 114, g: 110, b: 124 },
  ],
};

// Bilinear downscale from src -> dst
function resizeBilinearRGBA(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);

  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const sy = (y + 0.5) * yRatio - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(srcH - 1, y0 + 1);
    const ty = sy - y0;

    for (let x = 0; x < dstW; x++) {
      const sx = (x + 0.5) * xRatio - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(srcW - 1, x0 + 1);
      const tx = sx - x0;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      const di = (y * dstW + x) * 4;

      for (let c = 0; c < 4; c++) {
        const v00 = src[i00 + c];
        const v10 = src[i10 + c];
        const v01 = src[i01 + c];
        const v11 = src[i11 + c];

        const v0 = v00 + (v10 - v00) * tx;
        const v1 = v01 + (v11 - v01) * tx;
        dst[di + c] = clamp255(v0 + (v1 - v0) * ty);
      }
    }
  }

  return dst;
}

// Nearest-neighbor upscale from small -> output
function upscaleNearestRGBA(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  outW: number,
  outH: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(outW * outH * 4);

  for (let y = 0; y < outH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / outH));
    for (let x = 0; x < outW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / outW));
      const si = (sy * srcW + sx) * 4;
      const di = (y * outW + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }

  return out;
}

function edgeAwarePrefilterRGBA(
  src: Uint8ClampedArray,
  w: number,
  h: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const kernel = [
    1, 2, 1,
    2, 4, 2,
    1, 2, 1,
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = src[i + 3];
      out[i + 3] = a;
      if (a < 10) continue;

      const cR = src[i];
      const cG = src[i + 1];
      const cB = src[i + 2];
      const cLum = (0.2126 * cR + 0.7152 * cG + 0.0722 * cB) / 255;

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumW = 0;
      let k = 0;

      for (let oy = -1; oy <= 1; oy++) {
        const sy = Math.max(0, Math.min(h - 1, y + oy));
        for (let ox = -1; ox <= 1; ox++) {
          const sx = Math.max(0, Math.min(w - 1, x + ox));
          const si = (sy * w + sx) * 4;
          const sa = src[si + 3];
          const spatialW = kernel[k++];
          if (sa < 10) continue;

          const r = src[si];
          const g = src[si + 1];
          const b = src[si + 2];
          const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          const lumDiff = Math.abs(cLum - lum);
          const rgbDiff = Math.abs(cR - r) + Math.abs(cG - g) + Math.abs(cB - b);

          // Keep blending inside tonal regions, reject cross-edge mixing.
          if (lumDiff > 0.15 || rgbDiff > 95) continue;

          const rangeW = 1 - lumDiff / 0.15;
          const wAll = spatialW * rangeW;
          sumR += r * wAll;
          sumG += g * wAll;
          sumB += b * wAll;
          sumW += wAll;
        }
      }

      if (sumW <= 0.0001) {
        out[i] = cR;
        out[i + 1] = cG;
        out[i + 2] = cB;
        continue;
      }

      // Keep prefilter conservative: only partial blend toward local smooth estimate.
      const avgR = sumR / sumW;
      const avgG = sumG / sumW;
      const avgB = sumB / sumW;
      out[i] = clamp255(cR * 0.55 + avgR * 0.45);
      out[i + 1] = clamp255(cG * 0.55 + avgG * 0.45);
      out[i + 2] = clamp255(cB * 0.55 + avgB * 0.45);
    }
  }

  return out;
}

// --------------------- Median Cut palette ---------------------
// Simple + solid median-cut quantizer in RGB space
type Color = { r: number; g: number; b: number };

type Box = {
  colors: Color[];
  rMin: number; rMax: number;
  gMin: number; gMax: number;
  bMin: number; bMax: number;
};

function computeBox(colors: Color[]): Box {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (const c of colors) {
    if (c.r < rMin) rMin = c.r;
    if (c.r > rMax) rMax = c.r;
    if (c.g < gMin) gMin = c.g;
    if (c.g > gMax) gMax = c.g;
    if (c.b < bMin) bMin = c.b;
    if (c.b > bMax) bMax = c.b;
  }
  return { colors, rMin, rMax, gMin, gMax, bMin, bMax };
}

function boxRange(box: Box) {
  return {
    r: box.rMax - box.rMin,
    g: box.gMax - box.gMin,
    b: box.bMax - box.bMin,
  };
}

function splitBox(box: Box): [Box, Box] {
  const range = boxRange(box);
  let channel: "r" | "g" | "b" = "r";
  if (range.g >= range.r && range.g >= range.b) channel = "g";
  else if (range.b >= range.r && range.b >= range.g) channel = "b";

  const sorted = box.colors.slice().sort((a, b) => a[channel] - b[channel]);
  const mid = Math.floor(sorted.length / 2);

  return [computeBox(sorted.slice(0, mid)), computeBox(sorted.slice(mid))];
}

function averageColor(colors: Color[]): RGB {
  let r = 0, g = 0, b = 0;
  for (const c of colors) {
    r += c.r; g += c.g; b += c.b;
  }
  const n = Math.max(1, colors.length);
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function medianCutPalette(pixels: Uint8ClampedArray, w: number, h: number, k: number): RGB[] {
  // sample pixels lightly to keep it snappy (especially at 250x250)
  const colors: Color[] = [];
  const stride = w * h > 20000 ? 2 : 1; // cheap adaptive sampling

  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      const i = (y * w + x) * 4;
      const a = pixels[i + 3];
      if (a < 10) continue;
      colors.push({ r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] });
    }
  }

  if (colors.length === 0) return [{ r: 0, g: 0, b: 0 }];

  const boxes: Box[] = [computeBox(colors)];

  while (boxes.length < k) {
    // pick box with largest range to split
    boxes.sort((A, B) => {
      const rA = boxRange(A); const rB = boxRange(B);
      const mA = Math.max(rA.r, rA.g, rA.b);
      const mB = Math.max(rB.r, rB.g, rB.b);
      return mB - mA;
    });

    const box = boxes.shift();
    if (!box || box.colors.length < 2) break;

    const [b1, b2] = splitBox(box);
    boxes.push(b1, b2);
  }

  const palette = boxes.map((b) => averageColor(b.colors));
  return palette.slice(0, k);
}

// --------------------- LAB + ΔE00 (for perceptual matching) ---------------------

type Lab = { L: number; a: number; b: number };

function srgbToLinear(u: number) {
  const x = u / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
const REF_X = 0.95047;
const REF_Y = 1.0;
const REF_Z = 1.08883;
function fLab(t: number) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}
function rgbToLab(rgb: RGB): Lab {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

  const fx = fLab(X / REF_X);
  const fy = fLab(Y / REF_Y);
  const fz = fLab(Z / REF_Z);

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
function deg2rad(d: number) { return (d * Math.PI) / 180; }
function rad2deg(r: number) { return (r * 180) / Math.PI; }

function deltaE00(lab1: Lab, lab2: Lab): number {
  const L1 = lab1.L, a1 = lab1.a, b1 = lab1.b;
  const L2 = lab2.L, a2 = lab2.a, b2 = lab2.b;

  const avgLp = (L1 + L2) / 2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (C1p + C2p) / 2;

  const h1p = Math.atan2(b1, a1p);
  const h2p = Math.atan2(b2, a2p);
  const h1pDeg = (rad2deg(h1p) + 360) % 360;
  const h2pDeg = (rad2deg(h2p) + 360) % 360;

  let deltahpDeg = 0;
  if (C1p * C2p !== 0) {
    const diff = h2pDeg - h1pDeg;
    if (Math.abs(diff) <= 180) deltahpDeg = diff;
    else if (diff > 180) deltahpDeg = diff - 360;
    else deltahpDeg = diff + 360;
  }

  const deltaLp = L2 - L1;
  const deltaCp = C2p - C1p;
  const deltaHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(deltahpDeg / 2));

  let avgHpDeg = 0;
  if (C1p * C2p === 0) avgHpDeg = h1pDeg + h2pDeg;
  else {
    const diff = Math.abs(h1pDeg - h2pDeg);
    if (diff <= 180) avgHpDeg = (h1pDeg + h2pDeg) / 2;
    else {
      avgHpDeg = (h1pDeg + h2pDeg + 360) / 2;
      if (h1pDeg + h2pDeg >= 360) avgHpDeg -= 180;
    }
  }

  const T =
    1
    - 0.17 * Math.cos(deg2rad(avgHpDeg - 30))
    + 0.24 * Math.cos(deg2rad(2 * avgHpDeg))
    + 0.32 * Math.cos(deg2rad(3 * avgHpDeg + 6))
    - 0.20 * Math.cos(deg2rad(4 * avgHpDeg - 63));

  const deltaTheta = 30 * Math.exp(-Math.pow((avgHpDeg - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(avgLp - 50, 2)) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const Sc = 1 + 0.045 * avgCp;
  const Sh = 1 + 0.015 * avgCp * T;
  const Rt = -Math.sin(deg2rad(2 * deltaTheta)) * Rc;

  return Math.sqrt(
    Math.pow(deltaLp / Sl, 2) +
    Math.pow(deltaCp / Sc, 2) +
    Math.pow(deltaHp / Sh, 2) +
    Rt * (deltaCp / Sc) * (deltaHp / Sh)
  );
}

type PaletteLabEntry = { rgb: RGB; lab: Lab };
function buildPaletteLab(palette: RGB[]): PaletteLabEntry[] {
  return palette.map((rgb) => ({ rgb, lab: rgbToLab(rgb) }));
}
function nearestPaletteIndex(c: RGB, paletteLab: PaletteLabEntry[]): number {
  const labC = rgbToLab(c);
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < paletteLab.length; i++) {
    const d = deltaE00(labC, paletteLab[i].lab);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

function blendRgb(a: RGB, b: RGB, t: number): RGB {
  return {
    r: clamp255(a.r + (b.r - a.r) * t),
    g: clamp255(a.g + (b.g - a.g) * t),
    b: clamp255(a.b + (b.b - a.b) * t),
  };
}

function samplePaletteRamp(palette: RGB[], targetSize: number): RGB[] {
  if (palette.length === 0) return [{ r: 0, g: 0, b: 0 }];
  if (targetSize <= 1) return [palette[0]];
  if (palette.length === targetSize) return palette.slice();

  const out: RGB[] = [];
  const maxSrcIndex = palette.length - 1;

  for (let i = 0; i < targetSize; i++) {
    const pos = (i * maxSrcIndex) / (targetSize - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(maxSrcIndex, i0 + 1);
    const t = pos - i0;
    out.push(blendRgb(palette[i0], palette[i1], t));
  }

  return out;
}

function mergeNearDuplicateColors(palette: RGB[], thresholdDE = 6): RGB[] {
  type Cluster = { sumR: number; sumG: number; sumB: number; count: number; lab: Lab };
  const clusters: Cluster[] = [];

  for (const color of palette) {
    const lab = rgbToLab(color);
    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < clusters.length; i++) {
      const d = deltaE00(lab, clusters[i].lab);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0 && bestDistance <= thresholdDE) {
      const cluster = clusters[bestIndex];
      cluster.sumR += color.r;
      cluster.sumG += color.g;
      cluster.sumB += color.b;
      cluster.count += 1;

      const avg: RGB = {
        r: Math.round(cluster.sumR / cluster.count),
        g: Math.round(cluster.sumG / cluster.count),
        b: Math.round(cluster.sumB / cluster.count),
      };
      cluster.lab = rgbToLab(avg);
      continue;
    }

    clusters.push({
      sumR: color.r,
      sumG: color.g,
      sumB: color.b,
      count: 1,
      lab,
    });
  }

  return clusters.map((cluster) => ({
    r: Math.round(cluster.sumR / cluster.count),
    g: Math.round(cluster.sumG / cluster.count),
    b: Math.round(cluster.sumB / cluster.count),
  }));
}

function withTargetLuminance(color: RGB, targetLuminance01: number): RGB {
  const current = Math.max(0.001, luminance(color));
  const scale = targetLuminance01 / current;
  return {
    r: clamp255(color.r * scale),
    g: clamp255(color.g * scale),
    b: clamp255(color.b * scale),
  };
}

function enforceLightToDarkRamp(palette: RGB[]): RGB[] {
  if (palette.length <= 2) return palette.slice().sort((a, b) => luminance(a) - luminance(b));

  const sorted = palette.slice().sort((a, b) => luminance(a) - luminance(b));
  const low = luminance(sorted[0]);
  const high = Math.max(luminance(sorted[sorted.length - 1]), low + 0.35);
  const span = Math.max(0.2, high - low);

  return sorted.map((color, index) => {
    const t = index / (sorted.length - 1);
    const targetL = Math.min(1, low + span * t);
    const adjusted = withTargetLuminance(color, targetL);
    return blendRgb(color, adjusted, 0.55);
  });
}

function buildPaletteFromPreset(preset: PaletteStylePreset): RGB[] {
  if (preset === "auto") return [];
  return PRESET_PALETTES[preset].slice();
}

function buildPalette(req: ProcessPixelArtRequest, small: Uint8ClampedArray, w: number, h: number): RGB[] {
  const basePalette =
    req.palettePreset === "auto"
      ? medianCutPalette(small, w, h, req.paletteSize)
      : buildPaletteFromPreset(req.palettePreset);

  if (!req.paletteSmoothing) return basePalette;

  const merged = mergeNearDuplicateColors(basePalette, 6);
  const ramped = enforceLightToDarkRamp(merged);
  const targetSize = req.palettePreset === "auto" ? req.paletteSize : basePalette.length;
  return samplePaletteRamp(ramped, targetSize);
}

function clampInt(x: number, min: number, max: number) {
  return x < min ? min : x > max ? max : x;
}

function paintIndexedPixels(
  outSmall: Uint8ClampedArray,
  idx: Uint8Array,
  palette: RGB[],
  w: number,
  h: number
) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = outSmall[i + 3];
      if (a < 10) continue;
      const p = palette[idx[y * w + x]];
      outSmall[i] = p.r;
      outSmall[i + 1] = p.g;
      outSmall[i + 2] = p.b;
    }
  }
}

function conservativeSmoothIndices(
  idx: Uint8Array,
  palette: RGB[],
  paletteLab: PaletteLabEntry[],
  w: number,
  h: number,
  edgeThreshold: number
): Uint8Array<ArrayBuffer> {
  if (w < 3 || h < 3 || palette.length < 2) {
    const passthrough = new Uint8Array(idx.length);
    passthrough.set(idx);
    return passthrough;
  }

  const sortedByL = palette
    .map((c, i) => ({ i, L: luminance(c) }))
    .sort((a, b) => a.L - b.L);
  const rankToIndex = new Uint8Array(sortedByL.length);
  const indexToRank = new Uint8Array(sortedByL.length);
  for (let r = 0; r < sortedByL.length; r++) {
    rankToIndex[r] = sortedByL[r].i;
    indexToRank[sortedByL[r].i] = r;
  }

  const out = new Uint8Array(idx.length);
  out.set(idx);
  const preserveContrast = Math.max(0.12, edgeThreshold * 0.75);
  const neighbors = new Uint8Array(8);
  const counts = new Uint8Array(256);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const center = idx[i];
      const centerLum = luminance(palette[center]);

      neighbors[0] = idx[i - w - 1];
      neighbors[1] = idx[i - w];
      neighbors[2] = idx[i - w + 1];
      neighbors[3] = idx[i - 1];
      neighbors[4] = idx[i + 1];
      neighbors[5] = idx[i + w - 1];
      neighbors[6] = idx[i + w];
      neighbors[7] = idx[i + w + 1];

      let maxContrast = 0;
      let rankSum = 0;
      for (let n = 0; n < 8; n++) {
        const ni = neighbors[n];
        const d = Math.abs(centerLum - luminance(palette[ni]));
        if (d > maxContrast) maxContrast = d;
        rankSum += indexToRank[ni];
      }
      if (maxContrast >= preserveContrast) continue;

      counts.fill(0);
      let modeIndex = center;
      let modeCount = 0;
      for (let n = 0; n < 8; n++) {
        const ni = neighbors[n];
        const next = counts[ni] + 1;
        counts[ni] = next;
        if (next > modeCount) {
          modeCount = next;
          modeIndex = ni;
        }
      }

      // Only fix obvious speckles: center differs, surrounded heavily by one tone.
      if (modeIndex !== center && modeCount >= 6) {
        const d = deltaE00(paletteLab[center].lab, paletteLab[modeIndex].lab);
        if (d <= 12) {
          out[i] = modeIndex;
          continue;
        }
      }

      // Tiny ramp correction: allow at most a one-rank shift toward neighborhood average.
      const avgRank = Math.round(rankSum / 8);
      const centerRank = indexToRank[center];
      if (Math.abs(avgRank - centerRank) <= 1 || rankToIndex.length < 3) continue;

      const targetRank = clampInt(
        centerRank + (avgRank > centerRank ? 1 : -1),
        0,
        rankToIndex.length - 1
      );
      const targetIndex = rankToIndex[targetRank];
      const d = deltaE00(paletteLab[center].lab, paletteLab[targetIndex].lab);
      if (d <= 8) out[i] = targetIndex;
    }
  }

  return out;
}

// --------------------- Ordered dithering (subtle) ---------------------

// 4x4 Bayer matrix values 0..15
const BAYER_4 = [
  0,  8,  2, 10,
  12, 4, 14, 6,
  3, 11, 1,  9,
  15, 7, 13, 5,
];

function ditherNudge(x: number, y: number, strength: number) {
  // map bayer to [-0.5, +0.5], then scale to ~[-strength*255, +strength*255]
  const v = BAYER_4[(y & 3) * 4 + (x & 3)] / 15;
  const centered = v - 0.5;
  return centered * strength * 255;
}

// --------------------- Outline pass (pixel-art boundaries) ---------------------

function luminance(rgb: RGB) {
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

function darkestPaletteColor(palette: RGB[]): RGB {
  let best = palette[0];
  let bestL = Infinity;
  for (const c of palette) {
    const L = luminance(c);
    if (L < bestL) {
      bestL = L;
      best = c;
    }
  }
  return best;
}

// Mark edges where neighboring palette indices differ AND luminance contrast is high enough
function applyOutlines(
  idx: Uint8Array,
  palette: RGB[],
  w: number,
  h: number,
  threshold01: number
) {
  const out = idx.slice();
  const outline = darkestPaletteColor(palette);

  // find the outline index (or append if not present)
  let outlineIndex = palette.findIndex(
    (c) => c.r === outline.r && c.g === outline.g && c.b === outline.b
  );
  if (outlineIndex < 0) outlineIndex = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const here = idx[i];

      const n = idx[i - w];
      const s = idx[i + w];
      const e = idx[i + 1];
      const wv = idx[i - 1];

      if (here !== n || here !== s || here !== e || here !== wv) {
        const cHere = palette[here];
        // compute max contrast among neighbors
        let maxContrast = 0;
        const Lh = luminance(cHere);
        const Ls = [palette[n], palette[s], palette[e], palette[wv]].map(luminance);
        for (const Ln of Ls) {
          const d = Math.abs(Lh - Ln);
          if (d > maxContrast) maxContrast = d;
        }
        if (maxContrast >= threshold01) {
          out[i] = outlineIndex;
        }
      }
    }
  }

  return out;
}

function cleanupTinyIslands(idx: Uint8Array, paletteLab: PaletteLabEntry[], w: number, h: number) {
  const out = new Uint8Array(idx.length);
  out.set(idx);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const center = idx[i];

      const n = idx[i - w];
      const s = idx[i + w];
      const e = idx[i + 1];
      const wv = idx[i - 1];

      // Cross-neighbor majority indicates center is a tiny island.
      let mode = center;
      let modeCount = 0;
      const candidates = [n, s, e, wv];
      for (let ci = 0; ci < candidates.length; ci++) {
        const c = candidates[ci];
        let count = 1;
        for (let cj = ci + 1; cj < candidates.length; cj++) {
          if (candidates[cj] === c) count++;
        }
        if (count > modeCount) {
          mode = c;
          modeCount = count;
        }
      }

      if (mode !== center && modeCount >= 3) {
        const d = deltaE00(paletteLab[center].lab, paletteLab[mode].lab);
        if (d <= 16) out[i] = mode;
      }
    }
  }

  return out;
}

function applySelectiveOutlines(
  idx: Uint8Array,
  palette: RGB[],
  w: number,
  h: number,
  threshold01: number
) {
  const stricterThreshold = Math.max(0.3, threshold01 + 0.08);
  const out = idx.slice();
  const outline = darkestPaletteColor(palette);

  let outlineIndex = palette.findIndex(
    (c) => c.r === outline.r && c.g === outline.g && c.b === outline.b
  );
  if (outlineIndex < 0) outlineIndex = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const here = idx[i];
      const neighbors = [idx[i - w], idx[i + w], idx[i - 1], idx[i + 1]];

      let diffCount = 0;
      for (let ni = 0; ni < neighbors.length; ni++) {
        if (neighbors[ni] !== here) diffCount++;
      }
      if (diffCount < 2) continue;

      const Lh = luminance(palette[here]);
      let maxContrast = 0;
      for (let ni = 0; ni < neighbors.length; ni++) {
        const d = Math.abs(Lh - luminance(palette[neighbors[ni]]));
        if (d > maxContrast) maxContrast = d;
      }

      if (maxContrast >= stricterThreshold) out[i] = outlineIndex;
    }
  }

  return out;
}

// --------------------- main pipeline ---------------------

function processPixelArt(req: ProcessPixelArtRequest): ProcessPixelArtDoneMessage {
  const src = new Uint8ClampedArray(req.srcBuffer);

  // 1) downscale to grid (fit within NxN)
  const grid = fitWithin(req.srcWidth, req.srcHeight, req.gridMax);
  const small = resizeBilinearRGBA(src, req.srcWidth, req.srcHeight, grid.w, grid.h);
  const prepared = req.polishedPortrait ? edgeAwarePrefilterRGBA(small, grid.w, grid.h) : small;

  // 2) generate palette from image or fixed preset
  const palette = buildPalette(req, prepared, grid.w, grid.h);
  const paletteLab = buildPaletteLab(palette);

  // 3) quantize small image to palette indices (with optional ordered dithering)
  const idx = new Uint8Array(grid.w * grid.h);
  const outSmall = new Uint8ClampedArray(grid.w * grid.h * 4);

  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const i = (y * grid.w + x) * 4;
      const a = prepared[i + 3];
      outSmall[i + 3] = a;

      if (a < 10) {
        outSmall[i] = 0;
        outSmall[i + 1] = 0;
        outSmall[i + 2] = 0;
        idx[y * grid.w + x] = 0;
        continue;
      }

      // subtle ordered dithering nudges RGB before lookup
      const ditherStrength = req.polishedPortrait ? req.ditherStrength * 0.7 : req.ditherStrength;
      const n = ditherStrength > 0 ? ditherNudge(x, y, ditherStrength) : 0;

      const c: RGB = {
        r: clamp255(prepared[i] + n),
        g: clamp255(prepared[i + 1] + n),
        b: clamp255(prepared[i + 2] + n),
      };

      const pi = nearestPaletteIndex(c, paletteLab);
      idx[y * grid.w + x] = pi;

      const p = palette[pi];
      outSmall[i] = p.r;
      outSmall[i + 1] = p.g;
      outSmall[i + 2] = p.b;
    }
  }

  // 4) optional conservative smoothing to clean noisy speckles
  let finalIdx = idx;
  if (req.paletteSmoothing) {
    finalIdx = conservativeSmoothIndices(
      finalIdx,
      palette,
      paletteLab,
      grid.w,
      grid.h,
      req.edgeThreshold
    );
    paintIndexedPixels(outSmall, finalIdx, palette, grid.w, grid.h);
  }

  // 5) portrait mode cleanup for micro-islands after smoothing/quantization
  if (req.polishedPortrait) {
    finalIdx = cleanupTinyIslands(finalIdx, paletteLab, grid.w, grid.h);
    paintIndexedPixels(outSmall, finalIdx, palette, grid.w, grid.h);
  }

  // 6) outline pass (on indices), then write colors back if enabled
  if (req.edgeEnabled) {
    finalIdx = req.polishedPortrait
      ? applySelectiveOutlines(finalIdx, palette, grid.w, grid.h, req.edgeThreshold)
      : applyOutlines(finalIdx, palette, grid.w, grid.h, req.edgeThreshold);
    paintIndexedPixels(outSmall, finalIdx, palette, grid.w, grid.h);
  }

  // 7) upscale to output size (nearest neighbor for crisp pixels)
  const out = upscaleNearestRGBA(outSmall, grid.w, grid.h, req.outWidth, req.outHeight);

  return {
    type: "PROCESS_PIXEL_ART_DONE",
    outWidth: req.outWidth,
    outHeight: req.outHeight,
    outBuffer: out.buffer as ArrayBuffer,
  };
}

// --------------------- message handler ---------------------

self.onmessage = (e: MessageEvent<ProcessPixelArtRequest>) => {
  const msg = e.data;

  if (msg.type === "PROCESS_PIXEL_ART") {
    const resp = processPixelArt(msg);

    // Transfer output buffer back
    (self as unknown as Worker).postMessage(resp, [resp.outBuffer]);
  }
};
