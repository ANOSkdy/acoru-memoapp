export const runtime = 'nodejs';

export default function SignInPage() {
  return (
    <div className="auth-card">
      <div className="center-stack">
        <h1 style={{ marginBottom: 0 }}>Sign in</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Authentication is not configured yet. Connect your provider and then
          revisit this screen.
        </p>
        <div className="card">
          <p style={{ margin: 0 }}>
            Production requires authentication. In development you can opt into
            the bypass via <code>DEV_AUTH_BYPASS=true</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
