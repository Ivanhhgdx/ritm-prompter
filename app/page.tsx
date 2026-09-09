'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type CSSProperties,
} from 'react';
import { usePrompter } from '@/hooks/use-prompter';
import { useReadingMotion } from '@/hooks/use-reading-motion';
import { useMobileRecorder } from '@/hooks/use-mobile-recorder';
import { useFullscreen } from '@/hooks/use-fullscreen';
import {
  Camera,
  CameraOff,
  Download,
  X,
  Video,
  AudioLines,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Share,
  PlusSquare,
  SlidersHorizontal,
  FileText,
  Maximize,
  Minimize,
  Play,
  Pause,
  RotateCcw,
  CircleHelp,
  ArrowUpRight,
  Mic,
  ChevronRight,
  Check,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import { SAMPLE, LEGACY_SAMPLE } from '@/lib/sample';

export default function Home() {
  const [text, setText] = useState(SAMPLE);

  const [compact, setCompact] = useState(false);
  const [twoLines, setTwoLines] = useState(false);
  // Only the reader changes; editing, saving and speech alignment use the original.
  const readerText = useMemo(
    () => (compact ? text.replace(/[ \t]*[\r\n]+[ \t\r\n]*/g, ' ') : text),
    [text, compact],
  );
  const [fontSize, setFontSize] = useState(48);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>(
    'center',
  );
  const [guide, setGuide] = useState(true);
  const engine = usePrompter(text, 'ru-RU', 'voice', 140);
  const scroller = useRef<HTMLDivElement>(null);
  const prompter = useRef<HTMLElement>(null);
  const fullscreen = useFullscreen(prompter);
  const camera = useMobileRecorder(fullscreen.expandInWindow, engine.stop);
  const [smooth, setSmooth] = useState(true);
  const [help, setHelp] = useState(false);
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    try {
      const draft = localStorage.getItem('ritm-script');
      if (draft !== null && draft.length <= 100000)
        setText(draft === LEGACY_SAMPLE ? SAMPLE : draft);
      setCompact(localStorage.getItem('ritm-compact') === 'true');
      setTwoLines(localStorage.getItem('ritm-two-lines') === 'true');
      const storedAlignment = localStorage.getItem('ritm-alignment');
      if (
        storedAlignment === 'left' ||
        storedAlignment === 'center' ||
        storedAlignment === 'right'
      )
        setAlignment(storedAlignment);
    } catch {
      setSaved(false);
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem('ritm-script', text);
        setSaved(true);
      } catch {
        setSaved(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [text, restored]);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem('ritm-alignment', alignment);
      localStorage.setItem('ritm-compact', String(compact));
      localStorage.setItem('ritm-two-lines', String(twoLines));
    } catch {}
  }, [alignment, compact, twoLines, restored]);
  const motion = useReadingMotion(
    scroller,
    engine.cursor,
    engine.running,
    engine.wpm,
    smooth,
    readerText,
    fontSize,
    100,
    'voice',
    alignment,
    twoLines,
  );
  const toggleReading = useCallback(() => {
    if (engine.running || engine.connecting) {
      engine.stop();
      return;
    }
    const fromWord = motion.prepareResume();
    engine.start(fromWord === null ? undefined : fromWord);
  }, [
    engine.running,
    engine.connecting,
    engine.stop,
    engine.start,
    motion.prepareResume,
  ]);
  const resetReading = useCallback(() => {
    motion.resetView();
    engine.reset();
  }, [motion.resetView, engine.reset]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        camera.review ||
        help ||
        fullscreen.homeScreenHelp ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof Element &&
          event.target.closest(
            'input,textarea,button,[role="slider"],[role="tab"],[role="switch"],[role="radio"],[role="checkbox"],[contenteditable="true"]',
          ))
      )
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        toggleReading();
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        motion.clearManualPosition();
        engine.seek(engine.cursor + (event.key === 'ArrowDown' ? 4 : -4));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [
    toggleReading,
    motion.clearManualPosition,
    engine.seek,
    engine.cursor,
    help,
    camera.review,
    fullscreen.homeScreenHelp,
  ]);

  let wordIndex = 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const progress = words ? Math.round(((engine.cursor + 1) / words) * 100) : 0;
  const time = (seconds: number) =>
    `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0')}`;
  return (
    <main className={`app-shell${fullscreen.expanded ? ' is-presenting' : ''}`}>
      <header className="app-header">
        <a className="brand" href="./" aria-label="Ритм — главная">
          <span className="brand-symbol">
            <AudioLines size={21} />
          </span>
          ритм<span className="brand-caption">СУФЛЁР</span>
        </a>
        <div className="header-caption">В кадре. В моменте. В своём ритме.</div>
        <button
          className="icon-button"
          aria-label="Как пользоваться"
          onClick={() => setHelp(true)}
        >
          <CircleHelp size={19} />
        </button>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <span className="eyebrow">ВАША СТУДИЯ</span>
            <span className="tiny-dot" />
          </div>
          <Tabs defaultValue="settings">
            <TabsList className="side-tabs">
              <TabsTrigger value="settings">
                <SlidersHorizontal size={15} />
                Настройки
              </TabsTrigger>
              <TabsTrigger value="text">
                <FileText size={15} />
                Текст
              </TabsTrigger>
            </TabsList>
            <TabsContent value="settings" className="settings-panel">
              <section className="settings-section">
                <h2>Прокрутка</h2>
                <div className="mode-selected">
                  <span className="mode-icon">
                    <Mic size={18} />
                  </span>
                  <div>
                    <strong>Вслед за голосом</strong>
                    <p>Ваш темп, ваши паузы</p>
                  </div>
                  <Check size={16} />
                </div>
                <p className="field-note">
                  Говорите естественно. Текст будет следовать за вашей речью.
                </p>
              </section>
              <section className="settings-section">
                <div className="control-label switch-row">
                  <label htmlFor="smooth">Плавная прокрутка</label>
                  <Switch
                    id="smooth"
                    checked={smooth}
                    onCheckedChange={setSmooth}
                  />
                </div>
                <p className="field-note">
                  Ровное движение с мягкой коррекцией по голосу. На паузах текст
                  замедляется.
                </p>
              </section>
              <section className="settings-section">
                <h2>Вид текста</h2>
                <div className="control-label">
                  <span>Размер шрифта</span>
                  <output>
                    {fontSize}
                    <small> px</small>
                  </output>
                </div>
                <Slider
                  aria-label="Размер шрифта"
                  min={28}
                  max={76}
                  value={[fontSize]}
                  onValueChange={(v) =>
                    setFontSize(Array.isArray(v) ? v[0] : v)
                  }
                />
                <div className="range-labels">
                  <span>Аа</span>
                  <span>Аа</span>
                </div>
                <RadioGroup
                  className="alignment-control"
                  aria-label="Выравнивание текста"
                  value={alignment}
                  onValueChange={(value) => {
                    if (
                      value === 'left' ||
                      value === 'center' ||
                      value === 'right'
                    )
                      setAlignment(value);
                  }}
                  style={
                    {
                      '--alignment-position': [
                        'left',
                        'center',
                        'right',
                      ].indexOf(alignment),
                    } as CSSProperties
                  }
                >
                  <span className="alignment-indicator" aria-hidden="true" />
                  {(
                    [
                      ['left', 'По левому краю', AlignLeft],
                      ['center', 'По центру', AlignCenter],
                      ['right', 'По правому краю', AlignRight],
                    ] as const
                  ).map(([value, label, Icon]) => (
                    <label
                      key={value}
                      htmlFor={`alignment-${value}`}
                      className="alignment-option"
                      title={label}
                    >
                      <RadioGroupItem
                        id={`alignment-${value}`}
                        value={value}
                        className="alignment-radio"
                        aria-label={label}
                      />
                      <Icon size={18} aria-hidden="true" />
                    </label>
                  ))}
                </RadioGroup>
                <div className="control-label switch-row">
                  <label htmlFor="guide">Линия фокуса</label>
                  <Switch
                    id="guide"
                    checked={guide}
                    onCheckedChange={setGuide}
                  />
                </div>
              </section>
              <section className="settings-section">
                <div className="control-label">
                  <span>Язык распознавания</span>
                  <span className="language-pill">RU</span>
                </div>
                <p className="field-note">Русский</p>
              </section>
            </TabsContent>
            <TabsContent value="text" className="editor-panel">
              <section className="settings-section">
                <div className="control-label">
                  <label htmlFor="script">Ваш сценарий</label>
                  <span>{words} слов</span>
                </div>
                <textarea
                  id="script"
                  className="script-editor"
                  value={text}
                  maxLength={100000}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Вставьте текст выступления…"
                />
                <p className="field-note">
                  Текст можно редактировать прямо здесь.
                </p>
                <button
                  className="script-preset-button"
                  onClick={() => setText(SAMPLE)}
                >
                  Рекламный сценарий
                </button>
              </section>
            </TabsContent>
          </Tabs>
          <div className="sidebar-bottom">
            <span className="small-wave">
              <AudioLines size={18} />
            </span>
            <p>
              Меньше отвлечений.
              <br />
              <strong>Больше тебя.</strong>
            </p>
            <ArrowUpRight size={16} />
          </div>
        </aside>
        <section
          ref={prompter}
          className={`prompter${twoLines ? ' two-lines' : ''}${fullscreen.expanded ? ' is-expanded' : ''}${camera.active ? ' has-camera' : ''}`}
        >
          {camera.active && (
            <video
              className="camera-preview"
              ref={camera.video}
              autoPlay
              muted
              playsInline
              aria-label="Предпросмотр фронтальной камеры"
              onClick={() => {
                void camera.video.current?.play().catch(() => {});
              }}
            />
          )}
          <div className="stage-toolbar" inert={camera.review}>
            <div>
              <span className="document-icon">
                <FileText size={16} />
              </span>
              <span>Ритм — презентация</span>
              <span className="doc-meta">
                {words} слов · ~{Math.max(1, Math.ceil(words / 140))} мин
              </span>
            </div>
            <div className="stage-actions">
              {camera.clip && !camera.review && !camera.active && (
                <button
                  className="icon-button"
                  aria-label="Открыть запись"
                  onClick={() => {
                    engine.stop();
                    camera.setReview(true);
                  }}
                >
                  <Video size={18} />
                </button>
              )}
              <button
                type="button"
                className="icon-button mobile-camera-button"
                aria-label={
                  camera.phase === 'opening'
                    ? 'Отменить включение камеры'
                    : camera.active
                      ? 'Выключить камеру'
                      : 'Включить камеру'
                }
                title={
                  camera.active
                    ? 'Выключить камеру'
                    : 'Включить фронтальную камеру'
                }
                aria-pressed={camera.active}
                onClick={() =>
                  camera.active || camera.phase === 'opening'
                    ? camera.close()
                    : void camera.enable()
                }
              >
                {camera.active ? <CameraOff size={18} /> : <Camera size={18} />}
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  if (fullscreen.expanded && camera.active) camera.close();
                  fullscreen.toggle();
                }}
                aria-label={
                  fullscreen.expanded
                    ? 'Выйти из полного экрана'
                    : 'Полный экран'
                }
                title={
                  fullscreen.expanded
                    ? 'Выйти из полного экрана (Esc)'
                    : 'Полный экран'
                }
                aria-pressed={fullscreen.expanded}
              >
                {fullscreen.expanded ? (
                  <Minimize size={17} />
                ) : (
                  <Maximize size={17} />
                )}
              </button>
            </div>
          </div>
          <div className="reading-stage" inert={camera.review}>
            {guide && (
              <div className="focus-guide">
                <ChevronRight size={18} />
                <span />
              </div>
            )}
            <div
              className="script-scroll"
              ref={scroller}
              tabIndex={0}
              aria-label="Текст суфлёра. На паузе прокрутите до нужной строки и продолжите чтение."
            >
              <article
                className="script-content"
                style={
                  {
                    fontSize,
                    textAlign: alignment,
                    '--reader-font-size': `${fontSize}px`,
                  } as CSSProperties
                }
              >
                {readerText.split('\n').map((line, i) => (
                  <div className="script-line" key={i}>
                    {line
                      ? line.split(/(\s+)/).map((piece, j) =>
                          !piece || /^\s+$/.test(piece) ? (
                            piece
                          ) : (
                            <span
                              data-word={wordIndex}
                              className={
                                wordIndex++ <= engine.cursor ? 'read-word' : ''
                              }
                              key={j}
                            >
                              {piece}
                            </span>
                          ),
                        )
                      : '\u00a0'}
                  </div>
                ))}
              </article>
            </div>
            <div className="stage-label">
              <span className="tiny-dot" />
              ГОТОВЫ К ЗАПИСИ
            </div>
          </div>
          <div className="transport" inert={camera.review}>
            {camera.error && !camera.review && (
              <p className="camera-error" role="alert">
                {camera.error}
              </p>
            )}
            {camera.phase === 'opening' && (
              <p className="camera-note" role="status">
                Разрешите фронтальную камеру и микрофон…
              </p>
            )}
            {engine.error && (
              <p
                role="alert"
                style={{
                  color: '#ffc4a9',
                  fontSize: 14,
                  lineHeight: 1.6,
                  marginBottom: 16,
                }}
              >
                {engine.error}
              </p>
            )}
            <div className="transport-top">
              <div className="session-time">
                {time(engine.elapsed)}{' '}
                <span>/ ~{time(Math.ceil((words / 140) * 60))}</span>
              </div>
              <div className="transport-buttons">
                <button
                  className="icon-button"
                  aria-label="В начало"
                  onClick={resetReading}
                >
                  <RotateCcw size={18} />
                </button>
                <button className="start-button" onClick={toggleReading}>
                  {engine.running ? (
                    <Pause size={17} fill="currentColor" />
                  ) : (
                    <Play size={17} fill="currentColor" />
                  )}
                  {engine.connecting
                    ? 'Отменить'
                    : engine.running
                      ? 'Пауза'
                      : engine.cursor >= 0
                        ? 'Продолжить'
                        : 'Начать чтение'}
                </button>
                <label
                  className="compact-toggle"
                  title="Скрыть переносы строк и пустые строки в суфлёре"
                >
                  <Checkbox
                    checked={compact}
                    onCheckedChange={setCompact}
                    aria-label="Без переносов"
                  />
                  <span className="compact-label">Без переносов</span>
                </label>
                <label
                  className="compact-toggle two-lines-toggle"
                  title="Показывать две строки сверху — над телефоном у камеры"
                >
                  <Checkbox
                    checked={twoLines}
                    onCheckedChange={setTwoLines}
                    aria-label="Две строки сверху"
                  />
                  <span>Две строки сверху</span>
                </label>
                <span className="key-hint">пробел</span>
              </div>
              <span className="progress-label">{progress}% прочитано</span>
            </div>
            <Progress
              className="reading-progress"
              aria-label="Прочитано"
              value={progress}
            />
            <div className="transport-bottom">
              <span>
                <Mic size={14} />
                {engine.status}
              </span>
              <span>
                ↑ ↓ <span className="shortcut-note">прокрутка</span>
              </span>
            </div>
          </div>
          {camera.active && (
            <div className="camera-controls">
              <div
                className="recording-time"
                role="timer"
                aria-label="Время записи"
              >
                <span
                  className={
                    camera.phase === 'recording'
                      ? 'recording-dot active'
                      : 'recording-dot'
                  }
                />
                {time(camera.seconds)}
                <small>
                  {camera.phase === 'paused'
                    ? 'Пауза'
                    : camera.phase === 'ready'
                      ? 'Камера готова'
                      : camera.phase === 'finishing'
                        ? 'Подготовка…'
                        : 'Запись'}
                </small>
              </div>
              <button
                className={`record-button${camera.phase !== 'ready' ? ' is-recording' : ''}`}
                aria-label={
                  camera.phase === 'ready'
                    ? 'Начать запись видео'
                    : 'Завершить запись видео'
                }
                disabled={camera.phase === 'finishing'}
                onClick={() => {
                  if (camera.phase === 'ready') {
                    if (
                      camera.record() &&
                      !engine.running &&
                      !engine.connecting
                    )
                      toggleReading();
                  } else camera.finish();
                }}
              >
                <span />
              </button>
              <div className="recording-actions">
                {(camera.phase === 'recording' ||
                  camera.phase === 'paused') && (
                  <button
                    className="icon-button"
                    aria-label={
                      camera.phase === 'paused'
                        ? 'Продолжить запись видео'
                        : 'Пауза записи видео'
                    }
                    onClick={() => {
                      camera.togglePause();
                      if (
                        camera.phase === 'paused' &&
                        !engine.running &&
                        !engine.connecting
                      )
                        toggleReading();
                    }}
                  >
                    {camera.phase === 'paused' ? (
                      <Play size={20} />
                    ) : (
                      <Pause size={20} />
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
          {camera.review && camera.clip && (
            <section className="camera-review" aria-label="Записанное видео">
              <div className="camera-review-heading">
                <strong>Ваш дубль</strong>
                <button
                  className="icon-button"
                  aria-label="Закрыть просмотр записи"
                  onClick={() => camera.setReview(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <video
                src={camera.clip.url}
                controls
                playsInline
                className="recorded-video"
              />
              <div className="camera-review-footer">
                {camera.error && (
                  <p role="alert" className="camera-error">
                    {camera.error}
                  </p>
                )}
                <p className="camera-note">
                  Видео без текста суфлёра ·{' '}
                  {(camera.clip.file.size / 1024 / 1024).toFixed(1)} МБ.
                  Сохраните его перед закрытием страницы.
                </p>
                <div className="camera-save-actions">
                  {camera.canShare && (
                    <button
                      className="start-button"
                      disabled={camera.sharing}
                      onClick={() => void camera.share()}
                    >
                      <Share size={17} />
                      Сохранить видео
                    </button>
                  )}
                  <a
                    className="script-preset-button"
                    href={camera.clip.url}
                    download={camera.clip.file.name}
                  >
                    <Download size={17} />
                    Скачать файл
                  </a>
                  <button
                    className="script-preset-button"
                    onClick={() => void camera.enable()}
                    disabled={camera.phase === 'opening'}
                  >
                    Новый дубль
                  </button>
                </div>
                {camera.canShare && (
                  <p className="camera-note">
                    В меню iPhone выберите «Сохранить видео», если этот пункт
                    доступен, или «Сохранить в Файлы».
                  </p>
                )}
              </div>
            </section>
          )}
        </section>
      </div>
      <footer className="app-footer">
        <span>Ритм подстраивается под вас.</span>
        <span>
          {saved
            ? 'Текст сохранён в этом браузере'
            : 'Не удалось сохранить текст в браузере'}{' '}
          <span className="tiny-dot" />
        </span>
      </footer>
      {fullscreen.homeScreenHelp && (
        <Dialog
          open={fullscreen.homeScreenHelp}
          onOpenChange={fullscreen.setHomeScreenHelp}
        >
          <DialogContent className="help-dialog install-dialog">
            <DialogTitle>Суфлёр без панелей Safari</DialogTitle>
            <DialogDescription>
              На iPhone откройте «Ритм» с экрана «Домой», чтобы читать без
              вкладок и адресной строки.
            </DialogDescription>
            <ol className="install-steps">
              <li>
                <Share size={19} aria-hidden="true" />
                <span>
                  В Safari нажмите <strong>«Поделиться»</strong>. Иногда эта
                  кнопка находится в меню «Ещё».
                </span>
              </li>
              <li>
                <PlusSquare size={19} aria-hidden="true" />
                <span>
                  Выберите <strong>«На экран „Домой“»</strong>.
                </span>
              </li>
              <li>
                <span className="install-step-number">3</span>
                <span>
                  Если есть переключатель{' '}
                  <strong>«Открыть как веб-приложение»</strong>, включите его и
                  нажмите «Добавить».
                </span>
              </li>
              <li>
                <span className="install-step-number">4</span>
                <span>
                  Запустите <strong>«Ритм» с нового значка</strong>, поверните
                  телефон и нажмите кнопку полного экрана.
                </span>
              </li>
            </ol>
            <p className="field-note">
              Во вкладке сайта кнопка не может скрыть панели самого Safari.
              Запуск со значка убирает их; системные индикаторы iPhone могут
              оставаться.
            </p>
            <button
              type="button"
              className="script-preset-button"
              onClick={fullscreen.expandInWindow}
            >
              Пока развернуть внутри Safari
            </button>
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog">
          <DialogTitle>Как читать с суфлёром</DialogTitle>
          <DialogDescription>
            Вставьте сценарий во вкладке «Текст», нажмите «Начать чтение» и
            разрешите микрофон. Читайте естественно — прокрутка подстраивается
            под речь.
          </DialogDescription>
          <p>
            На паузе можно прокрутить текст пальцем или колёсиком до нужной
            строки у центральной полоски. Нажмите «Продолжить», чтобы читать с
            этого места. На паузах движение замедляется. Повтор предыдущей фразы
            возвращает текст назад. Галочка «Без переносов» убирает пустые
            строки и объединяет абзацы только в суфлёре; отключите её, чтобы
            вернуть исходный вид. Кнопка в правом верхнем углу разворачивает
            суфлёр.
          </p>
          <p>
            Для чтения без панелей Safari добавьте сайт на экран «Домой» через
            меню «Поделиться» и запускайте с его значка. На iPhone можно
            повернуть телефон горизонтально. В Safari для распознавания может
            потребоваться включённая Siri или диктовка.
          </p>
          <p>
            Звук для прокрутки обрабатывает служба распознавания браузера и
            может передавать его на свои серверы. В мобильном режиме камеры
            видео со звуком записывается только после нажатия красной кнопки и
            остаётся в этом браузере, пока вы не сохраните файл. На сервер сайта
            запись не отправляется.
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
