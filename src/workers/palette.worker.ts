import type {
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

// --------------------- main pipeline ---------------------

function processPixelArt(req: ProcessPixelArtRequest): ProcessPixelArtDoneMessage {
  const src = new Uint8ClampedArray(req.srcBuffer);

  // 1) downscale to grid (fit within NxN)
  const grid = fitWithin(req.srcWidth, req.srcHeight, req.gridMax);
  const small = resizeBilinearRGBA(src, req.srcWidth, req.srcHeight, grid.w, grid.h);

  // 2) generate palette from the small image (cleaner than sampling)
  const palette = medianCutPalette(small, grid.w, grid.h, req.paletteSize);
  const paletteLab = buildPaletteLab(palette);

  // 3) quantize small image to palette indices (with optional ordered dithering)
  const idx = new Uint8Array(grid.w * grid.h);
  const outSmall = new Uint8ClampedArray(grid.w * grid.h * 4);

  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const i = (y * grid.w + x) * 4;
      const a = small[i + 3];
      outSmall[i + 3] = a;

      if (a < 10) {
        outSmall[i] = 0;
        outSmall[i + 1] = 0;
        outSmall[i + 2] = 0;
        idx[y * grid.w + x] = 0;
        continue;
      }

      // subtle ordered dithering nudges RGB before lookup
      const n = req.ditherStrength > 0 ? ditherNudge(x, y, req.ditherStrength) : 0;

      const c: RGB = {
        r: clamp255(small[i] + n),
        g: clamp255(small[i + 1] + n),
        b: clamp255(small[i + 2] + n),
      };

      const pi = nearestPaletteIndex(c, paletteLab);
      idx[y * grid.w + x] = pi;

      const p = palette[pi];
      outSmall[i] = p.r;
      outSmall[i + 1] = p.g;
      outSmall[i + 2] = p.b;
    }
  }

  // 4) outline pass (on indices), then write colors back if enabled
  let finalIdx = idx;
  if (req.edgeEnabled) {
    finalIdx = applyOutlines(idx, palette, grid.w, grid.h, req.edgeThreshold);
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const pi = finalIdx[y * grid.w + x];
        const i = (y * grid.w + x) * 4;
        const a = outSmall[i + 3];
        if (a < 10) continue;
        const p = palette[pi];
        outSmall[i] = p.r;
        outSmall[i + 1] = p.g;
        outSmall[i + 2] = p.b;
      }
    }
  }

  // 5) upscale to output size (nearest neighbor for crisp pixels)
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
