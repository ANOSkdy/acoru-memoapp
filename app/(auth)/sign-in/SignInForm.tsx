'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { signIn } from '@/lib/auth/actions';

type SignInState = {
  error?: string;
  fieldErrors?: {
    identifier?: string;
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
        <label className="auth-label" htmlFor="identifier">
          Email or ID
        </label>
        <input
          className="auth-input"
          id="identifier"
          name="identifier"
          type="text"
          placeholder="you@example.com / your-id"
          autoComplete="username"
          required
        />
        {state.fieldErrors?.identifier ? (
          <p className="auth-error" role="alert">
            {state.fieldErrors.identifier}
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
