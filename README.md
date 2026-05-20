# Japan Trip Advisor

숙소 주변 여행 장소를 Postgres에 저장하고, Ktor API로 불러와 React + shadcn 화면의 Google Maps 위에 표시하는 간단한 풀스택 앱입니다.

## 구성

- `backend`: Kotlin + Ktor API
- `frontend`: Vite React + TypeScript + Tailwind + shadcn-style components
- `postgres`: Docker Compose Postgres

## 준비

Docker Desktop을 실행한 뒤 의존성을 설치합니다.

```bash
npm install
cp frontend/.env.example frontend/.env
cp .env.example .env
```

키를 하나로 관리하려면 `frontend/.env`와 루트 `.env`에 같은 Google Maps API 키를 넣어주세요.

- `frontend/.env`의 `VITE_GOOGLE_MAPS_API_KEY`: 브라우저에서 Google Maps JavaScript API 로드
- `frontend/.env`의 `VITE_API_BASE_URL`: 개발 환경에서는 비워두는 것을 권장합니다. 비워두면 프론트엔드가 같은 주소의 `/api`를 호출하고, Vite가 백엔드로 프록시합니다.
- 루트 `.env`의 `GOOGLE_MAPS_API_KEY`: 백엔드가 Google Maps 링크로 장소 초안 구성
- 루트 `.env`의 `APP_CORS_ORIGIN`: 백엔드 Google Places 요청에 사용할 웹 referrer
  - Google API 키를 웹사이트로 제한했다면 이 값도 제한 목록에 포함되어야 합니다. 로컬 기본값은 `http://localhost:5173`입니다.
- 루트 `.env`의 `GOOGLE_API_MONTHLY_LIMITS`: 관리 탭에서 사용할 자체 월간 한도
  - 기본값: `maps-js=10000,routes=10000,places-new=5000,places-photo=1000`
  - 예: `maps-js=10000,routes=10000,places-new=5000,places-photo=1000`

Google Cloud에서 필요한 API:

- 지도 표시: Maps JavaScript API
- Google Maps 링크 기반 정보 가져오기: Places API 또는 Places API (New)
- 일정 이동 시간/거리 계산: Routes API

## 실행

### 전체 실행

프론트엔드, 백엔드, Postgres를 한 번에 실행합니다.

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Postgres: `localhost:5433`
- API health check: http://localhost:4000/api/health
- 로그인은 사용자 ID와 비밀번호가 필요합니다. 초기 계정은 서버 시작 시 해시 기반으로 시드되며, 최초 로그인 후 비밀번호 변경을 권장합니다.

핸드폰에서 확인할 때는 Mac과 같은 Wi-Fi에 연결한 뒤 `http://<Mac IP>:5173`로 접속합니다. 예를 들어 Mac IP가 `192.168.0.111`이면 `http://192.168.0.111:5173`입니다. 이때 `frontend/.env`의 `VITE_API_BASE_URL`이 `http://localhost:4000`이면 핸드폰이 자기 자신을 호출하므로 데이터가 `Load failed`로 깨집니다. `VITE_API_BASE_URL`은 비워두고, 값을 바꾼 뒤에는 프론트엔드 dev server를 재시작하세요.

### 백엔드만 실행

Ktor 백엔드는 Docker Compose로 실행합니다. 이 명령은 Postgres도 같이 띄우고, 백엔드 이미지를 빌드한 뒤 `localhost:4000`으로 노출합니다.

```bash
npm run dev:backend
```

같은 명령을 직접 쓰면 아래와 같습니다.

```bash
docker compose up --build backend
```

정상 실행 확인:

```bash
curl http://localhost:4000/api/health
```

### 프론트엔드만 실행

이미 백엔드가 떠 있을 때만 프론트엔드만 따로 실행합니다.

```bash
npm run dev:frontend
```

주의: `npm run dev --workspace frontend` 또는 `cd frontend && npm run dev`는 Vite 프론트엔드만 실행합니다. 이 경우 백엔드는 자동으로 실행되지 않으므로 API 저장/추가 기능을 쓰려면 별도 터미널에서 `npm run dev:backend`를 먼저 실행해야 합니다.

### DB만 실행

백엔드 없이 Postgres만 띄우고 싶을 때 사용합니다.

```bash
npm run dev:db
```

## API

