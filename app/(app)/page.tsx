export const runtime = 'nodejs';

export default function HomePage() {
  return (
    <div className="center-stack">
      <div className="badge">Dashboard</div>
      <h1>Memo space</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        This is the shared foundation for future memo screens. Use the
        navigation to explore placeholder routes.
      </p>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Next steps</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Connect real auth provider and session storage.</li>
          <li>Hook note data to Neon via server actions.</li>
          <li>Style the editor and list experiences.</li>
        </ul>
      </div>
    </div>
  );
}
