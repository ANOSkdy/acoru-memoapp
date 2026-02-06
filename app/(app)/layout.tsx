import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { signOut } from '@/lib/auth/actions';

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
            <div className="app-header__title">Welcome back, {user.name}</div>
          </div>
          <details className="app-header__profile">
            <summary
              className="app-header__profile-trigger"
              aria-label="Open user menu"
            >
              <span className="app-header__avatar" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  role="img"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M12 12.6c2.4 0 4.3-1.9 4.3-4.3S14.4 4 12 4 7.7 5.9 7.7 8.3s2 4.3 4.3 4.3Zm0 1.7c-3 0-7 1.5-7 4.4V20h14v-1.6c0-2.9-4-4.1-7-4.1Z" />
                </svg>
              </span>
            </summary>
            <div className="app-header__profile-menu">
              <div className="app-header__profile-name">{user.name}</div>
              <div className="badge">Secure workspace</div>
              <nav
                className="app-header__profile-nav"
                aria-label="Main navigation"
              >
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    className="app-header__profile-link"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <form action={signOut}>
                <button className="button button--ghost" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
