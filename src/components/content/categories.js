/** Какие категории встречаются в блоках. */
export function collectUsedCategories(blocks) {
  const used = new Set();
  for (const block of blocks ?? []) {
    for (const leaf of block.children ?? []) if (leaf.category) used.add(leaf.category);
  }
  return used;
}
