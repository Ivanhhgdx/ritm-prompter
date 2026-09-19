import type { PreparedRecording } from './prepare-recording';

/** Keep parsing/muxing off the UI thread and release the worker on every exit path. */
export function finalizeRecording(
  blob: Blob,
  seconds: number,
  signal: AbortSignal,
): Promise<PreparedRecording> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Canceled'));
      return;
    }
    const worker = new Worker(
      new URL('./recording.worker.ts', import.meta.url),
      { type: 'module' },
    );
    const clean = () => {
      worker.terminate();
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      clean();
      reject(new Error('Canceled'));
    };
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => {
      clean();
      reject(new Error('Video processing failed'));
    };
    worker.onmessageerror = () => {
      clean();
      reject(new Error('Video processing failed'));
    };
    worker.onmessage = (
      event: MessageEvent<{ result?: PreparedRecording; error?: string }>,
    ) => {
      clean();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    try {
      worker.postMessage({ blob, seconds });
    } catch (error) {
      clean();
      reject(error);
    }
  });
}
