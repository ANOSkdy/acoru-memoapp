import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { getWorkspaceIdForUser } from '@/lib/workspaces';
import { listClientsForOrg, listJobs } from '@/lib/jobs';
import JobsTable from './jobs-table';
import { isValidUuid } from '@/lib/validation/uuid';

export const runtime = 'nodejs';

type JobsPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    client?: string;
    hasJobOfferId?: string;
    refreshCandidate?: string;
  };
};

const normalizeFilter = (value?: string) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const user = await requireUser();
  const orgId = await getWorkspaceIdForUser(user.id);

  if (!orgId) {
    notFound();
  }

  const search = normalizeFilter(searchParams?.q);
  const status = normalizeFilter(searchParams?.status);
  const client = normalizeFilter(searchParams?.client);
  const hasJobOfferId = normalizeFilter(searchParams?.hasJobOfferId);
  const refreshCandidate = normalizeFilter(searchParams?.refreshCandidate);

  const clientId = client && isValidUuid(client) ? client : null;

  const [jobs, clients] = await Promise.all([
    listJobs({
      orgId,
      clientId,
      search,
      status: status === 'active' || status === 'archived' ? status : null,
      hasJobOfferId:
        hasJobOfferId === 'yes' || hasJobOfferId === 'no'
          ? hasJobOfferId
          : null,
      refreshCandidate:
        refreshCandidate === 'yes' || refreshCandidate === 'no'
          ? refreshCandidate
          : null
    }),
    listClientsForOrg(orgId)
  ]);

  return (
    <div className="jobs">
      <div className="jobs-header">
        <div>
          <div className="badge">Jobs</div>
          <h1>求人一覧</h1>
          <p className="home-subtitle">
            顧客横断の求人を検索・フィルタできます。
          </p>
        </div>
        <div className="jobs-header__actions">
          <Link className="button" href="/jobs/new">
            Create Job
          </Link>
        </div>
      </div>

      <form className="jobs-filters" method="get">
        <div className="jobs-filters__field">
          <label className="jobs-label" htmlFor="q">
            Search
          </label>
          <input
            className="jobs-input"
            type="search"
            id="q"
            name="q"
            placeholder="求人名 or 顧客名"
            defaultValue={search ?? ''}
          />
        </div>
        <div className="jobs-filters__field">
          <label className="jobs-label" htmlFor="client">
            Client
          </label>
          <select
            className="jobs-select"
            id="client"
            name="client"
            defaultValue={clientId ?? ''}
          >
            <option value="">All clients</option>
            {clients.map((clientItem) => (
              <option key={clientItem.id} value={clientItem.id}>
                {clientItem.name ?? clientItem.id}
              </option>
            ))}
          </select>
        </div>
        <div className="jobs-filters__field">
          <label className="jobs-label" htmlFor="status">
            Status
          </label>
          <select
            className="jobs-select"
            id="status"
            name="status"
            defaultValue={status ?? ''}
          >
            <option value="">All</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <div className="jobs-filters__field">
          <label className="jobs-label" htmlFor="hasJobOfferId">
            Job Offer ID
          </label>
          <select
            className="jobs-select"
            id="hasJobOfferId"
            name="hasJobOfferId"
            defaultValue={hasJobOfferId ?? ''}
          >
            <option value="">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="jobs-filters__field">
          <label className="jobs-label" htmlFor="refreshCandidate">
            Refresh candidate
          </label>
          <select
            className="jobs-select"
            id="refreshCandidate"
            name="refreshCandidate"
            defaultValue={refreshCandidate ?? ''}
          >
            <option value="">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="jobs-filters__actions">
          <button className="button button--plain" type="submit">
            Apply
          </button>
          <Link className="button button--ghost" href="/jobs">
            Reset
          </Link>
        </div>
      </form>

      <JobsTable items={jobs} />
    </div>
  );
}
