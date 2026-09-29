// Копирует shared/ в functions/shared/, чтобы Cloud Functions использовали
// ту же схему данных, что и фронтенд (папка functions деплоится отдельно).
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'functions/shared');
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(resolve(root, 'shared'), target, { recursive: true });
console.log('shared/ → functions/shared/');
