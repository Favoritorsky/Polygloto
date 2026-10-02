import { listCuratedLanguages } from '../services/languageService.js';
import { useAsync } from './useSubscription.js';

/** Курируемый список языков: { data: [{ id, name }], loading, error, retry }. */
export function useCuratedLanguages() {
  return useAsync(listCuratedLanguages, 'curatedLanguages');
}
