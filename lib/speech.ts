export type SpeechResult = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string; confidence: number };
};
export type SpeechEvent = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResult };
};
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  onstart: (() => void) | null;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}
export type RecognitionConstructor = {
  new (): Recognition;
  available?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<string>;
};
export function speechConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}
export const speechError = (code: string): string =>
  ({
    'not-allowed':
      'Нет доступа к микрофону. Разрешите его в настройках сайта и нажмите «Продолжить».',
    'service-not-allowed':
      'Браузер не разрешает распознавание. Откройте сайт в браузере с поддержкой речи или выберите автопрокрутку.',
    'audio-capture': 'Микрофон не найден. Подключите его и попробуйте снова.',
    network:
      'Сервис распознавания недоступен. Проверьте интернет или выберите автопрокрутку.',
    'language-not-supported':
      'Этот язык недоступен для распознавания в вашем браузере.',
    aborted: 'Распознавание остановлено. Можно продолжить чтение.',
  })[code] ||
  'Не удалось запустить распознавание. Попробуйте снова или выберите автопрокрутку.';
