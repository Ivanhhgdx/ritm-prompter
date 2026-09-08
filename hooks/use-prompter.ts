'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScriptMatcher } from '@/lib/alignment';
import { speechConstructor, speechError, type Recognition } from '@/lib/speech';
export type Mode = 'voice' | 'auto';
export function usePrompter(
  text: string,
  lang: string,
  mode: Mode,
  speed: number,
) {
  const words = useMemo(() => text.match(/\S+/g) || [], [text]);
  const matcher = useMemo(() => new ScriptMatcher(words, lang), [words, lang]);
  const [cursor, setCursor] = useState(-1),
    [running, setRunning] = useState(false),
    [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(''),
    [heard, setHeard] = useState(''),
    [status, setStatus] = useState('Готов к чтению');
  const [elapsed, setElapsed] = useState(0),
    [wpm, setWpm] = useState(0),
    [supported, setSupported] = useState<boolean | null>(null);
  const [local, setLocal] = useState(false);
  const localReady = useRef(false),
    watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const position = useRef(-1),
    recognition = useRef<Recognition | null>(null),
    wanted = useRef(false),
    generation = useRef(0);
  const restart = useRef<ReturnType<typeof setTimeout> | null>(null),
    lastHeard = useRef(0),
    started = useRef(0),
    attempts = useRef(0);
  const progressSamples = useRef<{ time: number; index: number }[]>([]);
  const move = useCallback(
    (index: number) => {
      const next = Math.max(-1, Math.min(words.length - 1, index));
      position.current = next;
      setCursor(next);
    },
    [words.length],
  );
  const stop = useCallback(() => {
    wanted.current = false;
    generation.current++;
    if (watchdog.current) clearTimeout(watchdog.current);
    if (restart.current) clearTimeout(restart.current);
    const r = recognition.current;
    recognition.current = null;
    if (r) {
      r.onend = null;
      r.onresult = null;
      r.onstart = null;
      r.onerror = null;
      try {
        r.abort();
      } catch {}
    }
    setConnecting(false);
    setRunning(false);
    setStatus('На паузе');
    progressSamples.current = [];
  }, []);
  const reset = useCallback(() => {
    stop();
    move(-1);
    setElapsed(0);
    setWpm(0);
    setHeard('');
    setError('');
    setStatus('Готов к чтению');
  }, [move, stop]);
  const seek = useCallback(
    (index: number) => {
      stop();
      move(index);
      setError('');
      setHeard('');
    },
    [stop, move],
  );
  useEffect(() => {
    setSupported(!!speechConstructor());
    return stop;
  }, [stop]);
  useEffect(() => {
    reset();
  }, [text, lang, mode, reset]);
  useEffect(() => {
    let cancelled = false;
    localReady.current = false;
    const Ctor = speechConstructor();
    if (Ctor?.available)
      void Ctor.available({ langs: [lang], processLocally: true })
        .then((value) => {
          if (!cancelled) localReady.current = value === 'available';
        })
        .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lang]);
  const start = useCallback(
    (fromWord?: number) => {
      if (wanted.current) return;
      if (!words.length) {
        setError('Добавьте текст во вкладке «Текст».');
        return;
      }
      if (fromWord !== undefined && Number.isFinite(fromWord)) {
        move(Math.max(0, Math.min(words.length - 1, Math.floor(fromWord))) - 1);
        setWpm(0);
      } else if (position.current >= words.length - 1) {
        move(-1);
        setElapsed(0);
      }
      setError('');
      setHeard('');
      wanted.current = true;
      const ticket = ++generation.current;
      attempts.current = 0;
      progressSamples.current = [];
      if (mode === 'auto') {
        setRunning(true);
        setStatus('Автопрокрутка');
        return;
      }
      const Ctor = speechConstructor();
      if (!Ctor) {
        stop();
        setError(
          'Этот браузер не поддерживает распознавание речи. Откройте сайт в Chrome или Safari либо выберите автопрокрутку.',
        );
        return;
      }
      if (!window.isSecureContext) {
        stop();
        setError('Для микрофона откройте сайт по защищённой ссылке HTTPS.');
        return;
      }
      setConnecting(true);
      setStatus('Подключаю микрофон…');
      // Keep start() in the original click gesture, including Safari.
      const processLocally = localReady.current;
      setLocal(processLocally);
      const launch = () => {
        if (!wanted.current || ticket !== generation.current) return;
        const r = new Ctor();
        recognition.current = r;
        r.lang = lang;
        r.continuous = true;
        r.interimResults = true;
        r.maxAlternatives = 1;
        if (processLocally) r.processLocally = true;
        let previousTranscript = '';
        r.onstart = () => {
          if (ticket !== generation.current) return;
          if (watchdog.current) clearTimeout(watchdog.current);
          setError('');
          started.current = performance.now();
          lastHeard.current = performance.now();
          setConnecting(false);
          setRunning(true);
          setStatus('Слушаю. Начните читать');
        };
        r.onresult = (e) => {
          if (!wanted.current || ticket !== generation.current) return;
          const segments: string[] = [];
          for (
            let i = Math.max(0, e.results.length - 3);
            i < e.results.length;
            i++
          )
            segments.push(e.results[i][0].transcript);
          const transcript = segments.join(' ').trim();
          if (!transcript || transcript === previousTranscript) return;
          previousTranscript = transcript;
          attempts.current = 0;
          lastHeard.current = performance.now();
          setHeard(transcript.split(/\s+/).slice(-14).join(' '));
          const found = matcher.locate(transcript, position.current);
          if (!found) {
            setStatus('Жду фразу из текста');
            return;
          }
          const old = position.current;
          move(found.index);
          setStatus(
            found.index < old - 2 ? 'Вернулись к фразе' : 'Следую за голосом',
          );
          const now = performance.now();
          if (found.index < old) progressSamples.current = [];
          if (found.index > old) {
            progressSamples.current.push({ time: now, index: found.index });
            progressSamples.current = progressSamples.current.filter(
              (s) => now - s.time < 12000,
            );
            const first = progressSamples.current[0];
            if (now - first.time > 1500) {
              const pace = Math.round(
                ((found.index - first.index) * 60000) / (now - first.time),
              );
              if (pace > 0 && pace < 600)
                setWpm((tempo) =>
                  tempo ? Math.round(tempo * 0.65 + pace * 0.35) : pace,
                );
            }
          }
          if (found.index >= words.length - 1) {
            stop();
            setStatus('Текст прочитан');
          }
        };
        r.onerror = (e) => {
          if (ticket !== generation.current) return;
          if (e.error === 'no-speech') {
            setStatus('Жду вашу речь');
            return;
          }
          stop();
          setError(speechError(e.error));
        };
        r.onend = () => {
          if (!wanted.current || ticket !== generation.current) return;
          recognition.current = null;
          if (performance.now() - started.current < 1500) attempts.current++;
          else attempts.current = 0;
          if (attempts.current >= 3) {
            stop();
            setError(
              'Распознавание прерывается. Попробуйте другой браузер или автопрокрутку.',
            );
            return;
          }
          setStatus('Жду вашу речь');
          restart.current = setTimeout(launch, 350 + attempts.current * 400);
        };
        try {
          started.current = performance.now();
          r.start();
          watchdog.current = setTimeout(() => {
            if (ticket === generation.current)
              setError(
                'Браузер пока не запустил микрофон. Проверьте запрос разрешения у адресной строки. В Safari также проверьте, что Siri включена в системных настройках. Можно нажать «Отменить» и повторить запуск.',
              );
          }, 15000);
        } catch {
          stop();
          setError('Микрофон не запустился. Попробуйте ещё раз.');
        }
      };
      launch();
    },
    [matcher, lang, mode, words.length, move, stop],
  );
  const toggle = useCallback(() => {
    if (wanted.current) stop();
    else void start();
  }, [start, stop]);
  useEffect(() => {
    if (!running) return;
    const clock = setInterval(() => {
      setElapsed((v) => v + 1);
      if (mode === 'voice' && performance.now() - lastHeard.current > 2400)
        setStatus('Жду вашу речь');
    }, 1000);
    return () => clearInterval(clock);
  }, [running, mode]);
  useEffect(() => {
    if (!running || mode !== 'auto') return;
    const tick = setInterval(() => {
      if (position.current >= words.length - 1) {
        stop();
        setStatus('Текст прочитан');
        return;
      }
      move(position.current + 1);
    }, 60000 / speed);
    return () => clearInterval(tick);
  }, [running, mode, speed, words.length, move, stop]);
  // Never leave the microphone running in a hidden page.
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', stop);
    };
  }, [stop]);
  useEffect(() => {
    if (!running) return;
    let lock: { release: () => Promise<void> } | undefined,
      cancelled = false;
    const request = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: {
            request: (
              type: string,
            ) => Promise<{ release: () => Promise<void> }>;
          };
        };
        const result = await nav.wakeLock?.request('screen');
        if (cancelled) await result?.release();
        else lock = result;
      } catch {}
    };
    void request();
    return () => {
      cancelled = true;
      void lock?.release().catch(() => {});
    };
  }, [running]);
  return {
    words,
    cursor,
    running,
    connecting,
    error,
    heard,
    status,
    elapsed,
    wpm,
    supported,
    local,
    toggle,
    start,
    stop,
    reset,
    seek,
    setError,
  };
}
