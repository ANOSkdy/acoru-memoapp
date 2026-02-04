import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="auth-card">
      <div className="center-stack">
        <h1 style={{ marginBottom: 0 }}>Page not found</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          The page you are looking for does not exist. Use the navigation to
          get back on track.
        </p>
        <Link className="app-sidebar__link" href="/">
          Go to home
        </Link>
      </div>
    </div>
  );
}
