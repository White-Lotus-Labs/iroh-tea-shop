import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sqliteFilePath } from './sqlite-file.mjs';

const schemaDir = fileURLToPath(new URL('../prisma/', import.meta.url));
const path = sqliteFilePath(process.env.DATABASE_URL, schemaDir);
mkdirSync(dirname(path), { recursive: true });
if (!existsSync(path)) closeSync(openSync(path, 'w'));
