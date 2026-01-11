-- Eden 한과 SQLite 데이터베이스 초기화 스크립트

-- 주문 테이블
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  zip_code TEXT,
  address1 TEXT NOT NULL,
  address2 TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  recipient_zip_code TEXT,
  recipient_address1 TEXT,
  recipient_address2 TEXT,
  depositor_name TEXT,
  is_different_depositor INTEGER NOT NULL DEFAULT 0,
  special_requests TEXT,
  small_box_quantity INTEGER NOT NULL DEFAULT 0,
  large_box_quantity INTEGER NOT NULL DEFAULT 0,
  wrapping_quantity INTEGER NOT NULL DEFAULT 0,
  dynamic_product_quantities TEXT,
  shipping_fee INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL,
  actual_paid_amount INTEGER DEFAULT 0,
  discount_amount INTEGER DEFAULT 0,
  discount_reason TEXT,
  small_box_price INTEGER DEFAULT 0,
  large_box_price INTEGER DEFAULT 0,
  wrapping_price INTEGER DEFAULT 0,
  small_box_cost INTEGER DEFAULT 0,
  large_box_cost INTEGER DEFAULT 0,
  wrapping_cost INTEGER DEFAULT 0,
  total_cost INTEGER DEFAULT 0,
  net_profit INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_date TEXT,
  delivered_date TEXT,
  seller_shipped INTEGER DEFAULT 0,
  seller_shipped_date TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_confirmed_at TEXT,
  order_password TEXT,
  user_id INTEGER,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SMS 알림 테이블
CREATE TABLE IF NOT EXISTS sms_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone_number TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- 사용자 세션 테이블
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- 관리자 테이블
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

-- 매니저 테이블
CREATE TABLE IF NOT EXISTS managers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

-- 설정 테이블
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

-- 대시보드 컨텐츠 테이블
CREATE TABLE IF NOT EXISTS dashboard_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

-- 관리자 설정 테이블
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_phone TEXT,
  signature TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 고객 테이블
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 동적 상품 테이블
CREATE TABLE IF NOT EXISTS dynamic_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  exclude_from_free_shipping INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_order_id ON sms_notifications(order_id);

-- 기본 설정값 삽입
INSERT OR IGNORE INTO settings (key, value) VALUES ('smallBoxPrice', '20000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('largeBoxPrice', '30000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('wrappingPrice', '1000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('shippingFee', '4000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('freeShippingThreshold', '3');
INSERT OR IGNORE INTO settings (key, value) VALUES ('smallBoxCost', '15000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('largeBoxCost', '22000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('wrappingCost', '500');
INSERT OR IGNORE INTO settings (key, value) VALUES ('smallBoxName', '한과1호');
INSERT OR IGNORE INTO settings (key, value) VALUES ('largeBoxName', '한과2호');
INSERT OR IGNORE INTO settings (key, value) VALUES ('wrappingName', '보자기 상품');

-- 기본 관리자 계정 (비밀번호: admin)
INSERT OR IGNORE INTO admins (username, password) VALUES ('admin', '$2a$10$rQZ8K.N6hCxPxL8YpXCJXuQZrJxJxJxJxJxJxJxJxJxJxJxJxJxJx');

-- 기본 매니저 계정 (비밀번호: manager)  
INSERT OR IGNORE INTO managers (username, password) VALUES ('manager', '$2a$10$rQZ8K.N6hCxPxL8YpXCJXuQZrJxJxJxJxJxJxJxJxJxJxJxJxJxJx');
