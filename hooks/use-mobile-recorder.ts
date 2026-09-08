'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'off' | 'opening' | 'ready' | 'recording' | 'paused' | 'finishing';
type Clip = { file: File; url: string };

export function useMobileRecorder(onReady: () => void, onStop: () => void) {
  const [phase, setPhase] = useState<Phase>('off');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [sharing, setSharing] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const media = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const opening = useRef(false);
  const clipUrl = useRef('');
  const elapsed = useRef(0);
  const started = useRef(0);
  const callbacks = useRef({ onReady, onStop });
  callbacks.current = { onReady, onStop };

  const release = useCallback(() => {
    media.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    media.current = null;
    if (mounted.current) setStream(null);
  }, []);

  const finish = useCallback(() => {
    const current = recorder.current;
    if (!current || current.state === 'inactive') return;
    callbacks.current.onStop();
    if (current.state === 'recording')
      elapsed.current += performance.now() - started.current;
    setSeconds(Math.floor(elapsed.current / 1000));
    setPhase('finishing');
    try {
      current.stop();
    } catch {
      setError('Не удалось завершить запись. Попробуйте ещё раз.');
      setPhase(current.state === 'paused' ? 'paused' : 'recording');
    }
  }, []);

  const close = useCallback(() => {
    generation.current++;
    opening.current = false;
    callbacks.current.onStop();
    if (recorder.current && recorder.current.state !== 'inactive') {
      finish(); // Keep the final dataavailable event before releasing the tracks.
    } else {
      release();
      setPhase('off');
    }
  }, [finish, release]);

  const enable = useCallback(async () => {
    if (opening.current || media.current || recorder.current) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError(
        'Этот браузер не поддерживает запись видео. Откройте сайт в актуальной версии Safari или Chrome.',
      );
      return;
    }
    callbacks.current.onStop();
    const ticket = ++generation.current;
    opening.current = true;
    setPhase('opening');
    setError('');
    try {
      const result = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!mounted.current || ticket !== generation.current) {
        result.getTracks().forEach((track) => track.stop());
        return;
      }
      media.current = result;
      setStream(result);
      setPhase('ready');
      setReview(false);
      setSeconds(0);
      callbacks.current.onReady();
      result.getTracks().forEach((track) => {
        track.onended = () => {
          setError('Камера или микрофон отключились. Запись завершена.');
          close();
        };
      });
    } catch (cause) {
      if (!mounted.current || ticket !== generation.current) return;
      const name = cause instanceof DOMException ? cause.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Разрешите доступ к камере и микрофону в настройках этого сайта и попробуйте снова.'
          : name === 'OverconstrainedError' || name === 'NotFoundError'
            ? 'Не удалось найти фронтальную камеру и микрофон на этом устройстве.'
            : 'Не удалось включить камеру. Закройте другие приложения с камерой и попробуйте снова.',
      );
      setPhase('off');
    } finally {
      if (ticket === generation.current) opening.current = false;
    }
  }, [close]);

  const record = useCallback(() => {
    const source = media.current;
    if (!source || recorder.current) return false;
    setError('');
    const chunks: Blob[] = [];
    try {
      const mimeType = [
        'video/mp4',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const current = new MediaRecorder(source, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 4_000_000,
        audioBitsPerSecond: 128_000,
      });
      recorder.current = current;
      current.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      current.onerror = () => {
        setError(
          'Браузер прервал запись. Доступная часть ролика будет подготовлена к сохранению.',
        );
        callbacks.current.onStop();
        if (current.state !== 'inactive') finish();
      };
      current.onstop = () => {
        recorder.current = null;
        release();
        if (!mounted.current) return;
        callbacks.current.onStop();
        setPhase('off');
        // System share targets expect the container MIME without codec parameters.
        const type = (current.mimeType || chunks[0]?.type || 'video/mp4')
          .split(';')[0]
          .trim();
        const blob = new Blob(chunks, { type });
        if (!blob.size) {
          setError(
            'Браузер вернул пустую запись. Попробуйте записать новый дубль.',
          );
          return;
        }
        const extension = type.includes('mp4') ? 'mp4' : 'webm';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const file = new File([blob], `ritm-${stamp}.${extension}`, { type });
        if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
        clipUrl.current = URL.createObjectURL(file);
        setClip({ file, url: clipUrl.current });
        setReview(true);
      };
      current.start(1000);
      elapsed.current = 0;
      started.current = performance.now();
      setSeconds(0);
      setPhase('recording');
      return true;
    } catch {
      recorder.current = null;
      setError('Не удалось начать запись видео. Попробуйте ещё раз.');
      setPhase('ready');
      return false;
    }
  }, [finish, release]);

  const togglePause = useCallback(() => {
    const current = recorder.current;
    if (!current) return;
    try {
      if (current.state === 'recording') {
        current.pause();
        elapsed.current += performance.now() - started.current;
        setSeconds(Math.floor(elapsed.current / 1000));
        setPhase('paused');
        callbacks.current.onStop();
      } else if (current.state === 'paused') {
        current.resume();
        started.current = performance.now();
        setPhase('recording');
      }
    } catch {
      setError('Браузер не смог переключить паузу записи.');
    }
  }, []);

  const share = useCallback(async () => {
    if (!clip || sharing) return;
    setSharing(true);
    setError('');
    try {
      await navigator.share({ files: [clip.file] });
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError'))
        setError(
          'Не удалось открыть сохранение. Используйте кнопку «Скачать файл».',
        );
    } finally {
      if (mounted.current) setSharing(false);
    }
  }, [clip, sharing]);

  useEffect(() => {
    const element = video.current;
    if (!element || !stream) return;
    element.srcObject = stream;
    void element
      .play()
      .catch(() =>
        setError(
          'Не удалось включить предпросмотр. Выключите и снова включите камеру.',
        ),
      );
    return () => {
      element.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(
      () =>
        setSeconds(
          Math.floor(
            (elapsed.current + performance.now() - started.current) / 1000,
          ),
        ),
      250,
    );
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    const hide = () => {
      if (document.hidden) close();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', close);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', close);
    };
  }, [close]);

  useEffect(() => {
    if (phase !== 'recording' && phase !== 'paused') return;
    let cancelled = false;
    let lock: WakeLockSentinel | undefined;
    void navigator.wakeLock
      ?.request('screen')
      .then((result) => {
        if (cancelled) void result.release();
        else lock = result;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void lock?.release().catch(() => {});
    };
  }, [phase]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      const current = recorder.current;
      if (current) {
        current.onstop = null;
        current.ondataavailable = null;
        current.onerror = null;
        if (current.state !== 'inactive') {
          try {
            current.stop();
          } catch {}
        }
      }
      release();
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
    };
  }, [release]);

  let canShare = false;
  try {
    canShare = Boolean(clip && navigator.canShare?.({ files: [clip.file] }));
  } catch {}
  return {
    phase,
    active: Boolean(stream),
    video,
    clip,
    review,
    setReview,
    error,
    seconds,
    sharing,
    canShare,
    enable,
    close,
    record,
    finish,
    togglePause,
    share,
  };
}
