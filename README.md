# Image Pixelizer (React)

A browser-based pixel-art generator that transforms uploaded images into stylized retro output with adjustable grid size, palette logic, dithering, outlines, compare tools, and export options.

Built with React + TypeScript + Vite, with image processing offloaded to a Web Worker so the UI stays responsive while generating.

## Why this project exists

Most basic "pixelize" demos stop at nearest-neighbor scaling. This project goes further by combining:

- Palette quantization (median cut) to reduce color complexity
- Perceptual palette matching (CIE LAB + Delta E 2000)
- Optional ordered dithering for texture
- Optional outline pass for stronger sprite readability
- Nearest-neighbor upscaling for crisp final pixels

The result is more intentional, game-art style output rather than simple blur-to-block conversion.

## Features

- Upload PNG/JPG/WEBP and preview immediately
- Adjustable pixel grid (`100` or `250` max dimension)
- Palette size control (`2` to `24` colors) in `Auto` mode
- Style presets: `Portrait Warm`, `Retro Comic`, `Pico-8`, `NES`, `GameBoy`, `Muted Pastel`
- `Polished Portrait` mode for cleaner portrait-focused output
- Dither strength control (`0.00` to `0.35`)
- Palette smoothing toggle (duplicate merge + ramp shaping + conservative cleanup)
- Edge outlining toggle + threshold slider
- Before/after compare slider on canvas output
- Export PNG at `1x`, `2x`, `4x`, or `8x`
- Shareable preset URLs via query parameters
- One-click clear state/canvas
- All processing runs client-side in a worker (no backend required)

## Tech stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS v4
- Web Workers for CPU-heavy image operations

## Run locally

### 1) Install dependencies

```bash
npm install
```

### 2) Start dev server

```bash
npm run dev
```

### 3) Build production bundle

```bash
npm run build
```

### 4) Preview production build

```bash
npm run preview
```

### 5) Lint

```bash
npm run lint
```

## How processing works

The core pipeline lives in `src/workers/palette.worker.ts`:

1. Fit source image within a processing grid (`gridMax`) while preserving aspect ratio.
2. Downscale with bilinear filtering to produce a compact "analysis" image.
3. Optionally run edge-aware portrait prefiltering (`Polished Portrait` mode).
4. Build a palette from either:
   - image-derived median-cut quantization (`Auto`)
   - fixed style preset palette
5. Optionally smooth palette ramps (merge near-duplicates + enforce light/dark progression).
6. Convert palette and candidate pixels to LAB color space.
7. Match each pixel to nearest palette color using Delta E 2000 distance.
8. Optionally apply subtle 4x4 Bayer ordered dithering before palette lookup.
9. Optionally run conservative local cleanup for noisy speckles.
10. Optionally run outlines (standard or selective portrait outlines).
11. Upscale to output canvas with nearest-neighbor scaling for clean hard edges.

Worker messaging is typed in `src/workers/messages.ts`, and integration is handled by `src/hooks/usePixelArtWorker.ts`.

## Controls explained

- `Grid`: Maximum dimension used during pixelization.  
  Lower values = chunkier look, faster processing.
- `Style Preset`: Switches between image-derived color extraction and fixed palettes.
- `Palette`: Number of retained colors (only active in `Auto` preset).  
  Lower values = more stylized/limited color feel.
- `Palette Smoothing`: Reduces near-duplicate colors and encourages cleaner tonal ramps.
- `Polished Portrait`: Applies portrait-oriented cleanup (edge-aware smoothing + selective outlining).
- `Dither`: Adds patterned noise before quantization.  
  Helps smooth gradients but can add texture/grain.
- `Enable Edges`: Turns outline pass on/off.
- `Edge Threshold`: Minimum luminance contrast required to draw an outline.  
  Higher values = fewer, more selective outlines.
- `Export Scale`: Chooses PNG export resolution multiplier.
- `Compare / Split`: Overlay original image against processed output with a draggable split percentage.

## Shareable URLs

Control state is synced to URL query params, so settings can be copied/shared directly.

Current params:

- `gm`: grid max (`100` or `250`)
- `ps`: palette size
- `pp`: palette preset key
- `sm`: palette smoothing (`1`/`0`)
- `po`: polished portrait (`1`/`0`)
- `di`: dither strength
- `ee`: edge enabled (`1`/`0`)
- `et`: edge threshold

## Project structure

```text
src/
  components/
    CanvasUploader.tsx      # state + orchestration
    PixelArtControls.tsx    # UI controls
    CanvasStage.tsx         # canvas + error display
  hooks/
    usePixelArtWorker.ts    # worker lifecycle + messaging
  workers/
    palette.worker.ts       # pixel-art algorithm pipeline
    messages.ts             # shared worker message types
  App.tsx                   # page shell
  index.css                 # CRT-inspired visual theme
```

## Performance notes

- Processing is intentionally worker-based to avoid main-thread freezes.
- Palette extraction uses adaptive sampling to stay responsive at larger grids.
- Input preview is capped to `1200x800` for sane canvas memory/CPU usage.

## Current limitations

- No drag-and-drop yet (file picker only)
- No crop/selection tool yet
- No alpha-background replacement workflow yet
- No batch processing

## Ideas for next iteration

- Custom palette import / named preset palettes
- Toggle between ordered dithering and error-diffusion dithering
- One-click copy-share link button
- Golden image tests for worker output stability