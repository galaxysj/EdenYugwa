#!/bin/bash

# Eden 한과 주문관리 시스템 백업 스크립트

PROJECT_DIR="/home/pi/eden-hangwa"
BACKUP_DIR="/home/pi/backup"
DATE=$(date +%Y%m%d_%H%M%S)

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

echo "=== Eden 한과 시스템 백업 시작 ($DATE) ==="

# 데이터베이스 백업
if [ -f "$PROJECT_DIR/data/eden-hangwa.db" ]; then
    echo "데이터베이스 백업 중..."
    cp "$PROJECT_DIR/data/eden-hangwa.db" "$BACKUP_DIR/eden-hangwa-db-$DATE.db"
    echo "데이터베이스 백업 완료: $BACKUP_DIR/eden-hangwa-db-$DATE.db"
fi

# 업로드 파일 백업
if [ -d "$PROJECT_DIR/uploads" ]; then
    echo "업로드 파일 백업 중..."
    tar -czf "$BACKUP_DIR/uploads-$DATE.tar.gz" -C "$PROJECT_DIR" uploads/
    echo "업로드 파일 백업 완료: $BACKUP_DIR/uploads-$DATE.tar.gz"
fi

# 설정 파일 백업
if [ -f "$PROJECT_DIR/.env.local" ]; then
    echo "설정 파일 백업 중..."
    cp "$PROJECT_DIR/.env.local" "$BACKUP_DIR/env-$DATE.backup"
    echo "설정 파일 백업 완료: $BACKUP_DIR/env-$DATE.backup"
fi

# 오래된 백업 파일 삭제 (30일 이상)
echo "오래된 백업 파일 정리 중..."
find $BACKUP_DIR -name "*eden-hangwa*" -type f -mtime +30 -delete
find $BACKUP_DIR -name "*uploads*" -type f -mtime +30 -delete
find $BACKUP_DIR -name "*env*" -type f -mtime +30 -delete

echo "=== 백업 완료 ==="

# 백업 결과 로그
{
    echo "[$DATE] 백업 완료"
    echo "데이터베이스: $(ls -lh $BACKUP_DIR/eden-hangwa-db-$DATE.db 2>/dev/null || echo '없음')"
    echo "업로드 파일: $(ls -lh $BACKUP_DIR/uploads-$DATE.tar.gz 2>/dev/null || echo '없음')"
    echo "설정 파일: $(ls -lh $BACKUP_DIR/env-$DATE.backup 2>/dev/null || echo '없음')"
    echo "---"
} >> $BACKUP_DIR/backup.log