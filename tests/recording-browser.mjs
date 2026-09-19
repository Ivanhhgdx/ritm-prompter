import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { webkit } from 'playwright-core';
import { createServer } from 'vite';

// Synthetic camera/audio only: no personal camera or microphone access.
const server = await createServer({
  configFile: 'vite.pages.config.ts',
  optimizeDeps: { include: ['mediabunny'] },
  server: { port: 0 },
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await webkit.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error(msg.text());
  });
  for (const scenario of [
    'resume',
    'stop-paused',
    'device-ended',
    'worker-failure',
  ]) {
    await page.goto(`${base}tests/recorder-harness.html`);
    await page.getByRole('button', { name: 'Enable', exact: true }).click();
    await page
      .waitForFunction(() => window.recordingHarness.phase === 'ready', null, {
        timeout: 8000,
      })
      .catch(async (error) => {
        console.log(
          await page.evaluate(() => ({
            phase: window.recordingHarness.phase,
            error: window.recordingHarness.error,
          })),
        );
        throw error;
      });
    if (scenario === 'worker-failure') {
      await page.evaluate(() => {
        window.Worker = class {
          constructor() {
            throw new Error('Worker unavailable');
          }
        };
      });
    }
    await page.getByRole('button', { name: 'Record', exact: true }).click();
    await page.waitForTimeout(1200);
    if (scenario === 'resume' || scenario === 'stop-paused') {
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.waitForFunction(
        () => window.recordingHarness.phase === 'paused',
      );
      await page.waitForTimeout(1000);
      if (scenario === 'resume') {
        await page.getByRole('button', { name: 'Pause', exact: true }).click();
        await page.waitForTimeout(1200);
      }
    }
    if (scenario === 'device-ended') {
      await page.evaluate(() =>
        window.testStream.getVideoTracks()[0].dispatchEvent(new Event('ended')),
      );
    } else {
      await page
        .getByRole('button', { name: 'Finish twice and close', exact: true })
        .click();
    }
    await page
      .waitForFunction(
        () =>
          window.recordingHarness.clip &&
          window.recordingHarness.phase === 'off',
        null,
        { timeout: 10000 },
      )
      .catch(async (error) => {
        console.log(
          await page.evaluate(() => ({
            phase: window.recordingHarness.phase,
            error: window.recordingHarness.error,
          })),
        );
        throw error;
      });
    const result = await page.evaluate(async () => {
      const c = window.recordingHarness;
      const buffer = new Uint8Array(await c.clip.file.arrayBuffer());
      return {
        prepared: c.clip.prepared,
        duration: c.clip.duration,
        error: c.error,
        type: c.clip.file.type,
        bytes: Array.from(buffer),
        stopped: window.testStream
          .getTracks()
          .every((t) => t.readyState === 'ended'),
      };
    });
    assert.ok(result.stopped, 'release camera and microphone');
    if (scenario === 'worker-failure') {
      assert.equal(result.prepared, false);
      assert.ok(result.error.includes('Исходная запись'));
      assert.ok(result.bytes.length > 0);
    } else {
      assert.equal(result.prepared, true, result.error);
      assert.ok(
        result.duration > 0.5 &&
          result.duration < (scenario === 'resume' ? 3.1 : 2),
        JSON.stringify({ duration: result.duration }),
      );
      await page.waitForFunction(() =>
        Number.isFinite(document.querySelector('#result').duration),
      );
      const seek = await page.evaluate(async () => {
        const video = document.querySelector('#result');
        await video.play();
        video.pause();
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('Seek timed out')),
            5000,
          );
          video.addEventListener(
            'seeked',
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
          video.currentTime = video.duration * 0.7;
        });
        return {
          duration: video.duration,
          time: video.currentTime,
          width: video.videoWidth,
        };
      });
      assert.ok(Math.abs(seek.duration - result.duration) < 0.15);
      assert.ok(seek.time > 0 && seek.width > 0);
    }
    await mkdir('outputs/recording-check', { recursive: true });
    await writeFile(
      `outputs/recording-check/${scenario}.mp4`,
      Buffer.from(result.bytes),
    );
    console.log(
      `${scenario}: prepared=${result.prepared}, duration=${result.duration.toFixed(3)}s, ${result.type}, ${result.bytes.length} bytes`,
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await server.close();
}
