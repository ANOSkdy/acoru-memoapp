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
    <div className="status-page">
      <div className="status-card">
        <p className="status-code">Error</p>
        <h1 className="status-title">問題が発生しました</h1>
        <p className="status-description">
          一時的な不具合の可能性があります。再試行してください。
        </p>
        <div className="status-actions">
          <button className="button" type="button" onClick={reset}>
            再試行
          </button>
          <Link className="button button--ghost" href="/">
            ホームへ
          </Link>
        </div>
        {process.env.NODE_ENV !== 'production' && error?.message ? (
          <p className="status-dev-message">{error.message}</p>
        ) : null}
      </div>
    </div>
  );
}
