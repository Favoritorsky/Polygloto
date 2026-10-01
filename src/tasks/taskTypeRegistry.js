/**
 * Реестр типов заданий (taskTypeRegistry). Каждый тип объединяет:
 *  - чистую логику из shared/tasks.js (create / sanitize / check / problems);
 *  - React-компоненты: Editor (форма автора) и Player (прохождение);
 *  - isComplete(data, answer) — можно ли уже нажать «Проверить».
 * Новый тип добавляется одной записью здесь + записью в shared/tasks.js,
 * без правок остального кода (редактор и рендер берут всё из реестра).
 */
import { TASK_DEFINITIONS, orderTokens } from '../../shared/tasks.js';
import FillBlankEditor from './editors/FillBlankEditor.jsx';
import FreeInputEditor from './editors/FreeInputEditor.jsx';
import ListeningEditor from './editors/ListeningEditor.jsx';
import MatchingEditor from './editors/MatchingEditor.jsx';
import MultipleChoiceEditor from './editors/MultipleChoiceEditor.jsx';
import MultipleSelectEditor from './editors/MultipleSelectEditor.jsx';
import SentenceOrderEditor from './editors/SentenceOrderEditor.jsx';
import TranslationEditor from './editors/TranslationEditor.jsx';
import FillBlankPlayer from './players/FillBlankPlayer.jsx';
import ListeningPlayer from './players/ListeningPlayer.jsx';
import MatchingPlayer from './players/MatchingPlayer.jsx';
import MultipleChoicePlayer from './players/MultipleChoicePlayer.jsx';
import MultipleSelectPlayer from './players/MultipleSelectPlayer.jsx';
import SentenceOrderPlayer from './players/SentenceOrderPlayer.jsx';
import { FreeInputPlayer, TranslationPlayer } from './players/TextAnswerPlayer.jsx';

const hasText = (_data, answer) => typeof answer === 'string' && answer.trim() !== '';
const isMatchingComplete = (data, answer) => data.pairs.filter((p) => p.left.trim() && p.right.trim()).every((p) => answer?.[p.id]);

export const taskTypeRegistry = new Map();

export function registerTaskType(type) {
  const definition = TASK_DEFINITIONS[type.id];
  if (!definition) throw new Error(`No shared definition for task type "${type.id}"`);
  taskTypeRegistry.set(type.id, { ...definition, ...type });
}

export function getTaskType(id) {
  return taskTypeRegistry.get(id) ?? null;
}

registerTaskType({
  id: 'multiple_choice',
  label: 'Выбор правильного ответа',
  Editor: MultipleChoiceEditor,
  Player: MultipleChoicePlayer,
  isComplete: (_data, answer) => Boolean(answer),
});

registerTaskType({
  id: 'fill_blank',
  label: 'Вставить пропущенное слово',
  Editor: FillBlankEditor,
  Player: FillBlankPlayer,
  isComplete: hasText,
});

registerTaskType({
  id: 'matching',
  label: 'Сопоставление пар',
  Editor: MatchingEditor,
  Player: MatchingPlayer,
  isComplete: isMatchingComplete,
});

registerTaskType({
  id: 'translation',
  label: 'Перевод предложения',
  Editor: TranslationEditor,
  Player: TranslationPlayer,
  isComplete: hasText,
});

registerTaskType({
  id: 'free_input',
  label: 'Введи ответ сам',
  Editor: FreeInputEditor,
  Player: FreeInputPlayer,
  isComplete: hasText,
});

// ---------- v2 ----------

registerTaskType({
  id: 'multiple_select',
  label: 'Несколько правильных ответов',
  Editor: MultipleSelectEditor,
  Player: MultipleSelectPlayer,
  isComplete: (_data, answer) => Array.isArray(answer) && answer.length > 0,
});

registerTaskType({
  id: 'sentence_order',
  label: 'Порядок слов',
  Editor: SentenceOrderEditor,
  Player: SentenceOrderPlayer,
  // Плеер хранит индексы слов из первого ответа; сверка — по самим словам.
  check: (data, answer) => {
    const words = orderTokens(data.answers[0]);
    return TASK_DEFINITIONS.sentence_order.check(
      data,
      (Array.isArray(answer) ? answer : []).map((i) => words[i] ?? ''),
    );
  },
  isComplete: (data, answer) => Array.isArray(answer) && answer.length === orderTokens(data.answers[0]).length,
});

registerTaskType({
  id: 'listening',
  label: 'Аудирование',
  Editor: ListeningEditor,
  Player: ListeningPlayer,
  isComplete: (data, answer) => (data.mode === 'input' ? hasText(data, answer) : Boolean(answer)),
});
