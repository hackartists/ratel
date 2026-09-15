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
- **Google 로그인 · PortOne · WalletConnect**: 키가 없으면 동작하지 않습니다. 키를 환경변수로 넣고 실행하세요 — `FIREBASE_*`, `PORTONE_STORE_ID`, `PORTONE_INICIS_CHANNEL_KEY`, `PORTONE_KPN_CHANNEL_KEY`, `PORTONE_API_SECRET`, `WALLETCONNECT_PROJECT_ID` (또는 `VITE_` 접두 이름). 예: `ratel_envs && make local` (값을 export하는 셸 함수가 있으면). 웹·API 이미지가 이 값으로 다시 빌드됩니다.
  - 자격증명 페이지의 본인인증은 기본(`VITE_BYPASS=true`)이면 PortOne을 건너뛰고 통과합니다. 실제 PortOne 창으로 확인하려면 `VITE_BYPASS=false` 와 `PORTONE_API_SECRET`이 필요합니다.
  - 키를 넣으면 구독 화면의 결제가 실제 PortOne 상점으로 연결됩니다. 로컬에서도 결제 진행은 누르지 마세요.

## 모바일 앱 (Android · iOS)

모바일 앱은 Docker를 쓰지 않습니다. React 빌드를 Tauri 앱에 넣어 빌드하고, 에뮬레이터/시뮬레이터에 설치해 실행합니다.

```bash
ratel_envs                                            # Firebase · PortOne 키 (없으면 구글 로그인 · 결제 불가)
make android                                          # Android 에뮬레이터, API = dev
make ios                                              # iOS 시뮬레이터 (macOS), API = dev
MOBILE_API_ENDPOINT=https://ratel.foundation make android   # API 주소 지정
MOBILE_API_ENDPOINT=http://localhost:8080 make ios          # `make local`로 띄운 로컬 API
```

- `MOBILE_API_ENDPOINT`: 앱이 호출할 API 주소(기본 `https://dev.ratel.foundation`). 빌드할 때 앱에 들어가므로 바꾸면 다시 빌드됩니다.
- Android 기기 지정: `AVD=Small_Phone make android`(에뮬레이터 이름 — 켜져 있으면 그대로 쓰고, 없으면 켬) 또는 `DEVICE=emulator-5554 make android`(이미 연결된 기기 시리얼, `adb devices`로 확인). 지정하지 않으면 연결된 첫 기기, 없으면 첫 번째 AVD를 켭니다. AVD 목록: `emulator -list-avds`. 매번 삭제 후 새로 설치합니다. `localhost` 주소는 `adb reverse`로 호스트에 연결합니다.
- iOS 기기 지정: `SIMULATOR="iPhone 16 Plus" make ios`(정확한 이름 또는 UDID — 꺼져 있으면 켬). 지정하지 않으면 켜진 시뮬레이터, 없으면 iPhone 시뮬레이터를 켭니다. 목록: `xcrun simctl list devices available`. 서명 없는 시뮬레이터용 빌드입니다.
- `SIMULATOR`는 `make ios`에만, `AVD` · `DEVICE`는 `make android`에만 쓰입니다. `MOBILE_API_ENDPOINT`를 비우거나 생략하면 dev입니다.
- 스토어 배포(Play 내부 테스트 · TestFlight)를 GitHub 호스티드 러너 없이 이 Mac에서 돌리려면 `scripts/mobile-release-runner.sh up`으로 저장소 전용 러너(라벨 `ratel-mac`, 2개)를 등록한 뒤 `gh workflow run mobile-release-local.yml --repo biyard/ratel -f platform=both -f confirm=RELEASE`를 실행하고, 끝나면 `scripts/mobile-release-runner.sh down`으로 등록을 해제합니다. iOS는 Xcode 26 이상이 필요합니다.
- 필요한 도구: Rust(`cargo`), Node 22 + `corepack`, Android는 Android Studio SDK · NDK · JDK 17, iOS는 Xcode · `xcodegen`. 경로는 스크립트(`scripts/mobile-run.sh`)가 흔한 위치에서 찾고, 다르면 `ANDROID_HOME` · `ANDROID_NDK_HOME` · `JAVA_HOME`으로 지정합니다.
- 첫 빌드는 수십 분 걸릴 수 있습니다(Rust 크로스 컴파일).
- Android 디버그 빌드에서는 구글 로그인이 안 됩니다. 디버그 키 SHA-1이 Firebase에 등록돼 있지 않기 때문입니다(`make -C app/ratel-tauri keystore.sha1`로 확인 후 Firebase 콘솔 → Android 앱 → 지문 추가). 스토어 빌드는 해당 없음.
- 스토어 배포 빌드는 GitHub Actions `mobile-release.yml`을 쓰세요.

## Docker 없이 개발할 때

- API: `cd app/ratel && make run` (호스트에 Rust 필요, 인프라는 `make infra`)
- 웹: `pnpm install && pnpm -C apps/web dev` → http://localhost:5173 (기본은 dev 백엔드로 프록시, 로컬 API를 쓰려면 `VITE_API_TARGET=http://localhost:8080`)
