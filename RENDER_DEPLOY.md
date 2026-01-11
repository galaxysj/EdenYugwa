# Render 배포 가이드 (Eden Hangwa 주문 관리 시스템)

## 🚀 배포 방법

### 방법 1: Blueprint 사용 (자동 배포)

1. [Render 대시보드](https://dashboard.render.com/)에 로그인
2. **New** → **Blueprint** 클릭
3. GitHub 저장소 연결
4. `render.yaml` 파일이 자동으로 감지됨
5. **Apply** 클릭하면 서비스와 데이터베이스가 자동 생성됨

### 방법 2: 수동 설정

#### 1단계: PostgreSQL 데이터베이스 생성

1. Render 대시보드에서 **New** → **PostgreSQL** 클릭
2. 설정:
   - **Name**: `eden-hangwa-db`
   - **Database**: `eden_hangwa`
   - **User**: `eden_hangwa`
   - **Plan**: Free
3. **Create Database** 클릭
4. 생성 후 **Internal Database URL** 복사해두기

#### 2단계: 웹 서비스 생성

1. **New** → **Web Service** 클릭
2. GitHub 저장소 연결
3. 설정:
   - **Name**: `eden-hangwa`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: Free

#### 3단계: 환경 변수 설정

**Environment** 탭에서 다음 변수 추가:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | (1단계에서 복사한 Internal Database URL) |
| `SESSION_SECRET` | (랜덤 문자열 - Generate 버튼 사용) |

## 📋 배포 후 확인사항

1. **Deploy 완료 확인**: Logs에서 `serving on port 5000` 메시지 확인
2. **데이터베이스 마이그레이션**: 첫 배포시 자동으로 테이블 생성됨
3. **URL 확인**: `https://eden-hangwa.onrender.com` 형식으로 접속

## ⚠️ 주의사항

### 무료 플랜 제한사항
- 15분간 요청이 없으면 서비스가 **절전 모드**로 전환됨
- 절전 모드에서 깨어나는데 약 30초~1분 소요
- 월 750시간 무료 (한 서비스 24시간 운영 가능)

### 데이터베이스 제한
- 무료 PostgreSQL은 **90일 후 만료**됨
- 만료 전 백업 필요
- 유료 플랜($7/월)으로 업그레이드하면 영구 사용 가능

## 🔧 커스텀 도메인 설정

1. 서비스 설정 → **Custom Domains** 탭
2. 도메인 입력 (예: `order.eden-hangwa.com`)
3. DNS 설정에서 CNAME 레코드 추가
4. SSL 인증서는 자동 발급됨

## 📊 모니터링

- **Logs**: 실시간 서버 로그 확인
- **Metrics**: CPU, 메모리 사용량 확인
- **Events**: 배포 히스토리 확인

## 🔄 재배포

GitHub에 push하면 자동으로 재배포됩니다.

수동 배포: **Manual Deploy** → **Deploy latest commit**
