// 라즈베리 파이용 SQLite 데이터베이스 설정
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../shared/schema';
import fs from 'fs';
import path from 'path';

// 데이터 디렉토리 생성
const dataDir = process.env.DATA_DIR || './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'eden-hangwa.db');

// SQLite 데이터베이스 연결 (라즈베리 파이 최적화)
const sqlite = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
});

// WAL 모드 활성화 (성능 향상)
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('cache_size = 1000000'); // 1GB 캐시
sqlite.pragma('temp_store = memory');

export const db = drizzle(sqlite, { schema });

// 라즈베리 파이용 초기 데이터베이스 설정
export function initializeDatabase() {
  // 테이블 생성 및 초기 데이터 설정
  // 필요한 경우 마이그레이션 실행
  console.log('SQLite 데이터베이스 초기화 완료:', dbPath);
}