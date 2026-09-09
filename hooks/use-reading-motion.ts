'use client';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { findResumeWord, ManualPosition } from '@/lib/manual-position';
import { ReadingMotion } from '@/lib/reading-motion';
export function useReadingMotion(
  scroller: RefObject<HTMLDivElement | null>,
  cursor: number,
  running: boolean,
  wpm: number,
  smooth: boolean,
  text: string,
  fontSize: number,
  width: number,
  mode: string,
  alignment: 'left' | 'center' | 'right' = 'center',
  twoLines = false,
) {
  const controller = useRef(new ReadingMotion()),
    frames = useRef(0),
    lastTime = useRef(0);
  const selection = useRef(new ManualPosition());
  const measuredTwoLines = useRef(twoLines);
  const previousState = useRef({ cursor, running });
  const metrics = useRef<{
    centers: number[];
    anchors: number[];
    paragraphNext: number[];
    line: number;
    viewport: number;
    pixelsPerWord: number;
  }>({
    centers: [],
    anchors: [],
    paragraphNext: [],
    line: 74,
    viewport: 500,
    pixelsPerWord: 15,
  });
  const state = useRef({ running, smooth, cursor });
  state.current = { running, smooth, cursor };
  const drive = () => {
    cancelAnimationFrame(frames.current);
    lastTime.current = performance.now();
    const frame = (now: number) => {
      const el = scroller.current;
      if (!el) return;
      if (selection.current.armed || selection.current.dirty) {
        controller.current.reset(el.scrollTop);
        return;
      }
      const { line, viewport } = metrics.current;
      const dt = (now - lastTime.current) / 1000;
      lastTime.current = now;
      el.scrollTop = controller.current.step(
        now / 1000,
        dt,
        line,
        viewport,
        state.current.running,
      );
      if (state.current.running || Math.abs(controller.current.velocity) > 0.1)
        frames.current = requestAnimationFrame(frame);
    };
    frames.current = requestAnimationFrame(frame);
  };
  useEffect(() => {
    selection.current.clear();
  }, [text]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const begin = () => {
      if (state.current.running) return;
      selection.current.begin(el.scrollTop);
      cancelAnimationFrame(frames.current);
      controller.current.reset(el.scrollTop);
    };
    const scroll = () => {
      if (selection.current.scroll(el.scrollTop)) {
        cancelAnimationFrame(frames.current);
        controller.current.reset(el.scrollTop);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (['PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) begin();
    };
    el.addEventListener('wheel', begin, { passive: true });
    el.addEventListener('touchstart', begin, { passive: true });
    el.addEventListener('pointerdown', begin, { passive: true });
    el.addEventListener('scroll', scroll, { passive: true });
    el.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('wheel', begin);
      el.removeEventListener('touchstart', begin);
      el.removeEventListener('pointerdown', begin);
      el.removeEventListener('scroll', scroll);
      el.removeEventListener('keydown', key);
    };
  }, [scroller]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const layoutChanged = measuredTwoLines.current !== twoLines;
      const manualWord =
        layoutChanged && selection.current.shouldHold(state.current.cursor)
          ? findResumeWord(metrics.current.centers, el.scrollTop)
          : null;
      measuredTwoLines.current = twoLines;
      if (!twoLines) el.style.height = '';
      const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-word]'));
      if (!nodes.length) {
        metrics.current.anchors = [];
        metrics.current.centers = [];
        return;
      }
      const article = el.querySelector<HTMLElement>('article');
      const line =
        parseFloat(getComputedStyle(article!).lineHeight) || fontSize * 1.55;
      el.style.height = twoLines ? `${line * 2}px` : '';
      el.parentElement?.style.setProperty('--reading-line-height', `${line}px`);
      const box = el.getBoundingClientRect();
      const focusY = twoLines ? line / 2 : box.height / 2;
      // Lift the reading position slightly to compensate for recognition latency.
      const focusLead = twoLines ? 0 : line * 0.45;
      // Extra bottom space lets the final line reach the same reading position.
      if (article) {
        article.style.paddingTop = `${twoLines ? 0 : box.height / 2}px`;
        article.style.paddingBottom = `${box.height / 2 + focusLead}px`;
      }
      const centers = nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return rect.top + rect.height / 2 - box.top + el.scrollTop - focusY;
      });
      const anchors: number[] = [];
      let total = 0,
        lines = 0;
      for (let start = 0; start < nodes.length;) {
        let end = start + 1;
        while (
          end < nodes.length &&
          Math.abs(centers[end] - centers[start]) < 2
        )
          end++;
        const count = end - start;
        total += count;
        lines++;
        for (let i = start; i < end; i++)
          anchors[i] = Math.max(
            0,
            centers[i] +
              focusLead +
              (twoLines ? 0 : ((i - start + 0.5) / count - 0.5) * line * 0.85),
          );
        start = end;
      }
      // Finishing a paragraph brings the next paragraph into view, without
      // marking its words as spoken or predicting through the intervening silence.
      const paragraphNext: number[] = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        const currentLine = nodes[i].closest('.script-line');
        const nextLine = nodes[i + 1].closest('.script-line');
        if (!currentLine || !nextLine || currentLine === nextLine) continue;
        let sibling = currentLine.nextElementSibling;
        while (sibling && sibling !== nextLine) {
          if (!sibling.textContent?.trim()) {
            paragraphNext[i] = i + 1;
            break;
          }
          sibling = sibling.nextElementSibling;
        }
      }
      metrics.current = {
        centers,
        anchors,
        paragraphNext,
        line,
        viewport: box.height,
        pixelsPerWord: line / (total / lines),
      };
      const current = state.current.cursor;
      const index = Math.max(
        0,
        Math.min(
          manualWord ?? paragraphNext[current] ?? current,
          anchors.length - 1,
        ),
      );
      if (!layoutChanged && selection.current.shouldHold(current)) {
        controller.current.reset(el.scrollTop);
        return;
      }
      controller.current.reset(anchors[index] || 0);
      el.scrollTop = controller.current.position;
      drive();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frames.current);
    };
    // Geometry is rebuilt only when layout changes, never per animation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, fontSize, width, alignment, twoLines, scroller]);
  useEffect(() => {
    const el = scroller.current,
      { anchors, paragraphNext, pixelsPerWord } = metrics.current;
    const previous = previousState.current;
    previousState.current = { cursor, running };
    if (!el || !anchors.length) return;
    if (
      selection.current.shouldHold(cursor) ||
      (previous.cursor === cursor && previous.running !== running)
    ) {
      // Pause/resume freezes the current view; it never seeks to an old anchor.
      cancelAnimationFrame(frames.current);
      controller.current.reset(el.scrollTop);
      return;
    }
    const nextParagraph = paragraphNext[cursor];
    const target =
      anchors[
        Math.max(0, Math.min(nextParagraph ?? cursor, anchors.length - 1))
      ] || 0;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (!smooth || reduced) {
      controller.current.reset(target);
      el.scrollTop = target;
      return;
    }
    if (cursor < 0) {
      controller.current.reset(target);
      el.scrollTop = target;
      return;
    }
    controller.current.observe(
      target,
      performance.now() / 1000,
      (Math.max(60, wpm || 140) / 60) * pixelsPerWord,
      running && nextParagraph === undefined,
    );
    drive();
    // drive reads current state through refs, retaining velocity between speech packets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, running, wpm, smooth, mode]);
  const prepareResume = useCallback(() => {
    const el = scroller.current;
    if (!el) return null;
    cancelAnimationFrame(frames.current);
    const top = el.scrollTop;
    controller.current.reset(top);
    const fromWord = selection.current.resume(metrics.current.centers, top);
    el.scrollTop = top;
    return fromWord;
  }, [scroller]);
  const clearManualPosition = useCallback(() => {
    selection.current.clear();
  }, []);
  const resetView = useCallback(() => {
    selection.current.clear();
    cancelAnimationFrame(frames.current);
    const top = metrics.current.anchors[0] || 0;
    controller.current.reset(top);
    if (scroller.current) scroller.current.scrollTop = top;
  }, [scroller]);
  useEffect(() => () => cancelAnimationFrame(frames.current), []);
  return { prepareResume, clearManualPosition, resetView };
}
