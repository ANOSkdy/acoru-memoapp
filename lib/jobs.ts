import 'server-only';

import { sql } from '@/lib/db';

export type JobStatus = 'active' | 'archived';

export type JobListItem = {
  id: string;
  internalTitle: string | null;
  status: string;
  updatedAt: string | Date | null;
  clientId: string;
  clientName: string | null;
  jobOfferId: string | null;
  freshnessExpiresAt: string | Date | null;
  isRefreshCandidate: boolean | null;
  hasApprovedRevision: boolean;
};

export type JobListFilters = {
  orgId: string;
  clientId?: string | null;
  search?: string | null;
  status?: JobStatus | null;
  hasJobOfferId?: 'yes' | 'no' | null;
  refreshCandidate?: 'yes' | 'no' | null;
};

export type ClientSummary = {
  id: string;
  name: string | null;
};

export type JobCreateInput = {
  orgId: string;
  clientId: string;
  internalTitle: string;
  status: JobStatus;
};

export const listJobs = async (filters: JobListFilters): Promise<JobListItem[]> => {
  if (!sql) {
    throw new Error('Database not configured.');
  }

  const {
    orgId,
    clientId = null,
    search = null,
    status = null,
    hasJobOfferId = null,
    refreshCandidate = null
  } = filters;

  const searchTerm = search?.trim() || null;
  const searchPattern = searchTerm ? `%${searchTerm}%` : null;

  const rows = await sql`
    select
      jobs.id,
      jobs.internal_title as "internalTitle",
      jobs.status,
      jobs.updated_at as "updatedAt",
      clients.id as "clientId",
      clients.name as "clientName",
      posting.job_offer_id as "jobOfferId",
      posting.freshness_expires_at as "freshnessExpiresAt",
      posting.is_refresh_candidate as "isRefreshCandidate",
      exists (
        select 1
        from job_revisions
        where job_revisions.job_posting_id = posting.id
          and job_revisions.status = 'approved'
      ) as "hasApprovedRevision"
    from jobs
    join clients on clients.id = jobs.client_id
    left join lateral (
      select
        id,
        job_offer_id,
        freshness_expires_at,
        is_refresh_candidate,
        updated_at,
        created_at
      from job_postings
      where job_postings.job_id = jobs.id
        and job_postings.channel = 'airwork'
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1
    ) posting on true
    where jobs.org_id = ${orgId}
      and clients.org_id = ${orgId}
      and (${clientId}::uuid is null or jobs.client_id = ${clientId})
      and (${status}::text is null or jobs.status = ${status})
      and (
        ${searchPattern}::text is null
        or jobs.internal_title ilike ${searchPattern}
        or clients.name ilike ${searchPattern}
      )
      and (
        ${hasJobOfferId}::text is null
        or (${hasJobOfferId} = 'yes' and posting.job_offer_id is not null)
        or (${hasJobOfferId} = 'no' and posting.job_offer_id is null)
      )
      and (
        ${refreshCandidate}::text is null
        or (${refreshCandidate} = 'yes' and posting.is_refresh_candidate is true)
        or (
          ${refreshCandidate} = 'no'
          and (posting.is_refresh_candidate is false or posting.is_refresh_candidate is null)
        )
      )
    order by jobs.updated_at desc nulls last, jobs.id desc
  `;

  return rows as JobListItem[];
};

export const listClientsForOrg = async (orgId: string): Promise<ClientSummary[]> => {
  if (!sql) {
    throw new Error('Database not configured.');
  }

  const rows = await sql`
    select id, name
    from clients
    where org_id = ${orgId}
    order by name asc nulls last
  `;

  return rows as ClientSummary[];
};

export const getClientForOrg = async ({
  orgId,
  clientId
}: {
  orgId: string;
  clientId: string;
}): Promise<ClientSummary | null> => {
  if (!sql) {
    throw new Error('Database not configured.');
  }

  const rows = await sql`
    select id, name
    from clients
    where org_id = ${orgId}
      and id = ${clientId}
    limit 1
  `;

  return (rows[0] as ClientSummary | undefined) ?? null;
};

export const createJobWithPosting = async ({
  orgId,
  clientId,
  internalTitle,
  status
}: JobCreateInput): Promise<string> => {
  if (!sql) {
    throw new Error('Database not configured.');
  }

  await sql`begin`;

  try {
    const jobRows = await sql`
      insert into jobs (org_id, client_id, internal_title, status)
      values (${orgId}, ${clientId}, ${internalTitle}, ${status})
      returning id
    `;

    const jobId = jobRows[0]?.id as string | undefined;

    if (!jobId) {
      throw new Error('Failed to create job.');
    }

    await sql`
      insert into job_postings (job_id, channel, job_offer_id)
      values (${jobId}, ${'airwork'}, ${null})
    `;

    await sql`commit`;

    return jobId;
  } catch (error) {
    await sql`rollback`;
    throw error;
  }
};
