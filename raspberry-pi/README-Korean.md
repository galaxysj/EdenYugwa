# 🍡 Eden 한과 주문관리 시스템 - 라즈베리 파이판

라즈베리 파이에서 실행할 수 있도록 최적화된 Eden 한과 주문관리 시스템입니다.

## 📋 시스템 요구사항

- **라즈베리 파이**: 3B+ 이상 (4GB RAM 권장)
- **운영체제**: 데비안 (Debian) 또는 Raspberry Pi OS (64-bit)
- **저장공간**: 최소 8GB (16GB 이상 권장)
- **네트워크**: 인터넷 연결
- **포트**: 7000번 포트 사용

## 🚀 빠른 설치 (자동 설치)

```bash
# 프로젝트 다운로드
git clone <repository-url> eden-hangwa
cd eden-hangwa

# 자동 설치 스크립트 실행
bash raspberry-pi/setup.sh

# 시스템 재부팅 (권장)
sudo reboot

# 재부팅 후 애플리케이션 시작
cd eden-hangwa
bash raspberry-pi/start-pi.sh
```

## 🔧 수동 설치

### 1단계: 시스템 준비
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential python3-dev sqlite3
```

### 2단계: Node.js 설치
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3단계: 프로젝트 설정
```bash
git clone <repository-url> eden-hangwa
cd eden-hangwa
npm install
npm run build
```

### 4단계: 환경 설정
```bash
cp raspberry-pi/.env.pi .env.local
nano .env.local  # 필요시 설정 변경
```

### 5단계: 시작
```bash
bash raspberry-pi/start-pi.sh
```

## 🐳 Docker 사용 (대안)

```bash
# Docker로 실행
docker-compose -f raspberry-pi/docker-compose.yml up -d

# 로그 확인
docker-compose -f raspberry-pi/docker-compose.yml logs -f

# 중지
docker-compose -f raspberry-pi/docker-compose.yml down
```

## ⚙️ 자동 시작 설정

시스템 부팅 시 자동으로 시작하려면:

```bash
# systemd 서비스 설치
sudo cp raspberry-pi/systemd/eden-hangwa.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable eden-hangwa.service
sudo systemctl start eden-hangwa.service

# 서비스 상태 확인
sudo systemctl status eden-hangwa.service
```

## 📱 접속 방법

설치 완료 후:
- **로컬**: http://localhost:7000
- **네트워크**: http://라즈베리파이IP:7000

라즈베리 파이 IP 확인:
```bash
hostname -I
```

## 🔧 관리 명령어

### 서비스 관리
```bash
# 서비스 시작
sudo systemctl start eden-hangwa.service

# 서비스 중지
sudo systemctl stop eden-hangwa.service

# 서비스 재시작
sudo systemctl restart eden-hangwa.service

# 로그 확인
sudo journalctl -u eden-hangwa.service -f
```

### 백업
```bash
# 수동 백업 실행
./backup.sh

# 백업 파일 확인
ls -la ~/backup/
```

### 업데이트
```bash
# 코드 업데이트
git pull origin main
npm install
npm run build
sudo systemctl restart eden-hangwa.service
```

## 🛠️ 성능 최적화

### 메모리 최적화
라즈베리 파이의 제한된 메모리를 위한 설정이 자동으로 적용됩니다:
- Node.js 메모리 제한: 512MB
- GPU 메모리 최소화: 16MB
- 스왑 파일 크기: 1GB

### 추가 최적화 (선택사항)
```bash
# 불필요한 서비스 비활성화
sudo systemctl disable bluetooth
sudo systemctl disable wifi-powersave

# 로그 크기 제한
sudo journalctl --vacuum-size=100M
```

## 🔐 보안 설정

### 방화벽
```bash
# UFW 방화벽 활성화 (자동 설치 시 포함)
sudo ufw allow 7000
sudo ufw allow 22
sudo ufw enable
```

### SSL 인증서 (선택사항)
```bash
# Let's Encrypt 설치
sudo apt install certbot

# 인증서 발급 (도메인 필요)
sudo certbot certonly --standalone -d yourdomain.com
```

## 🐛 문제 해결

### 메모리 부족
```bash
# 메모리 사용량 확인
free -h

# 스왑 사용량 확인
swapon -s

# 프로세스 메모리 사용량 확인
top
```

### 포트 충돌
기본 포트는 7000입니다. `.env.local` 파일에서 포트 변경 가능:
```bash
PORT=7000
```

### 데이터베이스 문제
```bash
# SQLite 데이터베이스 확인
sqlite3 data/eden-hangwa.db ".tables"

# 데이터베이스 복구
cp backup/eden-hangwa-db-latest.db data/eden-hangwa.db
```

## 📊 모니터링

### 시스템 상태 확인
```bash
# CPU 온도
vcgencmd measure_temp

# 메모리 사용량
free -h

# 디스크 사용량
df -h

# 서비스 상태
sudo systemctl status eden-hangwa.service
```

### 로그 모니터링
```bash
# 실시간 로그 확인
sudo journalctl -u eden-hangwa.service -f

# 애플리케이션 로그
tail -f logs/app.log
```

## 🔄 백업 및 복원

### 자동 백업
매일 오전 2시에 자동 백업이 실행됩니다.

### 수동 백업
```bash
./backup.sh
```

### 복원
```bash
# 데이터베이스 복원
cp backup/eden-hangwa-db-YYYYMMDD.db data/eden-hangwa.db

# 업로드 파일 복원
tar -xzf backup/uploads-YYYYMMDD.tar.gz

# 서비스 재시작
sudo systemctl restart eden-hangwa.service
```

## 📞 지원

문제가 발생하면:
1. 로그 확인: `sudo journalctl -u eden-hangwa.service -f`
2. 서비스 재시작: `sudo systemctl restart eden-hangwa.service`
3. 시스템 재부팅: `sudo reboot`

## 📝 라이선스

이 프로젝트는 MIT 라이선스하에 배포됩니다.