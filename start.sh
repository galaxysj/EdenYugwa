#!/bin/bash

# Eden Hangwa 주문관리 시스템 - CasaOS 배포용 스크립트

# 환경 변수 설정
export NODE_ENV=production
export PORT=7000
export HTTPS_PORT=443

# Let's Encrypt SSL 인증서 경로
export SSL_KEY_PATH=/etc/letsencrypt/live/edenhangwa.duckdns.org/privkey.pem
export SSL_CERT_PATH=/etc/letsencrypt/live/edenhangwa.duckdns.org/fullchain.pem

# 쿠키 보안 (HTTPS 사용시 true)
export COOKIE_SECURE=true

# HTTP → HTTPS 리다이렉트 (선택사항, 필요하면 true로 변경)
export HTTP_REDIRECT=false

# 세션 시크릿 (변경 권장)
export SESSION_SECRET=your-secure-session-secret-here

# 데이터베이스 연결 (실제 값으로 변경 필요)
# export DATABASE_URL=postgresql://user:password@localhost:5432/eden_hangwa

# 앱 시작
echo "Starting Eden Hangwa Order Management System..."
echo "HTTP: http://localhost:$PORT"
echo "HTTPS: https://localhost:$HTTPS_PORT"

npm run start
