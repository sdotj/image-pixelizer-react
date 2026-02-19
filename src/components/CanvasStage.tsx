import type { RefObject } from "react";

type CanvasStageProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  error: string | null;
};

export default function CanvasStage({ canvasRef, error }: CanvasStageProps) {
  return (
    <div className="grid gap-3">
      {error && (
        <div className="rounded-md border-2 border-crt-red/70 bg-crt-red/10 px-3 py-2 text-xl text-rose-200">
          {error}
        </div>
      )}

      <div className="relative overflow-auto rounded-xl border-2 border-crt-line bg-[#0b1015] p-2 shadow-pixel">
        <canvas ref={canvasRef} className="mx-auto block max-w-full rounded-sm" />
      </div>
    </div>
  );
}
