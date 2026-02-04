import { SignInForm } from './SignInForm';

export const runtime = 'nodejs';

export default function SignInPage() {
  return (
    <div className="auth-card">
      <div className="center-stack">
        <div>
          <h1 style={{ marginBottom: 8 }}>Sign in</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            Welcome back. Please enter your credentials to continue.
          </p>
        </div>
        <SignInForm />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>
          Having trouble? Ask an administrator to reset your password.
        </p>
      </div>
    </div>
  );
}
