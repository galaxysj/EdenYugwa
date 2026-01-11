# 라즈베리 파이용 ARM64 Node.js 이미지 사용
FROM node:18-alpine

# 라즈베리 파이 최적화 설정
ENV NODE_OPTIONS="--max-old-space-size=512"
ENV NODE_ENV=production

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# ARM 아키텍처용 네이티브 모듈 재빌드를 위한 도구 설치 (PostgreSQL 클라이언트 포함)
RUN apk add --no-cache python3 make g++ postgresql-client

# 종속성 설치 (프로덕션 모드)
RUN npm ci --only=production && npm cache clean --force

# 애플리케이션 코드 복사
COPY . .

# 클라이언트 빌드
RUN npm run build

# 업로드 디렉토리 생성
RUN mkdir -p /app/uploads

# 포트 노출
EXPOSE 5000

# 데이터 볼륨 (업로드 파일용)
VOLUME ["/app/uploads"]

# 애플리케이션 시작
CMD ["npm", "start"]
