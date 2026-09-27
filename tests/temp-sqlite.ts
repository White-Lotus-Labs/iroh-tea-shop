import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const MIGRATIONS = [
  'prisma/migrations/20260925205300_accounts_auth/migration.sql',
  'prisma/migrations/20260926080000_iroh_chat_history/migration.sql',
  'prisma/migrations/20260927193000_nansen_snapshots/migration.sql',
];

export function openTempDb() {
  const directory = mkdtempSync(join(tmpdir(), 'tea-nansen-'));
  const path = join(directory, 'test.db');
  const sqlite = new DatabaseSync(path);
  for (const migration of MIGRATIONS)
    sqlite.exec(readFileSync(migration, 'utf8'));
  sqlite.close();
  const db = new PrismaClient({ datasources: { db: { url: `file:${path}` } } });
  return {
    db,
    async close() {
      await db.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
