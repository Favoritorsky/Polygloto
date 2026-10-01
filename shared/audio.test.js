import { describe, expect, it } from 'vitest';
import {
  AUDIO_LIMITS,
  collectAudioIds,
  isValidAudioDataUrl,
  normalizeAudioMime,
  sanitizeAudioRef,
  validateAudioFile,
  validateAudioUrl,
  withAudioMime,
} from './audio.js';

describe('validateAudioUrl', () => {
  it('принимает прямые ссылки на файлы Викисклада', () => {
    expect(validateAudioUrl('https://upload.wikimedia.org/wikipedia/commons/1/1f/LL-Q1321_(spa)-Hola.wav').url).toMatch(
      /^https:\/\/upload\.wikimedia\.org\//,
    );
    expect(validateAudioUrl(' https://upload.wikimedia.org/a/b.MP3#t=1 ').url).toBe('https://upload.wikimedia.org/a/b.MP3');
  });
  it('отклоняет другие хосты, http, порты, логины и не-аудио', () => {
    for (const bad of [
      'http://upload.wikimedia.org/a.mp3',
      'https://example.com/a.mp3',
      'https://upload.wikimedia.org.evil.com/a.mp3',
      'https://user@upload.wikimedia.org/a.mp3',
      'https://upload.wikimedia.org:8443/a.mp3',
      'https://upload.wikimedia.org/a.html',
      'https://upload.wikimedia.org/a.mp3.exe',
      'javascript:alert(1)',
      'data:audio/mpeg;base64,AAAA',
      '',
      'не ссылка',
    ]) {
      expect(validateAudioUrl(bad).error, bad).toBeTruthy();
    }
  });
});

describe('файлы', () => {
  it('нормализует MIME и расширение', () => {
    expect(normalizeAudioMime('audio/x-wav')).toBe('audio/wav');
    expect(normalizeAudioMime('audio/x-m4a')).toBe('audio/mp4');
    expect(normalizeAudioMime('', 'rec.OGG')).toBe('audio/ogg');
    expect(normalizeAudioMime('video/mp4', 'a.txt')).toBeNull();
  });
  it('проверяет тип и размер', () => {
    expect(validateAudioFile({ type: 'audio/mpeg', size: 1000, name: 'a.mp3' })).toEqual({ mime: 'audio/mpeg' });
    expect(validateAudioFile({ type: 'audio/mpeg', size: AUDIO_LIMITS.FILE_MAX_BYTES + 1, name: 'a.mp3' }).error).toBeTruthy();
    expect(validateAudioFile({ type: 'image/png', size: 10, name: 'a.png' }).error).toBeTruthy();
    expect(validateAudioFile({ type: 'audio/mpeg', size: 0, name: 'a.mp3' }).error).toBeTruthy();
  });
  it('data URL: только аудио в base64 и не больше лимита', () => {
    expect(isValidAudioDataUrl(withAudioMime('data:audio/x-wav;base64,UklGRg==', 'audio/wav'))).toBe(true);
    expect(isValidAudioDataUrl('data:text/html;base64,PGI+')).toBe(false);
    expect(isValidAudioDataUrl('data:audio/mpeg;base64,<script>')).toBe(false);
    // Максимальный файл после base64 укладывается в лимит data URL.
    const max = `data:audio/mpeg;base64,${'A'.repeat(Math.ceil(AUDIO_LIMITS.FILE_MAX_BYTES / 3) * 4)}`;
    expect(isValidAudioDataUrl(max)).toBe(true);
    expect(isValidAudioDataUrl(`data:audio/mpeg;base64,${'A'.repeat(AUDIO_LIMITS.DATA_URL_MAX)}`)).toBe(false);
  });
});

describe('ссылки на аудио в контенте', () => {
  it('sanitizeAudioRef пропускает только два вида', () => {
    expect(sanitizeAudioRef({ kind: 'file', id: 'x1', extra: 1 })).toEqual({ kind: 'file', id: 'x1' });
    expect(sanitizeAudioRef({ kind: 'url', url: 'https://upload.wikimedia.org/a.ogg' })).toEqual({
      kind: 'url',
      url: 'https://upload.wikimedia.org/a.ogg',
    });
    expect(sanitizeAudioRef({ kind: 'blob', id: 'x' })).toBeNull();
    expect(sanitizeAudioRef('https://upload.wikimedia.org/a.ogg')).toBeNull();
  });
  it('collectAudioIds находит файлы во вложенных данных', () => {
    const ids = collectAudioIds([
      [{ data: { audio: { kind: 'file', id: 'a1' } } }],
      { audio: { kind: 'url', url: 'https://x' } },
      { a: [{ kind: 'file', id: 'b2' }] },
    ]);
    expect([...ids].sort()).toEqual(['a1', 'b2']);
  });
});
