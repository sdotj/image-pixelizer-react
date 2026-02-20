import type { RefObject } from "react";

type CanvasStageProps = {
  processedCanvasRef: RefObject<HTMLCanvasElement | null>;
  originalCanvasRef: RefObject<HTMLCanvasElement | null>;
  error: string | null;
  hasProcessed: boolean;
  compareEnabled: boolean;
  comparePosition: number;
  onCompareEnabledChange: (value: boolean) => void;
  onComparePositionChange: (value: number) => void;
};

export default function CanvasStage({
  processedCanvasRef,
  originalCanvasRef,
  error,
  hasProcessed,
  compareEnabled,
  comparePosition,
  onCompareEnabledChange,
  onComparePositionChange,
}: CanvasStageProps) {
  return (
    <div className="grid gap-3">
      {error && (
        <div className="rounded-md border-2 border-crt-red/70 bg-crt-red/10 px-3 py-2 text-xl text-rose-200">
          {error}
        </div>
      )}

      {hasProcessed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-crt-line bg-crt-panel px-3 py-2">
          <label className="flex items-center gap-2 text-xl text-slate-100">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => onCompareEnabledChange(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="font-pixel text-xs uppercase tracking-wide">Compare</span>
          </label>

          <label className="flex min-w-52 items-center gap-2 text-xl text-slate-100">
            <span className="font-pixel text-[10px] uppercase tracking-wide text-cyan-100">Split</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={comparePosition}
              onChange={(e) => onComparePositionChange(Number(e.target.value))}
              disabled={!compareEnabled}
              className="w-full"
            />
            <span className="w-10 text-right text-xl text-crt-glow">{comparePosition}%</span>
          </label>
        </div>
      )}

      <div className="relative overflow-auto rounded-xl border-2 border-crt-line bg-[#0b1015] p-2 shadow-pixel">
        <div className="relative mx-auto w-fit max-w-full">
          <canvas ref={processedCanvasRef} className="block max-w-full rounded-sm" />

          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm"
            style={{
              clipPath: `inset(0 ${100 - comparePosition}% 0 0)`,
              opacity: hasProcessed && compareEnabled ? 1 : 0,
            }}
          >
            <canvas ref={originalCanvasRef} className="block max-w-full rounded-sm" />
          </div>

          {hasProcessed && compareEnabled && (
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-crt-glow/80"
              style={{ left: `${comparePosition}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
