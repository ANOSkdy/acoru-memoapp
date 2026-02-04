'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="auth-card">
      <div className="center-stack">
        <h1 style={{ marginBottom: 0 }}>Something went wrong</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          An unexpected error occurred. Please try again or return home.
        </p>
        <div className="center-stack">
          <button
            type="button"
            onClick={reset}
            style={{
              border: 'none',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--color-primary)',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Try again
          </button>
          <Link className="app-sidebar__link" href="/">
            Back to home
          </Link>
        </div>
      </div>
      {process.env.NODE_ENV !== 'production' && error?.message ? (
        <p style={{ marginTop: 16, color: 'var(--color-text-muted)' }}>
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
