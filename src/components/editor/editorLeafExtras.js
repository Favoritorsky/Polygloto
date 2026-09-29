import styles from './editorLeafExtras.module.css';

/** Дополнительное оформление листа в редакторе: ручная ссылка на словарь. */
export function dictionaryLeafExtra(dictionaryById) {
  return (leaf) => {
    if (!leaf.dictRef) return null;
    const entry = dictionaryById.get(leaf.dictRef);
    return {
      className: entry ? styles.dictRef : styles.dictRefBroken,
      title: entry ? `Словарь: ${entry.word} — ${entry.translation}` : 'Ссылка на удалённое слово',
    };
  };
}
