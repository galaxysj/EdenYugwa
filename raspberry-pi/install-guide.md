# 라즈베리 파이용 Eden 한과 주문관리 시스템 설치 가이드

## 시스템 요구사항

- **라즈베리 파이**: 3B+ 이상 권장 (4GB RAM 이상)
- **OS**: Raspberry Pi OS (64-bit) 권장
- **저장공간**: 최소 8GB (16GB 이상 권장)
- **네트워크**: 유선 또는 Wi-Fi 연결

## 설치 방법

### 방법 1: 자동 설치 스크립트 사용

```bash
# 설치 스크립트 다운로드 및 실행
wget https://your-server.com/raspberry-pi/setup.sh
chmod +x setup.sh
./setup.sh
```

### 방법 2: 수동 설치

#### 1단계: 시스템 준비

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 필요한 패키지 설치
sudo apt install -y git curl
```

#### 2단계: Node.js 설치

```bash
# Node.js 18.x 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 3단계: 프로젝트 설정

```bash
# 프로젝트 클론
git clone https://github.com/your-repo/eden-hangwa.git
cd eden-hangwa

# 종속성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
nano .env.local
```

#### 4단계: 환경변수 설정

`.env.local` 파일에 다음 내용을 추가:

```bash
NODE_ENV=production
DATABASE_URL=file:./data/eden-hangwa.db
SESSION_SECRET=your-very-secure-session-secret-here
PORT=3000

# 라즈베리 파이 최적화 설정
NODE_OPTIONS=--max-old-space-size=512
```

#### 5단계: 빌드 및 실행

```bash
# 프로덕션 빌드
npm run build

# 애플리케이션 시작
npm start
```

### 방법 3: Docker 사용

```bash
# Docker 설치 (아직 설치되지 않은 경우)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 로그아웃 후 재로그인 또는 재부팅

# Docker Compose로 실행
docker-compose -f raspberry-pi/docker-compose.yml up -d
```

## 성능 최적화 설정

### 1. 메모리 최적화

라즈베리 파이의 제한된 메모리를 고려한 설정:

```bash
# /boot/config.txt에 추가
gpu_mem=16  # GPU 메모리를 최소화

# 스왑 파일 크기 증가
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# CONF_SWAPSIZE=1024로 변경
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### 2. 자동 시작 설정

systemd 서비스로 자동 시작 설정:

```bash
# 서비스 파일 생성
sudo nano /etc/systemd/system/eden-hangwa.service
```

서비스 파일 내용:
```ini
[Unit]
Description=Eden Hangwa Order Management System
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/eden-hangwa
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=512

[Install]
WantedBy=multi-user.target
```

서비스 활성화:
```bash
sudo systemctl enable eden-hangwa.service
sudo systemctl start eden-hangwa.service
```

## 접속 방법

설치 완료 후 다음 주소로 접속:

- **로컬**: http://localhost:3000
- **네트워크**: http://라즈베리파이IP:3000

라즈베리 파이 IP 주소 확인:
```bash
hostname -I
```

## 문제 해결

### 메모리 부족 오류

```bash
# Node.js 메모리 제한 증가
export NODE_OPTIONS="--max-old-space-size=512"
```

### 포트 변경

`.env.local` 파일에서 포트 변경:
```bash
PORT=8080
```

### 로그 확인

```bash
# 서비스 로그 확인
sudo journalctl -u eden-hangwa.service -f

# 애플리케이션 로그 확인
tail -f /home/pi/eden-hangwa/logs/app.log
```

## 백업 및 복원

### 데이터베이스 백업

```bash
# SQLite 데이터베이스 백업
cp ./data/eden-hangwa.db ./backup/eden-hangwa-$(date +%Y%m%d).db
```

### 자동 백업 설정

```bash
# crontab에 추가
crontab -e

# 매일 오전 2시에 백업
0 2 * * * cp /home/pi/eden-hangwa/data/eden-hangwa.db /home/pi/backup/eden-hangwa-$(date +\%Y\%m\%d).db
```

## 보안 설정

### 방화벽 설정

```bash
# UFW 방화벽 설치 및 설정
sudo apt install ufw
sudo ufw allow ssh
sudo ufw allow 3000
sudo ufw enable
```

### SSL 인증서 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt install certbot

# 인증서 발급 (도메인이 있는 경우)
sudo certbot certonly --standalone -d your-domain.com
```

## 업데이트

```bash
# 애플리케이션 업데이트
cd /home/pi/eden-hangwa
git pull origin main
npm install
npm run build
sudo systemctl restart eden-hangwa.service
```