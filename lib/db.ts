import 'server-only';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;

export const sql = databaseUrl ? neon(databaseUrl) : null;
