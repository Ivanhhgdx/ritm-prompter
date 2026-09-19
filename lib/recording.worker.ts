import { prepareRecording } from './prepare-recording';

self.onmessage = async (
  event: MessageEvent<{ blob: Blob; seconds: number }>,
) => {
  try {
    self.postMessage({
      result: await prepareRecording(event.data.blob, event.data.seconds),
    });
  } catch {
    self.postMessage({ error: 'Не удалось подготовить видео' });
  }
};
