import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { REACTION_EMOJIS } from '../../../shared/schema.js';
import RatingControl from './RatingControl.jsx';

describe('RatingControl', () => {
  const html = renderToStaticMarkup(<RatingControl likes={3} dislikes={1} mine="like" onVote={() => {}} />);

  it('рисует простые стрелки, а не эмодзи-реакции', () => {
    expect(html).toContain('data-rating-icon="up"');
    expect(html).toContain('data-rating-icon="down"');
    for (const emoji of [...REACTION_EMOJIS, '👎']) expect(html).not.toContain(emoji);
  });

  it('подписывает кнопки для экранного диктора и отмечает свой голос', () => {
    expect(html).toContain('aria-label="Нравится: 3"');
    expect(html).toContain('aria-label="Не нравится: 1"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });
});