```http
GET /api/restaurants
GET /api/restaurants?category=meal
GET /api/restaurants?travelMode=walk
GET /api/categories
POST /api/categories
DELETE /api/categories/:id
GET /api/auth/session
POST /api/auth/login
POST /api/auth/change-password
GET /api/schedule
PUT /api/schedule
GET /api/api-usage
POST /api/api-usage/events
PATCH /api/api-usage/:serviceId
GET /api/route-cache/:fromPlaceId/:toPlaceId
POST /api/route-cache
POST /api/google-maps/preview
POST /api/google-maps/list-preview
POST /api/google-maps/sync-list
POST /api/restaurants
PUT /api/restaurants/:id
PATCH /api/restaurants/:id/description
GET /api/restaurants/:id/photos
DELETE /api/restaurants/:id
```

`/api/health`, `/api/auth/login`, 정적 이미지 응답을 제외한 주요 API 요청은 로그인 후 받은 `Authorization: Bearer <token>` 헤더가 필요합니다. 프론트엔드는 세션 확인이 끝나기 전이나 로그인 전에는 앱 화면과 데이터 요청을 렌더링하지 않습니다.

장소 삭제는 실제 행 삭제가 아니라 `restaurants.place_status = 'deleted'`로 처리합니다. Google Maps 즐겨찾기는 먼저 `POST /api/google-maps/list-preview`로 후보 목록과 썸네일을 조회한 뒤, 체크된 `selectedSyncKeys`만 `POST /api/google-maps/sync-list`로 가져옵니다. 동기화는 `google_sync_key`가 같은 기존 장소를 덮어쓰지 않고, `deleted` 상태인 장소는 다시 가져오지 않습니다.

일정 탭의 DAY/장소 순서는 Postgres의 `schedule_days`, `schedule_stops` 테이블에 저장됩니다. 일정 수정은 편집 인증 후 `PUT /api/schedule`로 저장되며, 기존 브라우저 `localStorage`에 남아 있던 일정은 서버 일정이 비어 있고 인증 토큰이 있을 때 한 번 DB로 동기화합니다.

일정 탭의 장소 간 이동 시간은 `fromPlaceId`와 `toPlaceId` 조합으로 Postgres에 10분 동안 캐시됩니다. 차량/대중교통/도보가 모두 실제 계산에 성공한 구간만 캐시하고, 캐시가 유효하면 Google Routes를 다시 호출하지 않습니다. 10분이 지난 캐시는 사용자가 일정 화면에서 해당 구간을 다시 볼 때 새로 계산되어 갱신됩니다. DAY 카드의 `경로 새로고침` 버튼을 누르면 해당 DAY의 숙소-장소, 장소-장소, 장소-숙소 구간만 캐시를 우회해 다시 계산합니다.

관리 탭은 이 앱이 발생시킨 성공한 Google API 호출을 `api_usage_daily` 테이블에 기록한 뒤, 현재 Google 청구 월 기준으로 합산합니다. 기본 월간 한도는 Google Maps Platform 무료 사용량 기준에 맞춰 `maps-js=10000`, `routes=10000`, `places-new=5000`, `places-photo=1000`으로 표시합니다. 실패한 Google 요청은 자동 집계하지 않습니다. 편집 모드에서는 이번 달 사용량과 월간 한도를 직접 보정할 수 있고, 한도는 `api_usage_limits` 테이블에 저장됩니다. Google Cloud Console의 청구/사용량 원장 자체를 읽는 기능은 아니므로, 정확한 프로젝트 전체 사용량은 Google Cloud Console에서 함께 확인해주세요.

`POST`와 `PUT` body 예시:

```json
{
  "name": "Ginza Kagari Honten",
  "category": "meal",
  "cuisine": "Chicken paitan ramen",
  "menu": "Chicken paitan soba",
  "description": "Creamy chicken ramen near Ginza.",
  "address": "6 Chome-4-12 Ginza, Chuo City, Tokyo",
  "googleMapsUrl": "https://www.google.com/maps/search/?api=1&query=Ginza+Kagari+Honten",
  "latitude": 35.671083,
  "longitude": 139.763139,
  "travelMode": "walk",
  "travelMinutes": 17,
  "distanceLabel": "1.4km"
}
```

프론트는 지도 마커를 클릭해 장소를 선택하고, 지도 아래에서 카테고리 버튼으로 맛집/디저트/관광 등 원하는 분류의 가까운 장소를 테이블로 보여줍니다.

## 배포

맥 미니 한 대에서 운영하려면 `docker-compose.prod.yml`과 GitHub Actions self-hosted runner를 사용합니다. 프론트엔드는 Nginx가 정적 파일을 서빙하고 `/api`를 백엔드 컨테이너로 프록시하므로 운영 접속 주소는 하나만 열면 됩니다.

자세한 절차는 [Mac mini 배포 가이드](docs/deploy-mac-mini.md)를 참고하세요.
