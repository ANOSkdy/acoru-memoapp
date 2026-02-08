import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { getWorkspaceIdForUser } from '@/lib/workspaces';
import { getClientForOrg, listJobs } from '@/lib/jobs';
import { isValidUuid } from '@/lib/validation/uuid';
import JobsTable from '@/app/(app)/jobs/jobs-table';

export const runtime = 'nodejs';

type ClientJobsPageProps = {
  params: { clientId: string };
  searchParams?: {
    q?: string;
    status?: string;
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

export default async function ClientJobsPage({
  params,
  searchParams
}: ClientJobsPageProps) {
  const user = await requireUser();
  const orgId = await getWorkspaceIdForUser(user.id);

  if (!orgId) {
    notFound();
  }

  const clientId = params.clientId;

  if (!isValidUuid(clientId)) {
    notFound();
  }

  const client = await getClientForOrg({ orgId, clientId });

  if (!client) {
    notFound();
  }

  const search = normalizeFilter(searchParams?.q);
  const status = normalizeFilter(searchParams?.status);
  const hasJobOfferId = normalizeFilter(searchParams?.hasJobOfferId);
  const refreshCandidate = normalizeFilter(searchParams?.refreshCandidate);

  const jobs = await listJobs({
    orgId,
    clientId,
    search,
    status: status === 'active' || status === 'archived' ? status : null,
    hasJobOfferId:
      hasJobOfferId === 'yes' || hasJobOfferId === 'no' ? hasJobOfferId : null,
    refreshCandidate:
      refreshCandidate === 'yes' || refreshCandidate === 'no'
        ? refreshCandidate
        : null
  });

  return (
    <div className="jobs">
      <div className="jobs-header">
        <div>
          <div className="badge">Client Jobs</div>
          <h1>{client.name ?? 'Client'}の求人</h1>
          <p className="home-subtitle">
            {client.name ?? '顧客'}に紐づく求人を確認できます。
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
            placeholder="求人名"
            defaultValue={search ?? ''}
          />
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
          <Link
            className="button button--ghost"
            href={`/clients/${clientId}/jobs`}
          >
            Reset
          </Link>
        </div>
      </form>

      <JobsTable items={jobs} />
    </div>
  );
}
