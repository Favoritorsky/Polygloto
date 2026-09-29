import TextLeaf from './TextLeaf.jsx';
import styles from './TextBlock.module.css';

export function ParagraphView({ block }) {
  return (
    <p className={styles.paragraph}>
      {block.children.map((leaf, i) => (
        <TextLeaf key={i} leaf={leaf} />
      ))}
    </p>
  );
}

export function HeadingView({ block }) {
  const Tag = block.level === 3 ? 'h3' : 'h2';
  return (
    <Tag className={styles.heading}>
      {block.children.map((leaf, i) => (
        <TextLeaf key={i} leaf={leaf} />
      ))}
    </Tag>
  );
}
