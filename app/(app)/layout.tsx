import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { signOut } from '@/lib/auth/actions';
import MobileDrawer from './MobileDrawer';

type AppLayoutProps = {
  children: ReactNode;
};

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/trash', label: 'Trash' },
  { href: '/settings', label: 'Settings' }
];

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await requireUser();

  return (
    <div className="app-shell">
      <div className="app-content">
        <header className="app-header">
          <div className="app-header__row">
            <MobileDrawer items={navItems} />
            <div className="app-header__title">Welcome back, {user.name}</div>
            <nav className="app-header__menu" aria-label="Main navigation">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  className="app-header__link"
                  href={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="app-header__actions">
            <div className="badge">Secure workspace</div>
            <form action={signOut}>
              <button className="button button--ghost" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
