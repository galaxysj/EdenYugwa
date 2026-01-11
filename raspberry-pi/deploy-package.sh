#!/bin/bash

# 라즈베리 파이 배포용 패키지 생성 스크립트

PACKAGE_NAME="eden-hangwa-pi"
VERSION=$(date +%Y%m%d)
PACKAGE_DIR="./dist-pi"

echo "=== Eden 한과 시스템 라즈베리 파이 배포 패키지 생성 ==="

# 이전 패키지 디렉토리 정리
rm -rf $PACKAGE_DIR
mkdir -p $PACKAGE_DIR

# 프로덕션 빌드
echo "프로덕션 빌드 중..."
npm run build

# 필요한 파일들 복사
echo "파일 복사 중..."

# 핵심 애플리케이션 파일
cp -r dist $PACKAGE_DIR/
cp package.json $PACKAGE_DIR/
cp package-lock.json $PACKAGE_DIR/

# 라즈베리 파이 설정 파일들
cp -r raspberry-pi $PACKAGE_DIR/

# 공유 스키마 (런타임에 필요)
mkdir -p $PACKAGE_DIR/shared
cp -r shared/* $PACKAGE_DIR/shared/

# 클라이언트 빌드 결과물
cp -r client/dist $PACKAGE_DIR/client-dist

# 설정 파일
cp drizzle.config.ts $PACKAGE_DIR/
cp tsconfig.json $PACKAGE_DIR/
cp tailwind.config.ts $PACKAGE_DIR/
cp vite.config.ts $PACKAGE_DIR/

# README 및 설치 가이드
cp raspberry-pi/README-Korean.md $PACKAGE_DIR/README.md
cp raspberry-pi/install-guide.md $PACKAGE_DIR/

# 프로덕션 전용 package.json 생성
cat > $PACKAGE_DIR/package.json << EOF
{
  "name": "$PACKAGE_NAME",
  "version": "$VERSION",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "start": "NODE_ENV=production node dist/index.js",
    "pi:start": "bash raspberry-pi/start-pi.sh",
    "pi:service": "sudo systemctl start eden-hangwa.service"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "dependencies": {
    "better-sqlite3": "^8.7.0",
    "drizzle-orm": "^0.39.1",
    "express": "^4.21.2",
    "bcryptjs": "^3.0.2",
    "express-session": "^1.18.2"
  },
  "os": ["linux"],
  "cpu": ["arm", "arm64"],
  "keywords": ["raspberry-pi", "order-management", "korean-sweets", "ecommerce"]
}
EOF

# 설치 스크립트 생성
cat > $PACKAGE_DIR/install.sh << 'EOF'
#!/bin/bash

echo "=== Eden 한과 시스템 설치 시작 ==="

# Node.js 확인
if ! command -v node &> /dev/null; then
    echo "Node.js가 필요합니다. 먼저 Node.js를 설치해주세요."
    echo "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "sudo apt-get install -y nodejs"
    exit 1
fi

# 의존성 설치
echo "의존성 설치 중..."
npm install --only=production

# 디렉토리 생성
mkdir -p data uploads logs backup

# 환경변수 파일 복사
if [ ! -f ".env.local" ]; then
    cp raspberry-pi/.env.pi .env.local
    echo "환경변수 파일이 생성되었습니다. .env.local을 편집하여 설정을 변경할 수 있습니다."
fi

# 실행 권한 부여
chmod +x raspberry-pi/*.sh

echo "설치 완료!"
echo "시작하려면: bash raspberry-pi/start-pi.sh"
echo "서비스 설치: bash raspberry-pi/setup.sh"
EOF

chmod +x $PACKAGE_DIR/install.sh

# 압축 파일 생성
echo "압축 파일 생성 중..."
cd $(dirname $PACKAGE_DIR)
tar -czf "${PACKAGE_NAME}-${VERSION}.tar.gz" $(basename $PACKAGE_DIR)
zip -r "${PACKAGE_NAME}-${VERSION}.zip" $(basename $PACKAGE_DIR) > /dev/null

echo ""
echo "=== 패키지 생성 완료 ==="
echo "디렉토리: $PACKAGE_DIR"
echo "압축 파일: ${PACKAGE_NAME}-${VERSION}.tar.gz"
echo "압축 파일: ${PACKAGE_NAME}-${VERSION}.zip"
echo ""
echo "라즈베리 파이에서 설치 방법:"
echo "1. tar -xzf ${PACKAGE_NAME}-${VERSION}.tar.gz"
echo "2. cd $(basename $PACKAGE_DIR)"
echo "3. bash install.sh"
echo "4. bash raspberry-pi/start-pi.sh"