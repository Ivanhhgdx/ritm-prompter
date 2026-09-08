import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findResumeWord, ManualPosition } from '../lib/manual-position.ts';
import { ScriptMatcher } from '../lib/alignment.ts';
const centers = [0, 0, 0, 75, 75, 150, 150, 225, 225, 300, 300];

test('resume selects the first word on the line at the focus band', () => {
  assert.equal(findResumeWord(centers, 148), 5);
  assert.equal(findResumeWord(centers, 218), 7);
  assert.equal(findResumeWord([], 0), null);
});
test('paused rewind changes the reading anchor and holds the chosen view until speech arrives', () => {
  const p = new ManualPosition();
  p.begin(300);
  assert.equal(p.scroll(75), true);
  assert.equal(p.resume(centers, 75), 3);
  assert.equal(p.shouldHold(2), true);
  assert.equal(p.shouldHold(2), true);
  assert.equal(p.shouldHold(3), false);
});
test('forward seeking and rewinding to the beginning both work', () => {
  const p = new ManualPosition();
  p.begin(0);
  p.scroll(300);
  assert.equal(p.resume(centers, 300), 9);
  p.begin(300);
  p.scroll(0);
  assert.equal(p.resume(centers, 0), 0);
  assert.equal(p.shouldHold(-1), true);
});
test('ordinary animation scroll events do not become a manual seek', () => {
  const p = new ManualPosition();
  assert.equal(p.scroll(225), false);
  assert.equal(p.resume(centers, 225), null);
});
test('touch without scrolling does not replace the speech position', () => {
  const p = new ManualPosition();
  p.begin(225);
  assert.equal(p.scroll(225), false);
  assert.equal(p.resume(centers, 225), null);
});
test('reset cancels pending manual selection', () => {
  const p = new ManualPosition();
  p.begin(300);
  p.scroll(75);
  p.clear();
  assert.equal(p.resume(centers, 75), null);
  assert.equal(p.shouldHold(-1), false);
});
test('after manually rewinding, repeated phrases match the new location', () => {
  const words =
    'начало хороший день сегодня продолжаем далее снова хороший день сегодня конец'.split(
      ' ',
    );
  const matcher = new ScriptMatcher(words);
  const p = new ManualPosition();
  p.begin(300);
  p.scroll(0);
  const chosen = p.resume([0, 0, 0, 0, 75, 75, 150, 150, 150, 150, 225], 0)!;
  assert.equal(matcher.locate('хороший день сегодня', chosen - 1)?.index, 3);
});
