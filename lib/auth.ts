import 'server-only';

import { redirect } from 'next/navigation';

export type SessionUser = {
  id: string;
  name: string;
};

const isProduction = process.env.NODE_ENV === 'production';

const getBypassUser = (): SessionUser | null => {
  if (isProduction) {
    return null;
  }

  if (process.env.DEV_AUTH_BYPASS !== 'true') {
    return null;
  }

  const id = process.env.DEV_AUTH_BYPASS_USER ?? 'dev-user';
  const name = process.env.DEV_AUTH_BYPASS_NAME ?? 'Dev User';

  return { id, name };
};

export const getSessionUser = async (): Promise<SessionUser | null> => {
  const bypassUser = getBypassUser();
  if (bypassUser) {
    return bypassUser;
  }

  return null;
};

export const requireUser = async (): Promise<SessionUser> => {
  const user = await getSessionUser();

  if (!user) {
    redirect('/sign-in');
  }

  return user;
};
