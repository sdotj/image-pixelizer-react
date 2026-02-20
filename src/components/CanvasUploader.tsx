import { useEffect, useRef, useState } from "react";
import CanvasStage from "./CanvasStage";
import PixelArtControls from "./PixelArtControls";
import { usePixelArtWorker } from "../hooks/usePixelArtWorker";
import type { PaletteStylePreset, ProcessPixelArtDoneMessage } from "../workers/messages";

type LoadedImage = {
  img: HTMLImageElement;
  fileName: string;
};

const MAX_W = 1200;
const MAX_H = 800;
const PRESET_VALUES: PaletteStylePreset[] = [
  "auto",
  "portrait_warm",
  "retro_comic",
  "pico8",
  "nes",
  "gameboy",
  "muted_pastel",
];

function fitSize(srcW: number, srcH: number) {
  const scale = Math.min(MAX_W / srcW, MAX_H / srcH, 1);
  return { w: Math.round(srcW * scale), h: Math.round(srcH * scale) };
}

function clampNumber(x: number, min: number, max: number) {
  return Math.min(max, Math.max(min, x));
}

function parseBool(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  return value === "1" || value === "true";
}

function parseSettingsFromUrl() {
  const defaults = {
    gridMax: 250 as 100 | 250,
    paletteSize: 12,
    palettePreset: "auto" as PaletteStylePreset,
    paletteSmoothing: true,
    polishedPortrait: false,
    ditherStrength: 0.15,
    edgeEnabled: true,
    edgeThreshold: 0.22,
  };

  if (typeof window === "undefined") return defaults;

  const params = new URLSearchParams(window.location.search);
  const gm = Number(params.get("gm"));
  const ps = Number(params.get("ps"));
  const pp = params.get("pp");
  const di = Number(params.get("di"));
  const et = Number(params.get("et"));

  return {
    gridMax: gm === 100 ? 100 : gm === 250 ? 250 : defaults.gridMax,
    paletteSize: Number.isFinite(ps) ? clampNumber(Math.round(ps), 2, 24) : defaults.paletteSize,
    palettePreset:
      pp && PRESET_VALUES.includes(pp as PaletteStylePreset)
        ? (pp as PaletteStylePreset)
        : defaults.palettePreset,
    paletteSmoothing: parseBool(params.get("sm"), defaults.paletteSmoothing),
    polishedPortrait: parseBool(params.get("po"), defaults.polishedPortrait),
    ditherStrength: Number.isFinite(di) ? clampNumber(di, 0, 0.35) : defaults.ditherStrength,
    edgeEnabled: parseBool(params.get("ee"), defaults.edgeEnabled),
    edgeThreshold: Number.isFinite(et) ? clampNumber(et, 0, 1) : defaults.edgeThreshold,
  };
}

