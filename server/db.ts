import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import ws from "ws";
import * as schema from "@shared/schema";
import path from 'path';
import fs from 'fs';

neonConfig.webSocketConstructor = ws;

export const isSQLite = process.env.DB_DIALECT === 'sqlite';

let db: any;
let pool: Pool | null = null;
let sqliteDb: Database.Database | null = null;

if (isSQLite) {
  const dbPath = process.env.SQLITE_PATH || 'data/eden-hangwa.db';
  const dbDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  
  db = drizzleSqlite(sqliteDb);
  console.log(`SQLite database connected: ${dbPath}`);
} else {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNeon({ client: pool, schema });
  console.log('PostgreSQL database connected');
}

export { db, pool, sqliteDb };

export function dbBool(value: boolean): any {
  return isSQLite ? (value ? 1 : 0) : value;
}

export function dbNow(): any {
  return isSQLite ? new Date().toISOString() : new Date();
}

export function dbJson(value: any): any {
  if (value === null || value === undefined) return null;
  return isSQLite ? JSON.stringify(value) : value;
}

export function parseDbJson<T>(value: any): T | null {
  if (value === null || value === undefined) return null;
  if (isSQLite && typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

export function parseDbBool(value: any): boolean {
  if (isSQLite) {
    return value === 1 || value === '1' || value === true;
  }
  return Boolean(value);
}

export function parseDbDate(value: any): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return new Date(value);
  }
  return value instanceof Date ? value : null;
}

export function mapSqliteRow<T>(row: any): T | undefined {
  if (!row) return undefined;
  
  const mapped: any = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    
    if (key.includes('is_') || key === 'seller_shipped' || key === 'is_active' || 
        key === 'block_unknown_devices' || key === 'require_location_verification' ||
        key === 'is_enabled' || key === 'is_deleted' || key === 'is_different_depositor' ||
        key === 'success') {
      mapped[camelKey] = parseDbBool(value);
    } else if (key.includes('_at') || key.includes('_date') || key === 'expires_at' || 
               key === 'last_activity' || key === 'created_at' || key === 'updated_at' ||
               key === 'sent_at' || key === 'last_login_at' || key === 'payment_confirmed_at' ||
               key === 'scheduled_date' || key === 'delivered_date' || key === 'seller_shipped_date' ||
               key === 'deleted_at') {
      mapped[camelKey] = parseDbDate(value);
    } else if (key === 'allowed_ip_ranges' || key === 'allowed_countries' || 
               key === 'allowed_device_types' || key === 'dynamic_product_quantities' ||
               key === 'shipping_restricted_products') {
      mapped[camelKey] = parseDbJson(value);
    } else {
      mapped[camelKey] = value;
    }
  }
  
  return mapped as T;
}

export function mapSqliteRows<T>(rows: any[]): T[] {
  if (!rows || !Array.isArray(rows)) return [];
  return rows.map(row => mapSqliteRow<T>(row)).filter((r): r is T => r !== undefined);
}
