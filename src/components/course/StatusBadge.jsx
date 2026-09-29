import Badge from '../ui/Badge.jsx';
import { STATUS_LABELS, STATUS_TONES } from '../../model/courseStatus.js';

export default function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status] ?? status}</Badge>;
}
