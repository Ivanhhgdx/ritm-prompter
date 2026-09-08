import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadingMotion, predictionSeconds } from '../lib/reading-motion.ts';
function simulate(m: ReadingMotion, from: number, to: number, running = true) {
  const points: number[] = [];
  for (let t = from; t < to; t += 1 / 60)
    points.push(m.step(t, 1 / 60, 75, 500, running));
  return points;
}
test('speech packets produce continuous motion between recognitions', () => {
  const m = new ReadingMotion();
  m.reset(0);
  m.observe(40, 0, 35, true);
  const p = simulate(m, 0, 1);
  assert.ok(p[20] > p[10]);
  assert.ok(p[50] > p[40]);
  assert.ok(Math.max(...p.map((v, i) => (i ? v - p[i - 1] : 0))) < 5);
});
test('a long pause cannot keep sending the script away', () => {
  const m = new ReadingMotion();
  m.reset(0);
  m.observe(50, 0, 60, true);
  const p = simulate(m, 0, 8);
  assert.ok(p.at(-1)! <= 50 + 75 * 0.72 + 0.1);
  assert.ok(Math.abs(p.at(-1)! - p[p.length - 61]) < 0.2);
  assert.equal(predictionSeconds(100), predictionSeconds(1.8));
});
test('late packets never jerk the predicted view backwards', () => {
  const m = new ReadingMotion();
  m.reset(0);
  m.observe(40, 0, 60, true);
  simulate(m, 0, 1.5);
  const before = m.position;
  m.observe(45, 1.5, 60, true);
  assert.ok(simulate(m, 1.5, 2).every((p) => p >= before));
});
test('a real repeat brakes then returns smoothly', () => {
  const m = new ReadingMotion();
  m.reset(200);
  m.observe(240, 0, 40, true);
  simulate(m, 0, 0.5);
  m.observe(30, 0.5, 40, true);
  const p = simulate(m, 0.5, 4);
  assert.ok(Math.abs(p.at(-1)! - 30) < 1);
  assert.ok(
    Math.max(...p.map((v, i) => (i ? Math.abs(v - p[i - 1]) : 0))) < 15,
  );
});
test('large recognition bursts are speed-limited instead of teleporting', () => {
  const m = new ReadingMotion();
  m.reset(0);
  m.observe(900, 0, 80, true);
  assert.ok(m.step(1 / 60, 1 / 60, 75, 500, true) < 2);
  const p = simulate(m, 1 / 60, 4);
  assert.ok(p.at(-1)! > 850);
  assert.ok(
    Math.max(...p.map((v, i) => (i ? v - p[i - 1] : 0))) <= 1000 / 60 + 0.01,
  );
});
test('motion is stable across refresh rates', () => {
  const run = (hz: number) => {
    const m = new ReadingMotion();
    m.reset(0);
    m.observe(100, 0, 30, true);
    for (let n = 1; n <= hz * 3; n++) m.step(n / hz, 1 / hz, 75, 500, true);
    return m.position;
  };
  assert.ok(Math.abs(run(60) - run(120)) < 1);
});
