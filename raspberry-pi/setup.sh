#!/bin/bash

# 라즈베리 파이 Eden 한과 주문관리 시스템 설치 스크립트

echo "=== 라즈베리 파이용 Eden 한과 주문관리 시스템 설치 시작 ==="

# 시스템 업데이트
echo "시스템 업데이트 중..."
sudo apt update && sudo apt upgrade -y

# 필수 패키지 설치
echo "필수 패키지 설치 중..."
sudo apt install -y git curl build-essential python3-dev sqlite3

# Node.js 설치 (라즈베리 파이 최적화)
if ! command -v node &> /dev/null; then
    echo "Node.js 18.x 설치 중..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # npm 글로벌 캐시 정리 (용량 절약)
    npm cache clean --force
fi

# 프로젝트 디렉토리 설정
PROJECT_DIR="/home/$USER/eden-hangwa"
BACKUP_DIR="/home/$USER/backup"

# 필요한 디렉토리 생성
mkdir -p $PROJECT_DIR
mkdir -p $BACKUP_DIR
mkdir -p $PROJECT_DIR/data
mkdir -p $PROJECT_DIR/uploads
mkdir -p $PROJECT_DIR/logs

# 환경변수 파일 복사
if [ -f "./raspberry-pi/.env.pi" ]; then
    cp "./raspberry-pi/.env.pi" "$PROJECT_DIR/.env.local"
    echo "환경변수 파일 복사 완료"
fi

# systemd 서비스 설치
if [ -f "./raspberry-pi/systemd/eden-hangwa.service" ]; then
    sudo cp "./raspberry-pi/systemd/eden-hangwa.service" /etc/systemd/system/
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
if ! grep -q "gpu_mem=16" /boot/config.txt; then
    echo "gpu_mem=16" | sudo tee -a /boot/config.txt
fi

# 스왑 파일 크기 증가
sudo dphys-swapfile swapoff
sudo sed -i 's/CONF_SWAPSIZE=100/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

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
echo "4. sudo systemctl enable eden-hangwa.service"
echo "5. sudo systemctl start eden-hangwa.service"
echo ""
echo "접속 주소: http://$PI_IP:3000"
echo ""
echo "서비스 상태 확인: sudo systemctl status eden-hangwa.service"
echo "로그 확인: sudo journalctl -u eden-hangwa.service -f"
echo "백업 스크립트: $PROJECT_DIR/backup.sh"
echo ""
echo "재부팅 후 자동으로 서비스가 시작됩니다."