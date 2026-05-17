# Mac mini 배포 가이드

이 구성은 macOS 위에서 VM 없이 Docker Compose로 운영합니다. k3s는 Linux 커널이 필요해서 macOS에 직접 올릴 수 없고, Mac에서 k3s를 쓰려면 Lima/Multipass/UTM 같은 VM 계층이 필요합니다. 지금 프로젝트에는 맥 미니 한 대에서 가장 단순하게 굴릴 수 있는 `Docker Compose + GitHub Actions self-hosted runner` CD 구성을 넣었습니다.

## 운영 구조

- `frontend`: Nginx가 React 정적 파일을 서빙하고 `/api`를 백엔드로 프록시
- `backend`: Ktor API 컨테이너
- `postgres`: Postgres 볼륨 저장소
- `GitHub Actions self-hosted runner`: `main` 브랜치 push 시 맥 미니에서 `deploy/deploy.sh` 실행

## 1. 맥 미니 준비

Docker Desktop을 설치하고 로그인 시 자동 실행되게 설정합니다.

맥이 잠들면 배포와 서비스가 같이 멈출 수 있으니 서버 용도라면 절전도 꺼두는 편이 좋습니다.

```bash
sudo pmset -a sleep 0
```

## 2. 운영 환경 변수 생성

운영 비밀값은 git에 넣지 않고 맥 미니 로컬에만 둡니다.

```bash
mkdir -p ~/.config/japan-trip
cp .env.production.example ~/.config/japan-trip/.env.production
```

`~/.config/japan-trip/.env.production`를 열어 값을 채웁니다.

```dotenv
APP_HTTP_PORT=8080
APP_CORS_ORIGIN=http://mac-mini.local:8080
APP_PUBLIC_BASE_URL=http://mac-mini.local:8080

POSTGRES_DB=japan_trip
POSTGRES_USER=japan
POSTGRES_PASSWORD=긴_랜덤_비밀번호

GOOGLE_MAPS_API_KEY=Google_API_키
GOOGLE_API_MONTHLY_LIMITS=maps-js=10000,routes=10000,places-new=5000,places-photo=1000
VITE_API_BASE_URL=
```

Google API 키의 웹사이트 제한에는 실제 접속 주소를 추가해야 합니다.

- `http://mac-mini.local:8080/*`
- `http://<맥미니_LAN_IP>:8080/*`
- 도메인을 붙이면 `https://your-domain.com/*`

필요 API는 Maps JavaScript API, Places API (New), Routes API입니다.

## 3. 최초 수동 배포

레포 루트에서 실행합니다.

```bash
./deploy/deploy.sh
```

정상 확인:

```bash
docker compose --env-file ~/.config/japan-trip/.env.production -f docker-compose.prod.yml ps
curl http://localhost:8080/api/health
```

브라우저에서는 `http://mac-mini.local:8080` 또는 `http://<맥미니_LAN_IP>:8080`로 접속합니다.

## 4. GitHub Actions runner 연결

GitHub 저장소에서 `Settings -> Actions -> Runners -> New self-hosted runner`로 들어가 macOS runner를 추가합니다. GitHub가 보여주는 다운로드/설정 명령을 맥 미니에서 그대로 실행합니다.

runner 설정 단계에서 label에 아래 값을 포함하세요.

```text
self-hosted, macOS, japan-trip
```

설정이 끝나면 서비스로 등록합니다.

```bash
./svc.sh install
./svc.sh start
```

이후 `main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 맥 미니에서 실행되고, `docker-compose.prod.yml` 기준으로 새 이미지를 빌드/재기동합니다.

## 운영 명령

상태 확인:

```bash
docker compose --env-file ~/.config/japan-trip/.env.production -f docker-compose.prod.yml ps
```

로그 확인:

```bash
docker compose --env-file ~/.config/japan-trip/.env.production -f docker-compose.prod.yml logs -f
```

수동 재배포:

```bash
./deploy/deploy.sh
```

DB 백업:

```bash
docker compose --env-file ~/.config/japan-trip/.env.production -f docker-compose.prod.yml exec -T postgres pg_dump -U japan japan_trip > japan-trip-backup.sql
```

롤백은 이전 커밋으로 되돌리는 커밋을 만들고 `main`에 push하는 방식이 가장 단순합니다.
