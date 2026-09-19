import {
  Input,
  BlobSource,
  ALL_FORMATS,
  Output,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  Conversion,
} from 'mediabunny';

export type PreparedRecording = { blob: Blob; duration: number };

/** Rebuild the container from actual encoded samples, never from recorder duration metadata. */
export async function prepareRecording(
  blob: Blob,
  expectedSeconds: number,
): Promise<PreparedRecording> {
  if (!blob.size || !Number.isFinite(expectedSeconds) || expectedSeconds <= 0) {
    throw new Error('Empty recording');
  }
  const input = new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });
  let output:
    | Output<Mp4OutputFormat | WebMOutputFormat, BufferTarget>
    | undefined;
  try {
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    if (!video || !audio) throw new Error('Missing camera or microphone track');
    const mp4 =
      (await video.getCodec()) === 'avc' && (await audio.getCodec()) === 'aac';
    // Keep WebM as WebM when H.264/AAC are unavailable. No slow, lossy transcoding on phones.
    const type = mp4 ? 'video/mp4' : blob.type.split(';')[0];
    if (type !== 'video/mp4' && type !== 'video/webm')
      throw new Error('Unsupported container');
    output = new Output({
      target: new BufferTarget(),
      format:
        type === 'video/mp4'
          ? new Mp4OutputFormat({ fastStart: 'in-memory' })
          : new WebMOutputFormat(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      copy: { mode: 'forced' },
    });
    if (!conversion.isValid || conversion.discardedTracks.length) {
      throw new Error('Cannot preserve all recording tracks');
    }
    await conversion.execute();
    if (!output.target.buffer?.byteLength) throw new Error('Empty output');
    const result = new Blob([output.target.buffer], { type });
    const check = new Input({
      source: new BlobSource(result),
      formats: ALL_FORMATS,
    });
    try {
      const duration = await check.computeDuration();
      const metadataDuration = await check.getDurationFromMetadata();
      // Reject corrupt timelines, rather than disguising them with the UI stopwatch.
      if (
        !Number.isFinite(duration) ||
        duration <= 0 ||
        Math.abs(duration - expectedSeconds) >
          Math.max(2, expectedSeconds * 0.1) ||
        metadataDuration === null ||
        !Number.isFinite(metadataDuration) ||
        Math.abs(metadataDuration - duration) > 0.25
      ) {
        throw new Error('Invalid recording duration');
      }
      return { blob: result, duration };
    } finally {
      check.dispose();
    }
  } finally {
    if (output && output.state !== 'finalized' && output.state !== 'canceled') {
      await output.cancel().catch(() => {});
    }
    input.dispose();
  }
}
