import CanvasUploader from "./components/CanvasUploader";

export default function App() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 text-slate-100 sm:px-6 sm:py-10">
      <section className="overflow-hidden rounded-2xl border-2 border-crt-line bg-crt-panel/85 p-5 shadow-pixel shadow-cyan-400/10 sm:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 inline-block rounded-md border border-crt-line bg-crt-bg px-3 py-1 font-pixel text-[10px] uppercase tracking-wide text-crt-glow">
              Retro Pixel Lab
            </p>
            <h1 className="font-pixel text-lg uppercase leading-relaxed text-crt-peach sm:text-2xl">
              Image Pixelizer
            </h1>
            <p className="mt-3 max-w-xl text-2xl leading-tight text-slate-200/90">
              Upload an image, tune the controls, and generate crisp retro-style pixel art.
            </p>
          </div>
        </div>

        <CanvasUploader />
      </section>
    </main>
  );
}
