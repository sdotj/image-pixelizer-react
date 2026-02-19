# Image Pixelizer (React)

A browser-based pixel-art generator that transforms uploaded images into retro-style output with adjustable grid size, palette depth, dithering, and outlines.

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
- Palette size control (`2` to `24` colors)
- Dither strength control (`0.00` to `0.35`)
- Edge outlining toggle + threshold slider
- One-click reset back to original preview
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
3. Build a reduced palette via median-cut quantization.
4. Convert palette and candidate pixels to LAB color space.
5. Match each pixel to nearest palette color using Delta E 2000 distance.
6. Optionally apply subtle 4x4 Bayer ordered dithering before palette lookup.
7. Optionally run an outline pass using neighbor changes + luminance contrast threshold.
8. Upscale to output canvas with nearest-neighbor scaling for clean hard edges.

Worker messaging is typed in `src/workers/messages.ts`, and integration is handled by `src/hooks/usePixelArtWorker.ts`.

## Controls explained

- `Grid`: Maximum dimension used during pixelization.  
  Lower values = chunkier look, faster processing.
- `Palette`: Number of retained colors.  
  Lower values = more stylized/limited color feel.
- `Dither`: Adds patterned noise before quantization.  
  Helps smooth gradients but can add texture/grain.
- `Enable Edges`: Turns outline pass on/off.
- `Edge Threshold`: Minimum luminance contrast required to draw an outline.  
  Higher values = fewer, more selective outlines.

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
- No export/download button yet
- No preset palette themes wired into the UI yet
- No batch processing

## Ideas for next iteration

- Export as PNG (with optional upscale factor)
- Side-by-side original vs processed preview
- Custom palette import / named preset palettes
- Toggle between ordered dithering and error-diffusion dithering
- Save/share parameter presets

## License

Add your preferred license here (`MIT`, `Apache-2.0`, etc.).
