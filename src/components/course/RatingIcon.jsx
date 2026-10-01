/**
 * Значок оценки курса: простая стрелка вверх («нравится») или вниз («не нравится»).
 * Нарочно не эмодзи и не лицо, чтобы не путать оценку курса с эмодзи-реакциями.
 */
export default function RatingIcon({ direction }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" aria-hidden="true" focusable="false" data-rating-icon={direction}>
      <path d={direction === 'up' ? 'M8 1.5 14.5 9H10.5v5.5h-5V9H1.5z' : 'M8 14.5 1.5 7h4V1.5h5V7h4z'} fill="currentColor" />
    </svg>
  );
}
