import { useEffect, useRef, useState } from "react";
import CanvasStage from "./CanvasStage";
import PixelArtControls from "./PixelArtControls";
import { usePixelArtWorker } from "../hooks/usePixelArtWorker";
import type { ProcessPixelArtDoneMessage } from "../workers/messages";

type LoadedImage = {
  img: HTMLImageElement;
  fileName: string;
};

const MAX_W = 1200;
const MAX_H = 800;

function fitSize(srcW: number, srcH: number) {
  const scale = Math.min(MAX_W / srcW, MAX_H / srcH, 1);
  return { w: Math.round(srcW * scale), h: Math.round(srcH * scale) };
}

export default function CanvasUploader() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalRef = useRef<ImageData | null>(null);

  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gridMax, setGridMax] = useState<100 | 250>(250);
  const [paletteSize, setPaletteSize] = useState(12);
  const [ditherStrength, setDitherStrength] = useState(0.15);
  const [edgeEnabled, setEdgeEnabled] = useState(true);
  const [edgeThreshold, setEdgeThreshold] = useState(0.22);

  function getCanvasContext() {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    return { canvas, ctx };
  }

  function handleProcessed(msg: ProcessPixelArtDoneMessage) {
    const target = getCanvasContext();
    if (!target) return;

    const arr = new Uint8ClampedArray(msg.outBuffer);
    const imgData = new ImageData(arr, msg.outWidth, msg.outHeight);
    target.ctx.putImageData(imgData, 0, 0);
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
      setLoaded({ img, fileName: file.name });
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
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

    const target = getCanvasContext();
    if (!target) return;

    target.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
    target.canvas.width = 0;
    target.canvas.height = 0;
  }

  function reset() {
    if (processing) return;

    const target = getCanvasContext();
    const original = originalRef.current;
    if (!target || !original) return;

    target.ctx.putImageData(original, 0, 0);
  }

  function generatePixelArt() {
    if (processing) return;

    const target = getCanvasContext();
    const original = originalRef.current;
    if (!target || !original) return;

    const srcBuffer = original.data.slice().buffer;
    process({
      srcWidth: original.width,
      srcHeight: original.height,
      srcBuffer,
      outWidth: target.canvas.width,
      outHeight: target.canvas.height,
      gridMax,
      paletteSize,
      ditherStrength,
      edgeEnabled,
      edgeThreshold,
    });
  }

  useEffect(() => {
    if (!loaded) return;

    const target = getCanvasContext();
    if (!target) return;

    const srcW = loaded.img.naturalWidth;
    const srcH = loaded.img.naturalHeight;
    const { w, h } = fitSize(srcW, srcH);

    target.canvas.width = w;
    target.canvas.height = h;
    target.ctx.clearRect(0, 0, w, h);
    target.ctx.drawImage(loaded.img, 0, 0, w, h);
    originalRef.current = target.ctx.getImageData(0, 0, target.canvas.width, target.canvas.height);
  }, [loaded]);

  return (
    <div className="grid gap-4">
      <PixelArtControls
        loaded={loaded}
        error={error}
        processing={processing}
        gridMax={gridMax}
        paletteSize={paletteSize}
        ditherStrength={ditherStrength}
        edgeEnabled={edgeEnabled}
        edgeThreshold={edgeThreshold}
        onFileChange={loadFile}
        onClear={clear}
        onReset={reset}
        onGenerate={generatePixelArt}
        onGridMaxChange={setGridMax}
        onPaletteSizeChange={setPaletteSize}
        onDitherStrengthChange={setDitherStrength}
        onEdgeEnabledChange={setEdgeEnabled}
        onEdgeThresholdChange={setEdgeThreshold}
      />
      <CanvasStage canvasRef={canvasRef} error={error} />
    </div>
  );
}
