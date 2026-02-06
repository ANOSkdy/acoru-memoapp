import { notFound } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import NotesHierarchy from './notes/notes-hierarchy';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

export default async function HomePage() {
  const user = await requireUser();
  const workspaceId = await getWorkspaceIdForUser(user.id);

  if (!workspaceId) {
    notFound();
  }

  return (
    <div className="home notes-page">
      <NotesHierarchy />
    </div>
  );
}
