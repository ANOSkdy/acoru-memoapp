import { sql } from '@/lib/neon';

export const runtime = 'nodejs';

export default async function Home() {
  let databaseTime: string | null = null;
  let databaseMessage = 'DATABASE_URL is not set yet.';

  if (sql) {
    try {
      const result = (await sql`select now() as now`) as Array<{ now: string }>;
      databaseTime = result[0]?.now ?? null;
      databaseMessage = databaseTime
        ? `Database time: ${databaseTime}`
        : 'Connected to Neon, but no time returned.';
    } catch (error) {
      databaseMessage =
        error instanceof Error
          ? `Neon query failed: ${error.message}`
          : 'Neon query failed.';
    }
  }

  return (
    <main style={{ padding: '64px 24px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>Next.js + TypeScript + Neon</h1>
      <p style={{ marginTop: 0 }}>
        Minimal app scaffolded for Vercel deploys.
      </p>
      <section
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 12,
          background: '#f5f5f7'
        }}
      >
        <h2 style={{ marginTop: 0 }}>Neon status</h2>
        <p style={{ marginBottom: 0 }}>{databaseMessage}</p>
      </section>
    </main>
  );
}
