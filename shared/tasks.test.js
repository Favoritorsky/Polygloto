import { describe, expect, it } from 'vitest';
import { TASK_TYPE_IDS, checkTaskAnswer, normalizeAnswer, orderTokens, sanitizeTaskData, taskProblems } from './tasks.js';
import { sanitizeBlocks } from './content.js';

describe('реестр', () => {
  it('содержит пять типов v1 и три типа v2', () => {
    expect(TASK_TYPE_IDS).toEqual([
      'multiple_choice',
      'fill_blank',
      'matching',
      'translation',
      'free_input',
      'multiple_select',
      'sentence_order',
      'listening',
    ]);
  });
});

describe('normalizeAnswer', () => {
  it('регистр, пробелы и финальная пунктуация не важны', () => {
    expect(normalizeAnswer('  Mi  Moku!  ')).toBe('mi moku');
    expect(normalizeAnswer('Я ем.')).toBe('я ем');
  });
});

describe('multiple_choice', () => {
  const data = sanitizeTaskData('multiple_choice', {
    question: 'Как «хороший»?',
    options: [
      { id: 'a', text: 'pona' },
      { id: 'b', text: 'ike' },
    ],
    correctOptionId: 'a',
  });
  it('проверяет выбранный вариант', () => {
    expect(checkTaskAnswer('multiple_choice', data, 'a').correct).toBe(true);
    expect(checkTaskAnswer('multiple_choice', data, 'b').correct).toBe(false);
    expect(checkTaskAnswer('multiple_choice', data, undefined).correct).toBe(false);
  });
  it('неизвестный правильный id заменяется первым вариантом, дубли id убираются', () => {
    const d = sanitizeTaskData('multiple_choice', {
      options: [
        { id: 'x', text: '1' },
        { id: 'x', text: '2' },
      ],
      correctOptionId: 'zzz',
    });
    expect(d.options).toHaveLength(1);
    expect(d.correctOptionId).toBe('x');
  });
  it('сообщает о незаполненном задании', () => {
    expect(taskProblems('multiple_choice', sanitizeTaskData('multiple_choice', {}))).not.toHaveLength(0);
    expect(taskProblems('multiple_choice', data)).toEqual([]);
  });
});

describe('fill_blank', () => {
  const data = sanitizeTaskData('fill_blank', { before: 'mi', after: 'e kili', answers: ['moku', ' Moku ', ''] });
  it('пустые ответы автора отбрасываются', () => {
    expect(data.answers).toEqual(['moku', 'Moku']);
  });
  it('без учёта регистра и пробелов', () => {
    expect(checkTaskAnswer('fill_blank', data, ' MOKU ').correct).toBe(true);
    expect(checkTaskAnswer('fill_blank', data, 'lape').correct).toBe(false);
    expect(checkTaskAnswer('fill_blank', data, '').correct).toBe(false);
  });
});

describe('matching', () => {
  const data = sanitizeTaskData('matching', {
    pairs: [
      { id: 'p1', left: 'toki', right: 'язык' },
      { id: 'p2', left: 'pona', right: 'хороший' },
      { id: 'p3', left: 'ike', right: 'плохой' },
    ],
  });
  it('все пары верны', () => {
    expect(checkTaskAnswer('matching', data, { p1: 'p1', p2: 'p2', p3: 'p3' })).toMatchObject({ correct: true });
  });
  it('частично неверно — результаты по каждой паре', () => {
    const r = checkTaskAnswer('matching', data, { p1: 'p2', p2: 'p1', p3: 'p3' });
    expect(r.correct).toBe(false);
    expect(r.results).toEqual({ p1: false, p2: false, p3: true });
  });
  it('незаполненный ответ — неверно', () => {
    expect(checkTaskAnswer('matching', data, {}).correct).toBe(false);
  });
  it('одинаковые правые части взаимозаменяемы', () => {
    const d = sanitizeTaskData('matching', {
      pairs: [
        { id: 'a', left: 'jan', right: 'человек' },
        { id: 'b', left: 'jan ale', right: 'человек' },
      ],
    });
    expect(checkTaskAnswer('matching', d, { a: 'b', b: 'a' }).correct).toBe(true);
  });
});

describe('translation', () => {
  const data = sanitizeTaskData('translation', { source: 'Я ем фрукты.', answers: ['mi moku e kili.', 'mi moku e kili mute'] });
  it('точное совпадение и допустимые варианты', () => {
    expect(checkTaskAnswer('translation', data, 'Mi moku e kili')).toMatchObject({ correct: true, expected: 'mi moku e kili.' });
    expect(checkTaskAnswer('translation', data, 'mi moku e kili mute!').correct).toBe(true);
    expect(checkTaskAnswer('translation', data, 'mi moku').correct).toBe(false);
  });
});

describe('free_input', () => {
  const data = sanitizeTaskData('free_input', { question: 'Сколько гласных?', answers: ['5', 'пять'] });
  it('любой из ответов автора', () => {
    expect(checkTaskAnswer('free_input', data, 'Пять').correct).toBe(true);
    expect(checkTaskAnswer('free_input', data, '5').correct).toBe(true);
    expect(checkTaskAnswer('free_input', data, 'шесть').correct).toBe(false);
  });
});

