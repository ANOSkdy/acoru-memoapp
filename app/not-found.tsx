import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="status-page">
      <div className="status-card">
        <p className="status-code">404</p>
        <h1 className="status-title">ページが見つかりません</h1>
        <p className="status-description">
          指定されたURLは存在しないか、移動された可能性があります。
        </p>
        <Link className="button" href="/">
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
