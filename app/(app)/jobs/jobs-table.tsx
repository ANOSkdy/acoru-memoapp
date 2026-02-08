import Link from 'next/link';
import type { JobListItem } from '@/lib/jobs';

const formatDate = (value: string | Date | null) => {
  if (!value) {
    return '—';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const formatDateOnly = (value: string | Date | null) => {
  if (!value) {
    return '—';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium'
  }).format(date);
};

type JobsTableProps = {
  items: JobListItem[];
};

export default function JobsTable({ items }: JobsTableProps) {
  if (items.length === 0) {
    return (
      <div className="card jobs-empty">
        <p>該当する求人がありません。</p>
      </div>
    );
  }

  return (
    <div className="jobs-table__wrap">
      <table className="jobs-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Job</th>
            <th>Status</th>
            <th>Job Offer ID</th>
            <th>Freshness</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((job) => (
            <tr key={job.id}>
              <td>
                <Link href={`/clients/${job.clientId}`}>
                  {job.clientName ?? '—'}
                </Link>
              </td>
              <td>
                <div className="jobs-table__job">
                  <Link href={`/jobs/${job.id}`}>
                    {job.internalTitle ?? 'Untitled job'}
                  </Link>
                  {job.hasApprovedRevision && (
                    <span className="jobs-table__meta">Approved revision</span>
                  )}
                </div>
              </td>
              <td>
                <span className="jobs-table__status">{job.status}</span>
              </td>
              <td>{job.jobOfferId ?? '—'}</td>
              <td>
                <div className="jobs-table__job">
                  <span>{formatDateOnly(job.freshnessExpiresAt)}</span>
                  {job.isRefreshCandidate ? (
                    <span className="jobs-table__meta">Refresh candidate</span>
                  ) : null}
                </div>
              </td>
              <td>{formatDate(job.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
