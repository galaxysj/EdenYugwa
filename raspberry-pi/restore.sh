#!/bin/bash

# Eden 한과 주문관리 시스템 복원 스크립트 (PostgreSQL)

BACKUP_DIR="/home/pi/backup"

# PostgreSQL 연결 정보
PGHOST=localhost
PGPORT=5432
PGDATABASE=eden_hangwa
PGUSER=eden_hangwa
PGPASSWORD=eden3452

echo "=== Eden 한과 시스템 복원 ==="

# 백업 파일 목록 표시
echo "사용 가능한 백업 파일:"
ls -la $BACKUP_DIR/*.dump 2>/dev/null | tail -10

if [ -z "$1" ]; then
    echo ""
    echo "사용법: $0 <백업파일명>"
    echo "예시: $0 eden-hangwa-db-20240101_020000.dump"
    exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "오류: 백업 파일을 찾을 수 없습니다: $BACKUP_FILE"
    exit 1
fi

echo "복원할 백업 파일: $BACKUP_FILE"
read -p "정말로 복원하시겠습니까? 현재 데이터가 삭제됩니다. (y/N) " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "복원 취소됨"
    exit 0
fi

# 현재 데이터베이스 백업
DATE=$(date +%Y%m%d_%H%M%S)
echo "현재 데이터베이스 백업 중..."
export PGPASSWORD=$PGPASSWORD
pg_dump -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -F c -f "$BACKUP_DIR/eden-hangwa-db-before-restore-$DATE.dump"

# 데이터베이스 복원
echo "데이터베이스 복원 중..."
pg_restore -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE --clean --if-exists "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "복원 완료!"
else
    echo "경고: 복원 중 일부 오류가 발생했을 수 있습니다."
fi

echo "=== 복원 완료 ==="
