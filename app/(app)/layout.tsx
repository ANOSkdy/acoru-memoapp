import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { signOut } from '@/lib/auth/actions';

import MobileDrawer from './MobileDrawer';
import SideNav from './SideNav';
import { navItems } from './nav-items';

type AppLayoutProps = {
  children: ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await requireUser();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__row">
          <MobileDrawer items={navItems} />
          <div className="app-header__brand">
            <span className="app-header__title">Acoru Memo</span>
            <span className="app-header__workspace">
              {user.name} さんのワークスペース
            </span>
          </div>
        </div>
        <div className="app-header__user">
          <span className="app-header__user-name" title={user.name}>
            {user.name}
          </span>
          <form action={signOut}>
            <button className="app-header__signout" type="submit">
              サインアウト
            </button>
          </form>
        </div>
      </header>
      <div className="app-body">
        <SideNav items={navItems} />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
