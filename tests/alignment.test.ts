import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScriptMatcher, normalize } from '../lib/alignment.ts';
const script =
  'Хорошая история начинается не с идеальных слов она начинается с тебя С того во что ты веришь С того чем хочешь поделиться С мысли которая не отпускает Не торопись Сделай вдох Представь что говоришь с другом а не с объективом камеры';
const words = script.split(' '),
  m = new ScriptMatcher(words);
test('ordinary and fast chunks follow the exact final word', () => {
  assert.equal(m.locate('Хорошая история начинается', -1)?.index, 2);
  assert.equal(
    m.locate('не с идеальных слов она начинается с тебя', 2)?.index,
    10,
  );
});
test('a pause or unrelated speech cannot move the cursor', () => {
  assert.equal(m.locate('', 12), null);
  assert.equal(m.locate('Сколько стоит билет в аэропорт', 12), null);
  assert.equal(m.locate('и', 12), null);
});
test('repeating an earlier phrase moves backwards', () => {
  assert.equal(m.locate('Хорошая история начинается', 27)?.index, 2);
  assert.equal(
    m.locate('Представь что говоришь с другом хорошая история начинается', 39)
      ?.index,
    2,
  );
});
test('filler, dropped words and minor recognition errors are tolerated', () => {
  assert.equal(m.locate('хорошая эээ история начинается', -1)?.index, 2);
  assert.equal(m.locate('история начинаетса не с идеальных слов', 0)?.index, 6);
});
test('repeated interim result is idempotent and corrections can recover', () => {
  let r = m.locate('хорошая история начинается', -1)!;
  assert.equal(m.locate('хорошая история начинается', r.index)?.index, r.index);
  assert.equal(m.locate('хорошая история начинается не с', r.index)?.index, 4);
});
test('normalizes Cyrillic, punctuation and numbers', () => {
  assert.deepEqual(normalize('Ёж, 2026!'), [
    'еж',
    'две',
    'тысячи',
    'двадцать',
    'шесть',
  ]);
  const n = new ScriptMatcher(['В', '2026', 'году', 'мы', 'начинаем']);
  assert.equal(n.locate('в две тысячи двадцать шесть году', -1)?.index, 2);
});
test('a unique long phrase permits resynchronizing beyond the local window', () => {
  const s = [
    ...Array(200).fill('фон'),
    'совершенно',
    'уникальная',
    'фраза',
    'помогает',
    'найти',
    'позицию',
  ];
  assert.equal(
    new ScriptMatcher(s).locate(
      'совершенно уникальная фраза помогает найти позицию',
      0,
    )?.index,
    205,
  );
});
test('a single distant common word never causes a jump', () => {
  assert.equal(m.locate('камеры', 0), null);
});
test('identical remote repetitions do not select an arbitrary occurrence', () => {
  const s = [
    ...Array(300).fill('фон'),
    'совершенно',
    'уникальная',
    'фраза',
    'помогает',
    ...Array(50).fill('фон'),
    'совершенно',
    'уникальная',
    'фраза',
    'помогает',
  ];
  assert.equal(
    new ScriptMatcher(s).locate('совершенно уникальная фраза помогает', 0),
    null,
  );
});
