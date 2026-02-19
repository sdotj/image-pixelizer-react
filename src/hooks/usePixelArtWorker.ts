import { useEffect, useRef, useState } from "react";
import type {
  ProcessPixelArtDoneMessage,
  ProcessPixelArtRequest,
} from "../workers/messages";

type UsePixelArtWorkerArgs = {
  onProcessed: (msg: ProcessPixelArtDoneMessage) => void;
  onError: (message: string) => void;
};

export function usePixelArtWorker({ onProcessed, onError }: UsePixelArtWorkerArgs) {
  const workerRef = useRef<Worker | null>(null);
  const onProcessedRef = useRef(onProcessed);
  const onErrorRef = useRef(onError);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    onProcessedRef.current = onProcessed;
    onErrorRef.current = onError;
  }, [onProcessed, onError]);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/palette.worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<ProcessPixelArtDoneMessage>) => {
      const msg = event.data;
      if (msg.type !== "PROCESS_PIXEL_ART_DONE") return;

      onProcessedRef.current(msg);
      setProcessing(false);
    };

    worker.onerror = () => {
      onErrorRef.current("Worker error while processing image.");
      setProcessing(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  function process(request: Omit<ProcessPixelArtRequest, "type">) {
    const worker = workerRef.current;
    if (!worker || processing) return false;

    setProcessing(true);
    worker.postMessage({ type: "PROCESS_PIXEL_ART", ...request }, [request.srcBuffer]);
    return true;
  }

  function stop() {
    setProcessing(false);
  }

  return { processing, process, stop };
}
