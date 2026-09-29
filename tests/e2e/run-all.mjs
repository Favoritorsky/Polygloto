// Запускает все e2e-сценарии по очереди. Предварительно:
//   npm run emulators   и   npm run dev:emu
// Если Chromium для Playwright установлен нестандартно: CHROMIUM_PATH=/путь/к/chrome
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const scenarios = readdirSync(dir).filter((f) => /^stage\d+\.mjs$/.test(f)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
for (const file of scenarios) {
  console.log(`\n▶ ${file}`);
  await import(pathToFileURL(`${dir}/${file}`).href);
}
