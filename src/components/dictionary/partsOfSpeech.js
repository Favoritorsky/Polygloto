import { PARTS_OF_SPEECH } from '../../../shared/schema.js';

export const POS_LABELS = Object.fromEntries(PARTS_OF_SPEECH.map((p) => [p.id, p.label]));
