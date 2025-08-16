#!/bin/bash

# 라즈베리 파이에서 Eden 한과 시스템 시작 스크립트

echo "=== Eden 한과 주문관리 시스템 시작 ==="

# 현재 디렉토리 확인
if [ ! -f "package.json" ]; then
    echo "오류: package.json 파일을 찾을 수 없습니다. 프로젝트 루트 디렉토리에서 실행해주세요."
    exit 1
fi

# 필요한 디렉토리 생성
echo "디렉토리 설정 중..."
mkdir -p data
mkdir -p uploads
mkdir -p logs
mkdir -p backup

# 환경변수 파일 확인 및 복사
if [ ! -f ".env.local" ] && [ -f "raspberry-pi/.env.pi" ]; then
    echo "환경변수 파일 설정 중..."
    cp raspberry-pi/.env.pi .env.local
    echo "라즈베리 파이용 환경변수 파일이 복사되었습니다."
    echo "필요시 .env.local 파일을 편집하여 설정을 변경하세요."
fi

# Node.js 메모리 제한 설정
export NODE_OPTIONS="--max-old-space-size=512"

# 의존성 설치 확인
if [ ! -d "node_modules" ]; then
    echo "의존성 설치 중..."
    npm install
fi

# 빌드 확인
if [ ! -d "dist" ]; then
    echo "프로덕션 빌드 중..."
    npm run build
fi

echo "애플리케이션 시작 중..."

# 라즈베리 파이 IP 주소 확인
PI_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "Eden 한과 주문관리 시스템이 시작됩니다."
echo "접속 주소: http://$PI_IP:3000"
echo "종료하려면 Ctrl+C를 누르세요."
echo ""

# 애플리케이션 시작
npm start