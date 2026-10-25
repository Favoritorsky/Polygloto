import { describe, expect, it } from 'vitest';
import { chatIdForLanguage, chatPath } from './chat.js';

describe('чаты языков', () => {
  it('id чата строится из languageLower', () => {
    expect(chatIdForLanguage('аркавок')).toBe('lang-аркавок');
    expect(chatIdForLanguage('  Токи  Пона ')).toBe('lang-токи пона');
  });

  it('«/» в названии не ломает путь документа', () => {
    expect(chatIdForLanguage('сербский/хорватский')).toBe('lang-сербский_хорватский');
  });

  it('адрес страницы кодирует название и курс', () => {
    expect(chatPath('токи пона')).toBe('/chats/%D1%82%D0%BE%D0%BA%D0%B8%20%D0%BF%D0%BE%D0%BD%D0%B0');
    expect(chatPath('ru', 'c1')).toBe('/chats/ru?course=c1');
  });
});
