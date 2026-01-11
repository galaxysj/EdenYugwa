import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL;

// Neon 클라우드 연결인지 로컬 PostgreSQL인지 자동 감지
const isNeonCloud = databaseUrl.includes('neon.tech') || 
                    databaseUrl.includes('neon.database') ||
                    databaseUrl.includes('neondb');

let db: any;
let pool: any;

if (isNeonCloud) {
  // Neon 클라우드 연결 (WebSocket 사용)
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: databaseUrl });
  db = drizzleNeon({ client: pool, schema });
  console.log('PostgreSQL database connected (Neon Cloud)');
} else {
  // 로컬 PostgreSQL 연결 (표준 TCP 연결)
  pool = new PgPool({ connectionString: databaseUrl });
  db = drizzlePg({ client: pool, schema });
  console.log('PostgreSQL database connected (Local)');
}

export { db, pool };
