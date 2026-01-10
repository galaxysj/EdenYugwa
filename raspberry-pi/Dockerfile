# 라즈베리 파이용 ARM64 Node.js 이미지 사용 (데비안 기반)
FROM node:18-bookworm-slim

# 라즈베리 파이 최적화 설정
ENV NODE_OPTIONS="--max-old-space-size=512"
ENV NODE_ENV=production
ENV PORT=7000

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# ARM 아키텍처용 네이티브 모듈 재빌드를 위한 도구 설치 (데비안용)
RUN apt-get update && apt-get install -y python3 make g++ sqlite3 && rm -rf /var/lib/apt/lists/*

# 종속성 설치 (프로덕션 모드)
RUN npm ci --only=production && npm cache clean --force

# 애플리케이션 코드 복사
COPY . .

# 클라이언트 빌드
RUN npm run build

# SQLite 데이터베이스 디렉토리 생성
RUN mkdir -p /app/data

# 포트 노출 (7000번 포트)
EXPOSE 7000

# 데이터 볼륨
VOLUME ["/app/data", "/app/uploads"]

# 애플리케이션 시작
CMD ["npm", "start"]