function fileNameWithoutExt(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

export default function CanvasUploader() {
  const [initialSettings] = useState(parseSettingsFromUrl);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalRef = useRef<ImageData | null>(null);
  const processedRef = useRef<ImageData | null>(null);

  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [comparePosition, setComparePosition] = useState(50);
  const [exportScale, setExportScale] = useState<1 | 2 | 4 | 8>(4);

  const [gridMax, setGridMax] = useState<100 | 250>(initialSettings.gridMax);
  const [paletteSize, setPaletteSize] = useState(initialSettings.paletteSize);
  const [palettePreset, setPalettePreset] = useState<PaletteStylePreset>(initialSettings.palettePreset);
  const [paletteSmoothing, setPaletteSmoothing] = useState(initialSettings.paletteSmoothing);
  const [polishedPortrait, setPolishedPortrait] = useState(initialSettings.polishedPortrait);
  const [ditherStrength, setDitherStrength] = useState(initialSettings.ditherStrength);
  const [edgeEnabled, setEdgeEnabled] = useState(initialSettings.edgeEnabled);
  const [edgeThreshold, setEdgeThreshold] = useState(initialSettings.edgeThreshold);

  function getCanvasContexts() {
    const processedCanvas = processedCanvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    if (!processedCanvas || !originalCanvas) return null;

    const processedCtx = processedCanvas.getContext("2d");
    const originalCtx = originalCanvas.getContext("2d");
    if (!processedCtx || !originalCtx) return null;

    return { processedCanvas, originalCanvas, processedCtx, originalCtx };
  }

  function handleProcessed(msg: ProcessPixelArtDoneMessage) {
    const target = getCanvasContexts();
    if (!target) return;

    const arr = new Uint8ClampedArray(msg.outBuffer);
    const imgData = new ImageData(arr, msg.outWidth, msg.outHeight);
    target.processedCtx.putImageData(imgData, 0, 0);
    processedRef.current = imgData;
    setHasProcessed(true);
  }

  const { processing, process, stop } = usePixelArtWorker({
    onProcessed: handleProcessed,
    onError: setError,
  });

  function loadFile(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setLoaded(null);
      setError("Please upload an image file (png/jpg/webp/etc).");
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      setHasProcessed(false);
      setLoaded({ img, fileName: file.name });
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      setHasProcessed(false);
      setLoaded(null);
      setError("Could not load that image file.");
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }

  function clear() {
    setLoaded(null);
    setError(null);
    stop();
    originalRef.current = null;
    processedRef.current = null;
    setHasProcessed(false);

    const target = getCanvasContexts();
    if (!target) return;

    target.processedCtx.clearRect(0, 0, target.processedCanvas.width, target.processedCanvas.height);
    target.originalCtx.clearRect(0, 0, target.originalCanvas.width, target.originalCanvas.height);
    target.processedCanvas.width = 0;
    target.processedCanvas.height = 0;
    target.originalCanvas.width = 0;
    target.originalCanvas.height = 0;
  }

  function reset() {
    clear();
  }

  function generatePixelArt() {
    if (processing) return;

    const target = getCanvasContexts();
    const original = originalRef.current;
    if (!target || !original) return;

    const srcBuffer = original.data.slice().buffer;
    process({
      srcWidth: original.width,
      srcHeight: original.height,
      srcBuffer,
      outWidth: target.processedCanvas.width,
      outHeight: target.processedCanvas.height,
      gridMax,
      paletteSize,
      palettePreset,
      paletteSmoothing,
      polishedPortrait,
      ditherStrength,
      edgeEnabled,
      edgeThreshold,
    });
  }

  function exportImage() {
    const sourceCanvas = processedCanvasRef.current;
    if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0) return;

    const out = document.createElement("canvas");
    out.width = sourceCanvas.width * exportScale;
    out.height = sourceCanvas.height * exportScale;
    const outCtx = out.getContext("2d");
    if (!outCtx) return;

    outCtx.imageSmoothingEnabled = false;
    outCtx.drawImage(sourceCanvas, 0, 0, out.width, out.height);

    out.toBlob((blob) => {
      if (!blob) {
        setError("Could not export image.");
        return;
      }

      const name = loaded ? fileNameWithoutExt(loaded.fileName) : "pixel-art";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}-pixelized-x${exportScale}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams();
    params.set("gm", String(gridMax));
    params.set("ps", String(paletteSize));
    params.set("pp", palettePreset);
    params.set("sm", paletteSmoothing ? "1" : "0");
    params.set("po", polishedPortrait ? "1" : "0");
    params.set("di", ditherStrength.toFixed(2));
    params.set("ee", edgeEnabled ? "1" : "0");
    params.set("et", edgeThreshold.toFixed(2));

    const query = params.toString();
    const url = `${window.location.pathname}?${query}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [
    gridMax,
    paletteSize,
    palettePreset,
    paletteSmoothing,
    polishedPortrait,
    ditherStrength,
    edgeEnabled,
    edgeThreshold,
  ]);

  useEffect(() => {
    if (!loaded) return;

    const target = getCanvasContexts();
    if (!target) return;

    const srcW = loaded.img.naturalWidth;
    const srcH = loaded.img.naturalHeight;
    const { w, h } = fitSize(srcW, srcH);

    target.processedCanvas.width = w;
    target.processedCanvas.height = h;
    target.originalCanvas.width = w;
    target.originalCanvas.height = h;

    target.processedCtx.clearRect(0, 0, w, h);
    target.originalCtx.clearRect(0, 0, w, h);
    target.processedCtx.drawImage(loaded.img, 0, 0, w, h);
    target.originalCtx.drawImage(loaded.img, 0, 0, w, h);

    originalRef.current = target.originalCtx.getImageData(0, 0, w, h);
    processedRef.current = null;
  }, [loaded]);

  return (
    <div className="grid gap-4">
      <PixelArtControls
        loaded={loaded}
        error={error}
        processing={processing}
        gridMax={gridMax}
        paletteSize={paletteSize}
        palettePreset={palettePreset}
        paletteSmoothing={paletteSmoothing}
        polishedPortrait={polishedPortrait}
        ditherStrength={ditherStrength}
        edgeEnabled={edgeEnabled}
        edgeThreshold={edgeThreshold}
        onFileChange={loadFile}
        onClear={clear}
        onReset={reset}
        onGenerate={generatePixelArt}
        onGridMaxChange={setGridMax}
        onPaletteSizeChange={setPaletteSize}
        onPalettePresetChange={setPalettePreset}
        onPaletteSmoothingChange={setPaletteSmoothing}
        onPolishedPortraitChange={setPolishedPortrait}
        onDitherStrengthChange={setDitherStrength}
        onEdgeEnabledChange={setEdgeEnabled}
        onEdgeThresholdChange={setEdgeThreshold}
        exportScale={exportScale}
        hasExportableImage={Boolean(loaded)}
        onExportScaleChange={setExportScale}
        onExport={exportImage}
      />
      <CanvasStage
        processedCanvasRef={processedCanvasRef}
        originalCanvasRef={originalCanvasRef}
        error={error}
        hasProcessed={hasProcessed}
        compareEnabled={compareEnabled}
        comparePosition={comparePosition}
        onCompareEnabledChange={setCompareEnabled}
        onComparePositionChange={setComparePosition}
      />
    </div>
  );
}
