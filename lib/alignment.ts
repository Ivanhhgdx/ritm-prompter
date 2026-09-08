// Deterministic alignment: no model, requests, or audio processing here.
export type Token = { word: string; displayIndex: number };
const ONES = [
  'ноль',
  'один',
  'два',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
];
const TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
];
const TENS = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
];
const HUNDREDS = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
];
function numberWords(value: string): string {
  const n = Number(value);
  if (n === 0) return ONES[0];
  if (n > 999999 || value.length > 6)
    return value
      .split('')
      .map((x) => ONES[Number(x)])
      .join(' ');
  const under1000 = (v: number, feminine = false): string => {
    const out: string[] = [];
    if (v >= 100) out.push(HUNDREDS[Math.floor(v / 100)]);
    v %= 100;
    if (v >= 10 && v < 20) out.push(TEENS[v - 10]);
    else {
      if (v >= 20) out.push(TENS[Math.floor(v / 10)]);
      v %= 10;
      if (v) out.push(feminine && v < 3 ? ['', 'одна', 'две'][v] : ONES[v]);
    }
    return out.join(' ');
  };
  if (n < 1000) return under1000(n);
  const k = Math.floor(n / 1000),
    last = k % 10;
  const suffix =
    k % 100 >= 11 && k % 100 <= 14
      ? 'тысяч'
      : last === 1
        ? 'тысяча'
        : last >= 2 && last <= 4
          ? 'тысячи'
          : 'тысяч';
  return `${under1000(k, true)} ${suffix} ${under1000(n % 1000)}`.trim();
}
export function normalize(value: string, lang = 'ru-RU'): string[] {
  let text = value.toLocaleLowerCase(lang).replace(/ё/g, 'е');
  if (lang.startsWith('ru')) text = text.replace(/\d+/g, numberWords);
  return text.match(/[\p{L}\p{N}]+/gu) || [];
}
export function tokenizeScript(words: string[], lang = 'ru-RU'): Token[] {
  return words.flatMap((w, i) =>
    normalize(w, lang).map((word) => ({ word, displayIndex: i })),
  );
}
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1)
    return 0;
  // One-character recognition/morphology tolerance, never fuzzy-match short function words.
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length] <= 1 ? 0.78 : 0;
}
type Cell = { score: number; matches: number; exact: number; start: number };
export type Match = {
  index: number;
  tokenIndex: number;
  confidence: number;
  matched: number;
};
export class ScriptMatcher {
  tokens: Token[];
  private endings = new Map<string, number[]>();
  private lang: string;
  constructor(words: string[], lang = 'ru-RU') {
    this.lang = lang;
    this.tokens = tokenizeScript(words, lang);
    this.tokens.forEach((t, i) => {
      const list = this.endings.get(t.word) || [];
      list.push(i);
      this.endings.set(t.word, list);
    });
  }
  locate(transcript: string, cursor: number): Match | null {
    const spoken = normalize(transcript, this.lang).slice(-12);
    if (!spoken.length || !this.tokens.length) return null;
    let tokenCursor = this.tokens.findIndex(
      (t) => t.displayIndex >= Math.max(0, cursor),
    );
    if (tokenCursor < 0) tokenCursor = this.tokens.length - 1;
    const tail = spoken.at(-1)!;
    const candidates = new Set(this.endings.get(tail) || []);
    for (
      let i = Math.max(0, tokenCursor - 90);
      i < Math.min(this.tokens.length, tokenCursor + 121);
      i++
    )
      if (similarity(tail, this.tokens[i].word) > 0.7) candidates.add(i);
    const ranked: {
      end: number;
      score: number;
      confidence: number;
      matched: number;
      start: number;
    }[] = [];
    for (const end of candidates) {
      const distance = end - tokenCursor;
      if (spoken.length === 1) {
        if (
          Math.abs(distance) > 2 ||
          tail.length < 4 ||
          tail !== this.tokens[end].word
        )
          continue;
        ranked.push({
          end,
          score: 1 - Math.abs(distance) * 0.04,
          confidence: 1,
          matched: 1,
          start: end,
        });
        continue;
      }
      // Short suffixes let an intentional repeat override older words in the same recognition result.
      let best: (typeof ranked)[number] | null = null;
      for (const length of [
        ...new Set([
          Math.min(3, spoken.length),
          Math.min(4, spoken.length),
          Math.min(8, spoken.length),
          spoken.length,
        ]),
      ]) {
        const query = spoken.slice(-length),
          start = Math.max(0, end - length - 5),
          segment = this.tokens.slice(start, end + 1);
        let prev: Cell[] = Array.from(
          { length: segment.length + 1 },
          (_, j) => ({ score: 0, matches: 0, exact: 0, start: start + j }),
        );
        for (let i = 1; i <= query.length; i++) {
          const row: Cell[] = [
            { score: -0.85 * i, matches: 0, exact: 0, start },
          ];
          for (let j = 1; j <= segment.length; j++) {
            const sim = similarity(query[i - 1], segment[j - 1].word),
              base = prev[j - 1];
            const diagonal = {
              score: base.score + (sim ? 2 * sim : -1.35),
              matches: base.matches + (sim ? 1 : 0),
              exact: base.exact + (sim === 1 ? 1 : 0),
              start: base.matches ? base.start : start + j - 1,
            };
            const insertion = { ...prev[j], score: prev[j].score - 0.85 };
            const deletion = { ...row[j - 1], score: row[j - 1].score - 0.95 };
            row[j] = [diagonal, insertion, deletion].sort(
              (a, b) => b.score - a.score,
            )[0];
          }
          prev = row;
        }
        const cell = prev[segment.length],
          coverage = cell.matches / query.length,
          span = end - cell.start + 1;
        const remote = Math.abs(distance) > 90;
        const backward = distance < -2;
        if (
          cell.matches < Math.min(query.length, backward ? 3 : 2) ||
          coverage < 0.67 ||
          cell.score / (2 * query.length) < 0.5
        )
          continue;
        if (remote && (cell.exact < 4 || coverage < 0.8)) continue;
        if (backward && (cell.exact < 3 || coverage < 0.74)) continue;
        if (span > cell.matches + 4) continue;
        const score =
          cell.score / (2 * query.length) +
          Math.min(cell.matches, 8) * 0.045 -
          Math.min(Math.abs(distance), 200) * 0.0012;
        const result = {
          end,
          score,
          confidence: coverage,
          matched: cell.matches,
          start: cell.start,
        };
        if (!best || score > best.score) best = result;
      }
      if (best) ranked.push(best);
    }
    ranked.sort((a, b) => b.score - a.score);
    const winner = ranked[0];
    if (!winner) return null;
    // Identical phrases elsewhere in a long script require a clear positional winner.
    if (
      Math.abs(winner.end - tokenCursor) > 90 &&
      ranked[1] &&
      winner.score - ranked[1].score < 0.065
    )
      return null;
    return {
      index: this.tokens[winner.end].displayIndex,
      tokenIndex: winner.end,
      confidence: winner.confidence,
      matched: winner.matched,
    };
  }
}
