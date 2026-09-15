# 로컬 실행 (Docker 한 번에)

웹(React) · API 서버(Rust) · DB 등 인프라 · 테스트 데이터를 Docker로 한 번에 띄웁니다.
호스트에는 **Docker만** 있으면 됩니다(Rust · Node · pnpm 설치 불필요, macOS/Linux 동일).

## 실행

```bash
make local          # = scripts/local-stack.sh up
```

- 처음 실행은 이미지 빌드 때문에 오래 걸립니다(API Rust 빌드 수 분~수십 분, 웹 빌드 수 분). 이후에는 Docker 캐시로 변경분만 다시 빌드합니다.
- 준비가 끝나면 접속 주소가 출력됩니다.

| 주소 | 내용 |
|---|---|
| http://localhost:4173 | **웹 앱** (여기로 접속) |
| http://localhost:8080 | API 서버 (웹이 `/api` 등을 여기로 전달) |
| `postgres://ratel:ratel@localhost:55432/ratel` | Postgres |

**테스트 로그인**: 이메일 `hi+user1@biyard.co`, 인증 코드 `000000` (API가 `bypass` 기능으로 빌드되어 있어 항상 통과합니다). 다른 테스트 계정은 `scripts/postgres-seed.sql`에 있습니다.

## 자주 쓰는 명령

| 명령 | 동작 |
|---|---|
| `make local` | 빌드 + 실행 + 준비될 때까지 대기. 코드를 바꾼 뒤 다시 실행하면 바뀐 부분만 다시 빌드 |
| `make local-logs` | API · 웹 로그 보기 (`scripts/local-stack.sh logs local-api` 처럼 서비스 지정 가능) |
| `make local-status` | 컨테이너 상태 |
| `make local-down` | 중지 · 삭제 |
| `make local-reset` | 중지 → 로컬 DynamoDB 데이터 삭제 → 다시 실행 |

## 구성

`docker-compose.yaml`의 `local` 프로필입니다.

```
브라우저 → local-web (4173) ─┬─ 페이지 · 에셋: React 빌드 (apps/web/dist)
                            └─ /api /v3 /mcp /hooks /launchpad/health /launchpad/points
                               /admin/proxy /designs /roadmap → local-api (8080)
local-api → postgres · localstack(DynamoDB/S3) · qdrant
```

| 서비스 | 이미지 | 설명 |
|---|---|---|
| `local-api` | `deploy/local/Dockerfile.api` | `app/ratel`을 `server,bypass,local-dev` 기능으로 빌드. 인증 코드 `000000` 허용, `/designs` · `/roadmap` 제공 |
| `local-web` | `deploy/local/Dockerfile.web` | `apps/web`을 `VITE_BYPASS=true`로 빌드하고 `apps/web/server/serve.mjs`로 서빙. k3s에서는 ingress가 나누는 API 경로를 여기서는 이 서버가 `local-api`로 전달(`PROXY_API=1`) |
| `local-postgres-seed` | postgres | API가 스키마를 만든 뒤 테스트 데이터(`scripts/postgres-seed.sql`)를 한 번 넣음. 이미 있으면 건너뜀 |
| `postgres`, `localstack`, `localstack-init`, `qdrant`, `qdrant-init` | 기존과 동일 | `localstack-init`은 실행할 때마다 DynamoDB 테이블을 초기화 |

k3s 배포(dev · prod · PR 프리뷰)와의 차이: 운영 이미지는 CI가 `app/ratel/Dockerfile` · `apps/web/Dockerfile`로 만들고, 경로 분리는 ingress(`deploy/*/…-ingress.yaml`)가 합니다. 이 로컬 스택은 같은 서버 코드를 로컬 설정으로 빌드한 것입니다.

## Playwright 실행

```bash
make local
cd playwright && npm ci
PLAYWRIGHT_BASE_URL=http://localhost:4173 npx playwright test --project=Desktop
REACT_APP=1 PLAYWRIGHT_BASE_URL=http://localhost:4173 npx playwright test --project=React
```

`app/ratel`의 서버 통합 테스트(`make test`)는 로컬 Postgres의 데이터를 지웁니다. 그 뒤에 Playwright를 돌리려면 `make local-down && make local`로 다시 띄워 시드를 다시 넣으세요.

## 문제 해결

- **포트 사용 중**: 4173 · 8080 · 55432 · 4566 · 6333 · 6334 를 다른 프로세스(직접 띄운 cargo/node 서버, 다른 docker compose 프로젝트의 컨테이너 등)가 쓰고 있으면 스크립트가 무엇이 쓰는지 알려주고 멈춥니다. 해당 프로세스·컨테이너를 끄고 다시 실행하세요.
- **DynamoDB 관리 화면**이 필요하면: `docker compose --profile local --profile infra up -d dynamodb-admin` → http://localhost:8081 (8081을 다른 곳에서 쓰면 뜨지 않으므로 기본 실행에서는 뺐습니다)
- **API가 준비되지 않음**: `make local-logs` 로 `local-api` 로그를 확인하세요. 서버는 시작할 때 Postgres 스키마 마이그레이션을 먼저 실행합니다.
- **빌드가 메모리 부족으로 실패**: Docker Desktop 설정에서 메모리를 8GB 이상으로 늘리세요.
- **Firebase · WalletConnect · PortOne 흐름 테스트**: 기본값은 빈 키입니다. `VITE_FIREBASE_API_KEY=… VITE_WALLETCONNECT_PROJECT_ID=… make local` 처럼 환경변수로 넘기면 웹 이미지에 들어갑니다(사용 가능한 이름은 `docker-compose.yaml`의 `local-web.build.args`).

## Docker 없이 개발할 때

- API: `cd app/ratel && make run` (호스트에 Rust 필요, 인프라는 `make infra`)
- 웹: `pnpm install && pnpm -C apps/web dev` → http://localhost:5173 (기본은 dev 백엔드로 프록시, 로컬 API를 쓰려면 `VITE_API_TARGET=http://localhost:8080`)
