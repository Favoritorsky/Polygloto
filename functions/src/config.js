import { setGlobalOptions } from 'firebase-functions/v2';
import { FUNCTIONS_REGION } from '../shared/schema.js';

export const REGION = FUNCTIONS_REGION;

// Общие настройки для всех v2-функций.
setGlobalOptions({ region: REGION, maxInstances: 10 });
