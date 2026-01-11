#!/bin/bash

# PostgreSQL 설치 및 설정 스크립트 (Raspberry Pi / Debian)
set -e

echo "=== PostgreSQL 설치 중... ==="
sudo apt update
sudo apt install -y postgresql postgresql-contrib

echo "=== PostgreSQL 서비스 시작 ==="
sudo systemctl start postgresql
sudo systemctl enable postgresql

echo "=== 데이터베이스 및 사용자 생성 ==="
# eden_hangwa 사용자와 데이터베이스 생성
sudo -u postgres psql << EOF
-- 사용자 생성 (이미 있으면 무시)
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'eden_hangwa') THEN
        CREATE USER eden_hangwa WITH PASSWORD 'eden3452';
    END IF;
END
\$\$;

-- 데이터베이스 생성 (이미 있으면 무시)
SELECT 'CREATE DATABASE eden_hangwa OWNER eden_hangwa'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'eden_hangwa')\gexec

-- 권한 부여
GRANT ALL PRIVILEGES ON DATABASE eden_hangwa TO eden_hangwa;
EOF

echo "=== PostgreSQL 설정 완료! ==="
echo ""
echo "데이터베이스 정보:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: eden_hangwa"
echo "  User: eden_hangwa"
echo "  Password: eden3452"
echo ""
echo "DATABASE_URL: postgresql://eden_hangwa:eden3452@localhost:5432/eden_hangwa"
