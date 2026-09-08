'use client';

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { usePrompter } from '@/hooks/use-prompter';
import { useReadingMotion } from '@/hooks/use-reading-motion';
import { useFullscreen } from '@/hooks/use-fullscreen';
import {
  AudioLines,
  AlignLeft,
  AlignCenter,
  AlignRight,
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

  const [fontSize, setFontSize] = useState(48);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>(
    'center',
  );
  const [guide, setGuide] = useState(true);
  const engine = usePrompter(text, 'ru-RU', 'voice', 140);
  const scroller = useRef<HTMLDivElement>(null);
  const prompter = useRef<HTMLElement>(null);
  const fullscreen = useFullscreen(prompter);
  const [smooth, setSmooth] = useState(true);
  const [help, setHelp] = useState(false);
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    try {
      const draft = localStorage.getItem('ritm-script');
      if (draft !== null && draft.length <= 100000)
        setText(draft === LEGACY_SAMPLE ? SAMPLE : draft);
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
    } catch {}
  }, [alignment, restored]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        help ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof Element &&
          event.target.closest(
            'input,textarea,button,[role="slider"],[role="tab"],[role="switch"],[role="radio"],[contenteditable="true"]',
          ))
      )
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        engine.toggle();
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        engine.seek(engine.cursor + (event.key === 'ArrowDown' ? 4 : -4));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [engine.toggle, engine.seek, engine.cursor, help]);
  useReadingMotion(
    scroller,
    engine.cursor,
    engine.running,
    engine.wpm,
    smooth,
    text,
    fontSize,
    100,
    'voice',
    alignment,
  );
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
          className={`prompter${fullscreen.expanded ? ' is-expanded' : ''}`}
        >
          <div className="stage-toolbar">
            <div>
              <span className="document-icon">
                <FileText size={16} />
              </span>
              <span>Ритм — презентация</span>
              <span className="doc-meta">
                {words} слов · ~{Math.max(1, Math.ceil(words / 140))} мин
              </span>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={fullscreen.toggle}
              aria-label={
                fullscreen.expanded ? 'Выйти из полного экрана' : 'Полный экран'
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
          <div className="reading-stage">
            {guide && (
              <div className="focus-guide">
                <ChevronRight size={18} />
                <span />
              </div>
            )}
            <div className="script-scroll" ref={scroller}>
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
                {text.split('\n').map((line, i) => (
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
          <div className="transport">
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
                  onClick={engine.reset}
                >
                  <RotateCcw size={18} />
                </button>
                <button className="start-button" onClick={engine.toggle}>
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
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog">
          <DialogTitle>Как читать с суфлёром</DialogTitle>
          <DialogDescription>
            Вставьте сценарий во вкладке «Текст», нажмите «Начать чтение» и
            разрешите микрофон. Читайте естественно — прокрутка подстраивается
            под речь.
          </DialogDescription>
          <p>
            На паузах движение замедляется. Повтор предыдущей фразы возвращает
            текст назад. Кнопка в правом верхнем углу разворачивает суфлёр.
          </p>
          <p>
            На iPhone можно повернуть телефон горизонтально. В Safari для
            распознавания может потребоваться включённая Siri или диктовка.
          </p>
          <p>
            Звук обрабатывает служба распознавания вашего браузера и может
            передавать его на свои серверы. Сам сайт не записывает и не
            сохраняет аудио. Для запуска может требоваться интернет.
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
