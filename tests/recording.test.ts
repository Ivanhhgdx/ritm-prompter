import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Input, BlobSource, ALL_FORMATS, EncodedPacketSink } from 'mediabunny';
import { prepareRecording } from '../lib/prepare-recording.ts';
import { createRecorder, RECORDING_TYPES } from '../lib/recording-format.ts';

async function fixture(name: string, type: string) {
  return new Blob(
    [await readFile(new URL(`fixtures/${name}`, import.meta.url))],
    { type },
  );
}
const inspect = (blob: Blob) =>
  new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
async function packets(input: Input) {
  const result = [];
  for (const track of await input.getTracks()) {
    const hashes = [];
    for await (const packet of new EncodedPacketSink(track).packets()) {
      hashes.push(createHash('sha256').update(packet.data).digest('hex'));
    }
    result.push({ codec: await track.getCodec(), hashes });
  }
  return result;
}

for (const [name, type] of [
  ['recording-fragmented.mp4', 'video/mp4'],
  ['recording-live.webm', 'video/webm'],
]) {
  void test(`${type}: rebuild duration/index without changing encoded sound or picture`, async () => {
    const original = await fixture(name, type);
    const { blob, duration } = await prepareRecording(original, 2);
    assert.equal(blob.type, type);
    assert.ok(Math.abs(duration - 2) < 0.15, `duration ${duration}`);
    const before = inspect(original),
      after = inspect(blob);
    try {
      assert.deepEqual(await packets(after), await packets(before));
      assert.ok(
        Math.abs((await after.getDurationFromMetadata())! - duration) < 0.1,
      );
      const video = (await after.getPrimaryVideoTrack())!;
      const key = await new EncodedPacketSink(video).getKeyPacket(1.5);
      assert.ok(key && key.timestamp > 0.5, 'can seek to a later keyframe');
      if (type === 'video/mp4') {
        const bytes = Buffer.from(await blob.arrayBuffer());
        assert.ok(
          bytes.indexOf('moov') < bytes.indexOf('mdat'),
          'fast-start metadata',
        );
        assert.equal(bytes.indexOf('moof'), -1, 'regular MP4, not fragmented');
      }
    } finally {
      before.dispose();
      after.dispose();
    }
  });
}

void test('huge MP4 header duration is rebuilt from samples, not copied', async () => {
  const bytes = Buffer.from(
    await (
      await fixture('recording-fragmented.mp4', 'video/mp4')
    ).arrayBuffer(),
  );
  const mvhd = bytes.indexOf('mvhd');
  assert.ok(mvhd > 0);
  assert.equal(bytes[mvhd + 4], 0); // v0: timescale +16, duration +20.
  bytes.writeUInt32BE(1, mvhd + 16);
  bytes.writeUInt32BE(0xffffffff, mvhd + 20);
  const { blob, duration } = await prepareRecording(
    new Blob([bytes], { type: 'video/mp4' }),
    2,
  );
  assert.ok(duration > 1.9 && duration < 2.2);
  const input = inspect(blob);
  try {
    assert.ok((await input.getDurationFromMetadata())! < 2.2);
  } finally {
    input.dispose();
  }
});

void test('invalid inputs/timing cannot become gallery-ready recordings', async () => {
  await assert.rejects(prepareRecording(new Blob(), 2));
  await assert.rejects(
    prepareRecording(new Blob(['broken'], { type: 'video/mp4' }), 2),
  );
  const blob = await fixture('recording-fragmented.mp4', 'video/mp4');
  await assert.rejects(prepareRecording(blob, Infinity));
  await assert.rejects(prepareRecording(blob, 60));
});

void test('recorder prefers H.264/AAC and falls back after a rejected constructor', () => {
  const saved = globalThis.MediaRecorder;
  const attempted: string[] = [];
  class FakeRecorder {
    static isTypeSupported(type: string) {
      return type !== RECORDING_TYPES[1];
    }
    constructor(_stream: MediaStream, options: MediaRecorderOptions) {
      attempted.push(options.mimeType || '');
      if (options.mimeType === RECORDING_TYPES[0])
        throw new Error('unsupported profile');
    }
  }
  try {
    globalThis.MediaRecorder = FakeRecorder as unknown as typeof MediaRecorder;
    createRecorder({} as MediaStream);
    assert.deepEqual(attempted, [RECORDING_TYPES[0], 'video/mp4']);
  } finally {
    globalThis.MediaRecorder = saved;
  }
});
