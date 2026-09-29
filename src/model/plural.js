/** Русское склонение по числу: plural(3, ['курс', 'курса', 'курсов']) → 'курса'. */
export function plural(n, [one, few, many]) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
