import { createRequire } from 'module';
import * as schema from "@shared/schema";

const require = createRequire(import.meta.url);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isSQLite = DATABASE_URL.startsWith('file:');

let db: any;
let pool: any = null;
let sqliteDb: any = null;

if (isSQLite) {
  // SQLite 모드 (라즈베리 파이)
  const fs = require('fs');
  const path = require('path');
  const Database = require('better-sqlite3');
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  
  const dataDir = process.env.DATA_DIR || './data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = DATABASE_URL.replace('file:', '');
  const absolutePath = path.resolve(dbPath);
  
  const dirName = path.dirname(absolutePath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }

  console.log('SQLite 데이터베이스 사용:', absolutePath);
  
  sqliteDb = new Database(absolutePath);
  
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('synchronous = NORMAL');
  sqliteDb.pragma('cache_size = 10000');
  sqliteDb.pragma('temp_store = memory');

  db = drizzle(sqliteDb, { schema });
} else {
  // PostgreSQL 모드 (Replit)
  const { Pool, neonConfig } = require('@neondatabase/serverless');
  const { drizzle } = require('drizzle-orm/neon-serverless');
  const ws = require('ws');
  
  neonConfig.webSocketConstructor = ws;
  pool = new Pool({ connectionString: DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

// SQLite boolean helper - converts JavaScript boolean to 0/1 for SQLite queries
function dbBool(value: boolean): any {
  if (isSQLite) {
    return value ? 1 : 0;
  }
  return value;
}

// SQLite timestamp helper - returns current timestamp expression
function dbNow(): any {
  if (isSQLite) {
    return "datetime('now')";
  }
  return new Date();
}

export { db, pool, isSQLite, sqliteDb, dbBool, dbNow };
