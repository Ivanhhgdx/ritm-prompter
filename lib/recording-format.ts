// Prefer explicit H.264/AAC for Photos compatibility; a container alone does not select a codec.
export const RECORDING_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

export function createRecorder(source: MediaStream): MediaRecorder {
  // Some browsers advertise a type but reject its constructor.
  for (const mimeType of [...RECORDING_TYPES, '']) {
    if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) continue;
    try {
      return new MediaRecorder(source, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 4_000_000,
        audioBitsPerSecond: 128_000,
      });
    } catch {
      /* Try the next supported container. */
    }
  }
  throw new Error('No recording format available');
}
