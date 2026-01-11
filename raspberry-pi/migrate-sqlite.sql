-- Eden 한과 SQLite 데이터베이스 마이그레이션 스크립트
-- 기존 데이터베이스에 새 컬럼을 추가합니다.

-- login_attempts 테이블: success → was_successful 컬럼명 변경
-- SQLite는 컬럼명 변경을 직접 지원하지 않으므로, 새 컬럼 추가 후 데이터 복사
ALTER TABLE login_attempts ADD COLUMN was_successful INTEGER DEFAULT 0;
UPDATE login_attempts SET was_successful = success WHERE success IS NOT NULL;

-- admin_settings 테이블에 새 컬럼 추가
ALTER TABLE admin_settings ADD COLUMN account_info_html TEXT;
ALTER TABLE admin_settings ADD COLUMN refund_shipping_fee INTEGER DEFAULT 3000;
ALTER TABLE admin_settings ADD COLUMN is_shipping_restriction_enabled INTEGER DEFAULT 0;
ALTER TABLE admin_settings ADD COLUMN shipping_restricted_products TEXT;

-- access_control_settings 테이블에 is_device_restriction_enabled 컬럼 추가 (없는 경우)
ALTER TABLE access_control_settings ADD COLUMN is_device_restriction_enabled INTEGER DEFAULT 0;

-- 기본 사용자 계정 추가 (users 테이블에 없는 경우)
-- 관리자 계정 (비밀번호: eden2024!)
INSERT OR IGNORE INTO users (username, password_hash, name, phone_number, role, is_active) 
VALUES ('admin', '$2b$10$euHzf7uCpOiMLHeAAEUSle.DQlDL0Urp1kTpe8TSwp/WuMiy1A/1a', '관리자', '', 'admin', 1);

-- 매니저 계정 (비밀번호: eden2024!)
INSERT OR IGNORE INTO users (username, password_hash, name, phone_number, role, is_active) 
VALUES ('manager', '$2b$10$euHzf7uCpOiMLHeAAEUSle.DQlDL0Urp1kTpe8TSwp/WuMiy1A/1a', '매니저', '', 'manager', 1);
