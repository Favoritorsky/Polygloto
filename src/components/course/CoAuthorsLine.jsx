import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useSubscription.js';
import { loadDisplayNames } from '../../services/gamificationService.js';

/** «Соавторы: …» со ссылками на профили (v2). */
export default function CoAuthorsLine({ uids, className }) {
  const list = uids ?? [];
  const names = useAsync(() => loadDisplayNames(list), list.length > 0 ? list.join(',') : null);
  if (list.length === 0) return null;
  const shown = list.filter((uid) => names.data?.get(uid) !== null);
  if (shown.length === 0) return null;
  return (
    <p className={className}>
      {shown.length === 1 ? 'Соавтор' : 'Соавторы'}:{' '}
      {shown.map((uid, i) => (
        <Fragment key={uid}>
          {i > 0 && ', '}
          <Link to={`/users/${uid}`}>{names.data?.get(uid) ?? '…'}</Link>
        </Fragment>
      ))}
    </p>
  );
}
