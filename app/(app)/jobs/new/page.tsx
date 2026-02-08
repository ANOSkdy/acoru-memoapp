import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { getWorkspaceIdForUser } from '@/lib/workspaces';
import {
  createJobWithPosting,
  listClientsForOrg,
  type JobStatus
} from '@/lib/jobs';
import { isValidUuid } from '@/lib/validation/uuid';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

const createJobSchema = z.object({
  internalTitle: z.string().min(1, 'Internal title is required.'),
  clientId: z.string().uuid(),
  status: z.enum(['active', 'archived']).default('active')
});

export default async function NewJobPage() {
  if (!sql) {
    throw new Error('Database not configured.');
  }

  const user = await requireUser();
  const orgId = await getWorkspaceIdForUser(user.id);

  if (!orgId) {
    notFound();
  }

  const clients = await listClientsForOrg(orgId);

  const createJob = async (formData: FormData) => {
    'use server';

    if (!sql) {
      throw new Error('Database not configured.');
    }

    const user = await requireUser();
    const orgId = await getWorkspaceIdForUser(user.id);

    if (!orgId) {
      notFound();
    }

    const raw = {
      internalTitle: String(formData.get('internalTitle') ?? '').trim(),
      clientId: String(formData.get('clientId') ?? ''),
      status: (formData.get('status') ?? 'active').toString()
    };

    const parsed = createJobSchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error('入力内容を確認してください。');
    }

    if (!isValidUuid(parsed.data.clientId)) {
      throw new Error('Client is invalid.');
    }

    const clientRows = await sql`
      select id
      from clients
      where org_id = ${orgId}
        and id = ${parsed.data.clientId}
      limit 1
    `;

    if (!clientRows[0]?.id) {
      notFound();
    }

    await createJobWithPosting({
      orgId,
      clientId: parsed.data.clientId,
      internalTitle: parsed.data.internalTitle,
      status: parsed.data.status as JobStatus
    });

    redirect('/jobs');
  };

  return (
    <div className="jobs">
      <div className="jobs-header">
        <div>
          <div className="badge">Create Job</div>
          <h1>新規求人</h1>
          <p className="home-subtitle">求人の基本情報を登録します。</p>
        </div>
        <div className="jobs-header__actions">
          <Link className="button button--ghost" href="/jobs">
            Back to Jobs
          </Link>
        </div>
      </div>

      <form className="jobs-form" action={createJob}>
        <div className="jobs-form__field">
          <label className="jobs-label" htmlFor="internalTitle">
            Internal title
          </label>
          <input
            className="jobs-input"
            id="internalTitle"
            name="internalTitle"
            type="text"
            placeholder="例: Backend Engineer"
            required
          />
        </div>
        <div className="jobs-form__field">
          <label className="jobs-label" htmlFor="clientId">
            Client
          </label>
          <select
            className="jobs-select"
            id="clientId"
            name="clientId"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select a client
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name ?? client.id}
              </option>
            ))}
          </select>
        </div>
        <div className="jobs-form__field">
          <label className="jobs-label" htmlFor="status">
            Status
          </label>
          <select
            className="jobs-select"
            id="status"
            name="status"
            defaultValue="active"
          >
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <div className="jobs-form__actions">
          <button className="button" type="submit">
            Create Job
          </button>
        </div>
      </form>
    </div>
  );
}
