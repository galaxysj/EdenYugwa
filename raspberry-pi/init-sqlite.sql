-- Eden Hangwa SQLite Database Initialization Script
-- This script creates all tables for Raspberry Pi deployment

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Orders table
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

-- SMS notifications table
CREATE TABLE IF NOT EXISTS sms_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Users table
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

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  location TEXT,
  device_type TEXT,
  browser_info TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_activity TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Access control settings table
CREATE TABLE IF NOT EXISTS access_control_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  allowed_ip_ranges TEXT DEFAULT '[]',
  allowed_countries TEXT DEFAULT '[]',
  allowed_device_types TEXT DEFAULT '["mobile","desktop","tablet"]',
  block_unknown_devices INTEGER NOT NULL DEFAULT 0,
  max_concurrent_sessions INTEGER NOT NULL DEFAULT 5,
  session_timeout INTEGER NOT NULL DEFAULT 24,
  require_location_verification INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Login attempts table
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  location TEXT,
  device_type TEXT,
  success INTEGER NOT NULL,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);

-- Login approval requests table
CREATE TABLE IF NOT EXISTS login_approval_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  session_id TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  location TEXT,
  device_type TEXT,
  request_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_approval_requests_user_id ON login_approval_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON login_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_at ON login_approval_requests(created_at);

-- Sessions table for express-session
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expire TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions(expire);

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Managers table
CREATE TABLE IF NOT EXISTS managers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Product prices table
CREATE TABLE IF NOT EXISTS product_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_index INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  cost INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dashboard content table
CREATE TABLE IF NOT EXISTS dashboard_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_name TEXT NOT NULL,
  admin_phone TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_address TEXT,
  business_phone TEXT,
  bank_account TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  zip_code TEXT,
  address1 TEXT,
  address2 TEXT,
  order_count INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  last_order_date TEXT,
  notes TEXT,
  user_id INTEGER,
  user_registered_name TEXT,
  user_registered_phone TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(customer_name, customer_phone)
);

-- Insert default admin account (galaxysj / eden*3452)
-- bcrypt hash for 'eden*3452'
INSERT OR IGNORE INTO admins (username, password, created_at) 
VALUES ('galaxysj', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', datetime('now'));

-- Insert default manager account (ceohj / eden*2376)
-- bcrypt hash for 'eden*2376'
INSERT OR IGNORE INTO managers (username, password, created_at) 
VALUES ('ceohj', '$2a$10$rJ.Z1FoU8.SY5K8.e4.rCOgYkA8F.uQ0O8g.xA8EqEKZz.Z/8m1Oi', datetime('now'));

-- Insert default user accounts for web login
INSERT OR IGNORE INTO users (username, password_hash, name, phone_number, role, is_active, created_at)
VALUES 
  ('galaxysj', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '관리자', '010-0000-0000', 'admin', 1, datetime('now')),
  ('ceohj', '$2a$10$rJ.Z1FoU8.SY5K8.e4.rCOgYkA8F.uQ0O8g.xA8EqEKZz.Z/8m1Oi', '매니저', '010-0000-0001', 'manager', 1, datetime('now'));

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, description, updated_at) VALUES
  ('smallBoxCost', '15000', '한과1호 원가 (개당)', datetime('now')),
  ('largeBoxCost', '17000', '한과2호 원가 (개당)', datetime('now')),
  ('wrappingCost', '500', '보자기 포장 원가 (개당)', datetime('now')),
  ('shippingFee', '4000', '배송비 (6개 미만 주문 시)', datetime('now')),
  ('freeShippingThreshold', '6', '무료배송 최소 수량', datetime('now'));

-- Insert default admin settings
INSERT OR IGNORE INTO admin_settings (id, admin_name, admin_phone, business_name, created_at, updated_at)
VALUES (1, '에덴한과', '010-0000-0000', '에덴한과', datetime('now'), datetime('now'));
