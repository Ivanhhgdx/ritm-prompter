/* eslint-disable react/react-compiler, jsx-a11y/media-has-caption -- Synthetic recorder harness exposes a hook with a video ref; no speech captions. */
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useMobileRecorder } from '../hooks/use-mobile-recorder';

declare global {
  interface Window {
    recordingHarness: ReturnType<typeof useMobileRecorder>;
    testStream: MediaStream;
  }
}
const canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 240;
const ctx = canvas.getContext('2d')!;
let frame = 0;
setInterval(() => {
  ctx.fillStyle = frame++ % 2 ? '#b50' : '#057';
  ctx.fillRect(0, 0, 320, 240);
  ctx.fillStyle = 'white';
  ctx.fillText(String(frame), 30, 40);
}, 1000 / 30);
Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
  value: async () => {
    const audio = new AudioContext();
    void audio.resume();
    const tone = audio.createOscillator();
    const destination = audio.createMediaStreamDestination();
    tone.connect(destination);
    tone.start();
    const stream = new MediaStream([
      ...canvas.captureStream(30).getTracks(),
      ...destination.stream.getTracks(),
    ]);
    window.testStream = stream;
    const timer = setInterval(() => {
      if (stream.getTracks().every((t) => t.readyState === 'ended')) {
        clearInterval(timer);
        tone.stop();
        void audio.close();
      }
    }, 100);
    return stream;
  },
});
function Harness() {
  const camera = useMobileRecorder(
    () => {},
    () => {},
  );
  useEffect(() => {
    window.recordingHarness = camera;
  });
  return (
    <>
      <button onClick={() => void camera.enable()}>Enable</button>
      <button onClick={() => camera.record()}>Record</button>
      <button onClick={() => camera.togglePause()}>Pause</button>
      <button
        onClick={() => {
          camera.finish();
          camera.finish();
          camera.close();
        }}
      >
        Finish twice and close
      </button>
      <video ref={camera.video} muted playsInline />
      {camera.clip && (
        <video
          id="result"
          key={camera.clip.url}
          src={camera.clip.url}
          controls
          playsInline
        />
      )}
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
