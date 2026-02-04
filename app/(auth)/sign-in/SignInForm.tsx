'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { signIn } from '@/lib/auth/actions';

type SignInState = {
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
};

const initialState: SignInState = {
  error: undefined,
  fieldErrors: {}
};

const SubmitButton = () => {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
};

export const SignInForm = () => {
  const [state, formAction] = useFormState(signIn, initialState);

  return (
    <form action={formAction} className="auth-form">
      <div className="auth-field">
        <label className="auth-label" htmlFor="email">
          Email
        </label>
        <input
          className="auth-input"
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        {state.fieldErrors?.email ? (
          <p className="auth-error" role="alert">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="password">
          Password
        </label>
        <input
          className="auth-input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.fieldErrors?.password ? (
          <p className="auth-error" role="alert">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="auth-actions">
        <SubmitButton />
      </div>
    </form>
  );
};