describe('задания внутри контента', () => {
  it('блок задания очищается, неизвестный тип отбрасывается', () => {
    const blocks = sanitizeBlocks([
      { type: 'task', id: 'b1', taskType: 'free_input', data: { question: 'q', answers: ['a'], secret: 1 } },
      { type: 'task', taskType: 'eval', data: {} },
    ]);
    expect(blocks).toEqual([{ type: 'task', id: 'b1', taskType: 'free_input', data: { question: 'q', answers: ['a'] } }]);
  });
});

describe('multiple_select', () => {
  const data = sanitizeTaskData('multiple_select', {
    question: 'Какие слова — глаголы?',
    options: [
      { id: 'a', text: 'hablar' },
      { id: 'b', text: 'casa' },
      { id: 'c', text: 'comer' },
      { id: 'd', text: '' },
    ],
    correctOptionIds: ['a', 'c', 'c', 'zzz'],
  });
  it('засчитывает только ровно все правильные', () => {
    expect(data.correctOptionIds).toEqual(['a', 'c']);
    expect(checkTaskAnswer('multiple_select', data, ['a', 'c']).correct).toBe(true);
    expect(checkTaskAnswer('multiple_select', data, ['c', 'a']).correct).toBe(true);
    expect(checkTaskAnswer('multiple_select', data, ['a']).correct).toBe(false);
    expect(checkTaskAnswer('multiple_select', data, ['a', 'b', 'c']).correct).toBe(false);
    expect(checkTaskAnswer('multiple_select', data, []).correct).toBe(false);
    expect(checkTaskAnswer('multiple_select', data, null).correct).toBe(false);
  });
  it('пустой вариант не влияет на проверку, отмечает ошибки по вариантам', () => {
    const r = checkTaskAnswer('multiple_select', data, ['a', 'b', 'd']);
    expect(r.results).toEqual({ a: true, b: false, c: false });
  });
  it('без отмеченных правильных задание не готово', () => {
    const empty = sanitizeTaskData('multiple_select', {
      question: 'q',
      options: [
        { id: 'a', text: '1' },
        { id: 'b', text: '2' },
      ],
      correctOptionIds: [],
    });
    expect(taskProblems('multiple_select', empty)).toContain('Не отмечен ни один правильный вариант.');
    expect(checkTaskAnswer('multiple_select', empty, []).correct).toBe(false);
    expect(taskProblems('multiple_select', data)).toEqual([]);
  });
});

describe('sentence_order', () => {
  const data = sanitizeTaskData('sentence_order', {
    instruction: 'Составьте',
    answers: ['  Yo   me llamo Ana. ', 'Me llamo Ana yo', ''],
  });
  it('слова делятся по пробелам, ответы нормализуются', () => {
    expect(orderTokens(data.answers[0])).toEqual(['Yo', 'me', 'llamo', 'Ana.']);
    expect(data.answers).toEqual(['Yo me llamo Ana.', 'Me llamo Ana yo']);
  });
  it('принимает основной и допустимый порядок, без учёта регистра и точки', () => {
    expect(checkTaskAnswer('sentence_order', data, ['yo', 'me', 'llamo', 'Ana.']).correct).toBe(true);
    expect(checkTaskAnswer('sentence_order', data, ['Me', 'llamo', 'Ana.', 'Yo']).correct).toBe(true);
    expect(checkTaskAnswer('sentence_order', data, ['llamo', 'me', 'Yo', 'Ana.']).correct).toBe(false);
    expect(checkTaskAnswer('sentence_order', data, 'Yo me llamo Ana').correct).toBe(false);
  });
  it('проверяет число слов и состав других вариантов', () => {
    expect(taskProblems('sentence_order', data)).toEqual([]);
    expect(taskProblems('sentence_order', sanitizeTaskData('sentence_order', { answers: ['Hola'] }))).not.toHaveLength(0);
    const other = sanitizeTaskData('sentence_order', { answers: ['Yo me llamo Ana', 'Yo soy Ana'] });
    expect(taskProblems('sentence_order', other)).toContain('Другие варианты должны состоять из тех же слов, что и первый.');
  });
});

describe('listening', () => {
  const base = {
    audio: { kind: 'url', url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Es-hola.ogg' },
    question: 'Что прозвучало?',
    options: [
      { id: 'a', text: 'hola' },
      { id: 'b', text: 'adiós' },
    ],
    correctOptionId: 'a',
    answers: ['hola'],
  };
  it('режим выбора и режим ввода', () => {
    const choice = sanitizeTaskData('listening', base);
    expect(checkTaskAnswer('listening', choice, 'a').correct).toBe(true);
    expect(checkTaskAnswer('listening', choice, 'b').correct).toBe(false);
    const input = sanitizeTaskData('listening', { ...base, mode: 'input' });
    expect(checkTaskAnswer('listening', input, ' Hola! ').correct).toBe(true);
    expect(checkTaskAnswer('listening', input, 'a').correct).toBe(false);
    expect(taskProblems('listening', choice)).toEqual([]);
  });
  it('без аудио или с недопустимой ссылкой задание не готово', () => {
    for (const audio of [
      null,
      { kind: 'url', url: 'https://evil.example/x.mp3' },
      { kind: 'url', url: 'javascript:alert(1)' },
      { kind: 'file', id: '../x' },
    ]) {
      const d = sanitizeTaskData('listening', { ...base, audio });
      expect(d.audio).toBeNull();
      expect(taskProblems('listening', d)).toContain('Нет аудио.');
    }
    expect(sanitizeTaskData('listening', { ...base, audio: { kind: 'file', id: 'abc123' } }).audio).toEqual({ kind: 'file', id: 'abc123' });
  });
});
