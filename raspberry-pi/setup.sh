#!/bin/bash

# 라즈베리 파이 Eden 한과 주문관리 시스템 설치 스크립트 (PostgreSQL 버전)

echo "=== 라즈베리 파이용 Eden 한과 주문관리 시스템 설치 시작 ==="

# 시스템 업데이트
echo "시스템 업데이트 중..."
sudo apt update && sudo apt upgrade -y

# 필수 패키지 설치 (PostgreSQL 포함)
echo "필수 패키지 설치 중..."
sudo apt install -y git curl build-essential python3-dev postgresql postgresql-contrib

# Node.js 설치 (라즈베리 파이 최적화)
if ! command -v node &> /dev/null; then
    echo "Node.js 18.x 설치 중..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # npm 글로벌 캐시 정리 (용량 절약)
    npm cache clean --force
fi

# PostgreSQL 서비스 시작 및 자동 시작 설정
echo "PostgreSQL 서비스 설정 중..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# PostgreSQL 데이터베이스 및 사용자 생성
echo "PostgreSQL 데이터베이스 설정 중..."
sudo -u postgres psql -c "CREATE USER eden WITH PASSWORD 'eden_hangwa_secure_password';" 2>/dev/null || echo "사용자가 이미 존재합니다"
sudo -u postgres psql -c "CREATE DATABASE eden_hangwa OWNER eden;" 2>/dev/null || echo "데이터베이스가 이미 존재합니다"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE eden_hangwa TO eden;"

# 프로젝트 디렉토리 설정
PROJECT_DIR="/home/$USER/eden-hangwa"
BACKUP_DIR="/home/$USER/backup"

# 필요한 디렉토리 생성
mkdir -p $PROJECT_DIR
mkdir -p $BACKUP_DIR
mkdir -p $PROJECT_DIR/uploads
mkdir -p $PROJECT_DIR/logs

# .env 파일 생성 (PostgreSQL 연결 정보)
cat > $PROJECT_DIR/.env << EOF
DATABASE_URL=postgresql://eden:eden_hangwa_secure_password@localhost:5432/eden_hangwa
NODE_ENV=production
PORT=3000
SESSION_SECRET=$(openssl rand -hex 32)
EOF

echo ".env 파일 생성 완료"

# systemd 서비스 설치
if [ -f "./raspberry-pi/systemd/eden-hangwa.service" ]; then
    sudo cp "./raspberry-pi/systemd/eden-hangwa.service" /etc/systemd/system/
    # 사용자명 업데이트
    sudo sed -i "s/pi/$USER/g" /etc/systemd/system/eden-hangwa.service
    sudo systemctl daemon-reload
    echo "systemd 서비스 설치 완료"
fi

# 백업 스크립트 설치
if [ -f "./raspberry-pi/backup.sh" ]; then
    cp "./raspberry-pi/backup.sh" "$PROJECT_DIR/"
    chmod +x "$PROJECT_DIR/backup.sh"
    echo "백업 스크립트 설치 완료"
fi

# 메모리 최적화 설정
echo "라즈베리 파이 메모리 최적화 설정..."

# GPU 메모리 최소화 (headless 서버용)
if ! grep -q "gpu_mem=16" /boot/config.txt 2>/dev/null; then
    echo "gpu_mem=16" | sudo tee -a /boot/config.txt 2>/dev/null || echo "GPU 메모리 설정 건너뜀"
fi

# 스왑 파일 크기 증가
if [ -f "/etc/dphys-swapfile" ]; then
    sudo dphys-swapfile swapoff
    sudo sed -i 's/CONF_SWAPSIZE=100/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
    sudo dphys-swapfile setup
    sudo dphys-swapfile swapon
fi

# 자동 백업 설정 (매일 오전 2시)
echo "자동 백업 cron job 설정..."
(crontab -l 2>/dev/null; echo "0 2 * * * $PROJECT_DIR/backup.sh") | crontab -

# 방화벽 설정
if command -v ufw &> /dev/null; then
    echo "방화벽 설정 중..."
    sudo ufw allow 3000/tcp
    sudo ufw --force enable
fi

# 라즈베리 파이 IP 주소 확인
PI_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "=== 설치 완료 ==="
echo ""
echo "다음 단계:"
echo "1. 프로젝트 코드를 $PROJECT_DIR 에 복사하세요"
echo "2. cd $PROJECT_DIR && npm install"
echo "3. npm run build"
echo "4. npm run db:push  # 데이터베이스 스키마 적용"
echo "5. sudo systemctl enable eden-hangwa.service"
echo "6. sudo systemctl start eden-hangwa.service"
echo ""
echo "접속 주소: http://$PI_IP:3000"
echo ""
echo "PostgreSQL 연결 정보:"
echo "  호스트: localhost"
echo "  포트: 5432"
echo "  데이터베이스: eden_hangwa"
echo "  사용자: eden"
echo ""
echo "서비스 상태 확인: sudo systemctl status eden-hangwa.service"
echo "로그 확인: sudo journalctl -u eden-hangwa.service -f"
echo "백업 스크립트: $PROJECT_DIR/backup.sh"
echo ""
echo "재부팅 후 자동으로 서비스가 시작됩니다."
