import { useEffect, useState } from 'react';
import { subscribeToReactions } from '../services/reactionService.js';

/** Реакции на набор целей: Map targetId → { counts, mine }. */
export function useReactions(courseId, targetType, targetIds, uid) {
  const key = `${courseId}|${targetType}|${targetIds.join(',')}|${uid ?? ''}`;
  const [state, setState] = useState({ key: null, data: new Map(), error: null });
  useEffect(() => {
    const [cId, type, ids, u] = key.split('|');
    return subscribeToReactions(
      cId,
      type,
      ids ? ids.split(',') : [],
      u || null,
      (data) => setState({ key, data, error: null }),
      (error) => setState({ key, data: new Map(), error }),
    );
  }, [key]);
  return state.key === key ? state : { data: new Map(), error: null };
}
