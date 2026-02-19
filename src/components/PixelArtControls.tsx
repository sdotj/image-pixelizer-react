type LoadedImage = {
  img: HTMLImageElement;
  fileName: string;
};

type PixelArtControlsProps = {
  loaded: LoadedImage | null;
  error: string | null;
  processing: boolean;
  gridMax: 100 | 250;
  paletteSize: number;
  ditherStrength: number;
  edgeEnabled: boolean;
  edgeThreshold: number;
  onFileChange: (file: File) => void;
  onClear: () => void;
  onReset: () => void;
  onGenerate: () => void;
  onGridMaxChange: (value: 100 | 250) => void;
  onPaletteSizeChange: (value: number) => void;
  onDitherStrengthChange: (value: number) => void;
  onEdgeEnabledChange: (value: boolean) => void;
  onEdgeThresholdChange: (value: number) => void;
};

export type PaletteStylePreset =
  | "natural"
  | "portrait"
  | "vibrant"
  | "muted"
  | "pico8"
  | "gameboy";

const controlLabelClass = "mb-1 block font-pixel text-xs uppercase tracking-wide text-cyan-100";
const fieldClass =
  "w-full appearance-none rounded-md border-2 border-crt-line bg-crt-bg px-3 py-2 text-2xl text-slate-100 outline-none transition focus:border-crt-glow disabled:cursor-not-allowed disabled:opacity-60";
const buttonClass =
  "rounded-md border-2 border-crt-line bg-crt-bg px-3 py-2 font-pixel text-xs uppercase tracking-wide text-slate-100 transition hover:-translate-y-0.5 hover:border-crt-glow hover:text-crt-glow disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

export default function PixelArtControls({
  loaded,
  error,
  processing,
  gridMax,
  paletteSize,
  ditherStrength,
  edgeEnabled,
  edgeThreshold,
  onFileChange,
  onClear,
  onReset,
  onGenerate,
  onGridMaxChange,
  onPaletteSizeChange,
  onDitherStrengthChange,
  onEdgeEnabledChange,
  onEdgeThresholdChange,
}: PixelArtControlsProps) {
  return (
    <div className="rounded-xl border-2 border-crt-line bg-crt-bg/70 p-4 shadow-glow">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <label className={controlLabelClass}>Image</label>
          <div className="flex flex-wrap items-center gap-3 rounded-md border-2 border-crt-line bg-crt-bg px-3 py-2">
            <input
              type="file"
              accept="image/*"
              disabled={processing}
              className="text-slate-100 file:mr-3 file:rounded-sm file:border file:border-crt-line file:bg-crt-panel file:px-3 file:py-2 file:font-pixel file:text-xs file:uppercase file:text-slate-100 file:hover:border-crt-glow"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileChange(file);
                e.currentTarget.value = "";
              }}
            />
            <span className="text-xl text-slate-200">
              {loaded ? loaded.fileName : "No file selected"}
            </span>
          </div>
        </div>

        <div>
          <label className={controlLabelClass}>Grid</label>
          <select
            value={gridMax}
            onChange={(e) => onGridMaxChange(Number(e.target.value) as 100 | 250)}
            disabled={processing || !loaded}
            className={fieldClass}
          >
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
        </div>

        <div>
          <label className={controlLabelClass}>Palette</label>
          <input
            type="number"
            min={2}
            max={24}
            value={paletteSize}
            onChange={(e) => onPaletteSizeChange(Number(e.target.value))}
            disabled={processing || !loaded}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={controlLabelClass}>Dither</label>
          <div className="flex items-center gap-2 rounded-md border-2 border-crt-line bg-crt-bg px-3 py-2">
            <input
              type="range"
              min={0}
              max={0.35}
              step={0.01}
              value={ditherStrength}
              onChange={(e) => onDitherStrengthChange(Number(e.target.value))}
              disabled={processing || !loaded}
              className="w-full"
            />
            <span className="w-10 text-right text-xl text-crt-glow">{ditherStrength.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className={controlLabelClass}>Edge Threshold</label>
          <div className="flex items-center gap-2 rounded-md border-2 border-crt-line bg-crt-bg px-3 py-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={edgeThreshold}
              onChange={(e) => onEdgeThresholdChange(Number(e.target.value))}
              disabled={processing || !loaded || !edgeEnabled}
              className="w-full"
            />
            <span className="w-10 text-right text-xl text-crt-glow">{edgeThreshold.toFixed(2)}</span>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-md border-2 border-crt-line bg-crt-bg px-3 py-2 text-xl text-slate-100">
          <input
            type="checkbox"
            checked={edgeEnabled}
            onChange={(e) => onEdgeEnabledChange(e.target.checked)}
            disabled={processing || !loaded}
            className="h-4 w-4"
          />
          <span className="font-pixel text-xs uppercase tracking-wide">Enable Edges</span>
        </label>

        <button onClick={onClear} disabled={processing || (!loaded && !error)} className={buttonClass}>
          Clear
        </button>

        <button onClick={onReset} disabled={!loaded || processing} className={buttonClass}>
          Reset
        </button>

        <button
          onClick={onGenerate}
          disabled={!loaded || processing}
          className={`${buttonClass} border-crt-peach text-crt-peach hover:border-crt-mint hover:text-crt-mint`}
        >
          {processing ? "Generating..." : "Generate Pixel Art"}
        </button>
      </div>

      {loaded && (
        <p className="mt-3 rounded-md border border-crt-line bg-crt-panel px-3 py-2 text-xl text-slate-200">
          {loaded.fileName} ({loaded.img.naturalWidth}x{loaded.img.naturalHeight})
        </p>
      )}
    </div>
  );
}
