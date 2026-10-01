import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('..', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const hosting = JSON.parse(readFileSync(new URL('firebase.json', root), 'utf8')).hosting;
const cspRule = hosting.headers.find((h) => h.headers.some((x) => x.key === 'Content-Security-Policy'));
const csp = cspRule.headers.find((x) => x.key === 'Content-Security-Policy').value;

describe('Content-Security-Policy', () => {
  it('в index.html нет встроенных скриптов и обработчиков событий', () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attrs, body] of scripts) {
      expect(attrs).toMatch(/\bsrc=/);
      expect(body.trim()).toBe('');
    }
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it('скрипты только свои: без unsafe-inline и unsafe-eval', () => {
    const scriptSrc = csp.match(/script-src ([^;]+)/)[1];
    expect(scriptSrc.trim()).toBe("'self'");
  });

  it('строгая политика на всех страницах сайта, кроме служебных страниц Firebase /__/', () => {
    const re = new RegExp(cspRule.regex);
    for (const path of ['/', '/catalog', '/course/abc', '/assets/index.js', '/theme-init.js', '/_x']) expect(re.test(path)).toBe(true);
    for (const path of ['/__/auth/action', '/__/auth/handler', '/__/firebase/init.js']) expect(re.test(path)).toBe(false);
  });
});
