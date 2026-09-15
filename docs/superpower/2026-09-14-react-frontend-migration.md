# React 프론트엔드 전환 계획 (Dioxus → React + TypeScript)

**작성일**: 2026-09-14
**상태**: 확정 (2026-09-14). 11장 결정 반영. P0 착수.
**부록**: [라우트·페이지 인벤토리](2026-09-14-react-frontend-migration-routes.md) (73개 라우트, 레이아웃 체인, 페이지별 규모)
**참고 레포**: `~/Projects/asset` (같은 Dioxus → React 전환을 먼저 진행한 레포. 구조·도구 기준)

---

## 0. 목표와 원칙

1. **프론트엔드만 옮깁니다.** `app/ratel`의 RSX UI를 `apps/web`의 React 18 + TypeScript로 옮깁니다.
2. **백엔드 동작은 바꾸지 않습니다.** 허용하는 변경은 세 가지뿐입니다.
   - DTO·엔티티·enum에 `cfg_attr(feature = "ts-bridge", derive(TS))` 어노테이션 추가
   - `packages/by-macros`가 라우트 매크로를 처리할 때 TS 클라이언트 파일을 함께 쓰도록 확장 (env 게이트, 런타임 코드 변화 없음)
   - 빌드·배포 설정 (Makefile, Dockerfile, ingress, CI)
3. **화면은 지금과 똑같아야 합니다.** `app/ratel/assets/main.css`, Tailwind 클래스 문자열, DOM 구조, `data-*`/`aria-*` 값, `data-testid`를 그대로 유지합니다. 새로 디자인하지 않습니다.
4. **디렉터리 구조와 도구는 asset을 따릅니다.** pnpm 워크스페이스, `apps/web/src/{pages,components,lib,i18n,styles}`, `App.tsx` 라우트 테이블, ts-bridges 훅, 페이지 옆 i18n 모듈. **단, asset의 스타일 규칙(shadcn 시맨틱 토큰, BEM 금지, `ui-scales` 린트)은 적용하지 않습니다.** 원칙 3과 충돌하기 때문입니다.
5. **웹과 모바일(Android/iOS Tauri)을 같은 React 빌드로 동시에 전환합니다.**

---

## 1. 현재 상태 (2026-09-14 측정)

| 항목 | 규모 |
|---|---|
| 라우트 | 73개 (페이지 72 + catch-all), 레이아웃 8개 |
| UI를 그리는 `.rs` 파일 / `#[component]` | 455개 / 921개 |
| `rsx!` 안의 UI 코드 | 약 5.4만 줄 (spaces 2.3만, social 7.6천, sub_team 5.4천, common 5.3천 …) |
| 서버 함수 | 331개 (GET 156 · POST 118 · DELETE 35 · PATCH 17 · PUT 5) |
| 데이터 로딩 | `use_loader` 157~179곳, `use_infinite_query` 30~66곳 (집계 방식에 따라 차이) |
| i18n | `translate!` 148블록, 키 약 2,964개, `derive(Translate)` 53개 타입 |
| JS 연동 | `.js` 41개, `document::eval` 약 75곳, `dioxus.send/recv` 드라이버 약 25개, `wasm_bindgen` extern 약 18곳 |
| CSS | `main.css` 약 5.6만 줄(`@layer` 없음), Tailwind 클래스 문자열 7,745개 |
| 인라인 style / SVG snake_case 속성 | 217곳 / 약 1,535곳 |
| SEO 메타 (`SeoMeta`) | 28개 파일 |
| E2E | Playwright 28개 spec (web 21, admin 3, mobile 3, tauri 1) |

규모가 큰 페이지 (rs 줄 / rsx 줄): SpaceIndexPage 7,262/5,522 · PollActionPage 5,207/2,734 · SocialSetting 4,659/2,272 · SpaceActionsPage 4,049/1,620 · SpaceReportPage 3,838/629.

참고로 asset은 같은 전환을 PRD까지 작성했지만 2026-06 기준 31개 라우트 중 1개만 옮겼습니다. 이 계획은 그 경험을 반영해 **기반(P0)과 검증 도구를 먼저 끝내고, 페이지는 병렬로 옮기는** 순서로 짭니다.

---

## 2. 목표 구조

```
ratel/
├── package.json              # pnpm 스크립트: dev/build/lint/format/typecheck → apps/web
├── pnpm-workspace.yaml       # apps/*, packages/*
├── .prettierrc.json  .prettierignore  eslint.config.mjs
├── apps/
│   └── web/                  # @ratel/web — 웹 빌드와 Tauri dist가 같은 산출물
│       ├── index.html        # #main 마운트, 테마 선적용 스크립트, CSS <link> 순서 고정
│       ├── vite.config.ts    # /api·/v3·/mcp 프록시, VITE_BASE, 모바일 API 베이스 URL
│       └── src/
│           ├── main.tsx  App.tsx     # RootLayout 프로바이더 + RouteRecord[] 테이블
│           ├── styles/               # main.css, dx-components-theme.css, tailwind 입력 (원본 그대로 이관)
│           ├── i18n/index.ts         # 네임스페이스 레지스트리 (추출 도구 산출물)
│           ├── lib/                  # query-client, auth, theme, popup, toast, layover, routes, page-meta,
│           │                         # platform(tauri 감지), viewport(kb-inset 스크립트), legacy-scripts
│           ├── components/           # ui/(Button·Card·Row…), editor/, auth/, nav/, <group>/
│           └── pages/                # URL 구조 그대로: posts/[postId]/page.tsx, spaces/[spaceId]/…
└── packages/
    ├── ts-bridges/           # @ratel/ts-bridges — runtime/client.ts(수작업), handlers/·types/(생성), hooks/(수작업)
    └── legacy-js/            # 기존 js/src/ratel-app-shell, wallet-connect, 페이지 script.js (수정 없이 이관)
```

- 페이지 모듈은 `Component`를 export하고, 랜딩을 뺀 모든 라우트는 lazy 로딩합니다.
- 링크 경로는 `lib/routes.ts`의 타입 있는 빌더로만 만듭니다.
- 컴포넌트는 `fetch`나 생성된 `*Handler`를 직접 부르지 않고 `@ratel/ts-bridges/hooks`만 씁니다.
- 한 페이지에서만 쓰는 컴포넌트는 `pages/<route>/components/`, 두 페이지 이상이면 `components/<group>/`에 둡니다.

---

## 3. 화면 동일성 규칙 (모든 단계에서 지킴)

위반하면 CSS가 깨지는 규칙입니다. 코드 리뷰 체크리스트로도 씁니다.

### 3.1 스타일시트
1. 로드 순서를 지금과 똑같이 둡니다: Google Fonts → `main.css` → `dx-components-theme.css` → 전역 스크립트 → `tailwind.css`. `main.css`에 `@layer`가 없고, `tailwind.css`의 전역 규칙(`html`, 스크롤바, `:root` 변수)은 마지막에 로드돼서 이기는 구조입니다. **Vite CSS 번들링에 맡기지 말고 `index.html`의 `<link>`로 순서를 고정합니다.**
2. Tailwind 버전을 하나로 고정합니다. 현재 생성 파일은 v4.1.5, 루트 `package.json`은 ^4.2.x입니다.
3. Tailwind는 지금 `.rs`를 평문으로 스캔하므로 enum `serialize = "..."` 문자열이나 주석 속 클래스도 생성됩니다. 전환 기간에는 `.rs`와 `.tsx`를 **둘 다 스캔**하고, 두 빌드의 선택자 목록을 diff해서 0이 될 때까지 `@source inline(...)`으로 보충합니다. TS에서 클래스 문자열을 `bg-${x}`처럼 조립하지 않습니다.
4. `light:` 커스텀 variant, `max-mobile:`/`tablet:`/`desktop:` 브레이크포인트, `aria-*`/`data-*` variant 설정을 그대로 가져갑니다.
5. 테마: `index.html`에서 첫 페인트 전에 `ratel-common-theme` 값으로 `data-theme`을 설정하는 스크립트를 유지합니다.

### 3.2 DOM
1. React는 `<div id="main">`에 마운트합니다 (`main.css`의 `#main{height:100%}`).
2. **래퍼 요소를 추가하지 않습니다.** `main.css`에 `:has()` 107개, 형제 결합자 233개, `nth-child` 계열 133개 규칙이 있습니다. 조건부 렌더링은 Fragment로 합니다.
3. `data-*`/`aria-*` 불리언은 문자열 `"true"`/`"false"`로 렌더링합니다 (`="true"]` 선택자 424개, `="false"]` 18개). `undefined`로 속성이 사라지지 않게 헬퍼(`dataBool()`)를 씁니다.
4. RSX의 복수 `class:` 속성(31곳)은 공백으로 이어 붙인 한 문자열로 만듭니다. 클래스 정렬·병합 도구(tailwind-merge 등)를 거치지 않습니다.
5. 인라인 `style` 217곳은 CSS 변수·`calc()`를 보존해 객체로 옮기고, `!important`가 필요한 곳은 문자열 `style` 속성으로 둡니다.
6. SVG 속성은 camelCase로 바꾸되 값은 그대로 둡니다. `lucide-react`가 추가하는 `class="lucide …"`와 `aria-hidden`은 CSS 영향이 없지만 DOM diff에서 무시 목록에 넣습니다. 커스텀 아이콘(`packages/icons`)은 `stroke="black"` + `[&>path]:stroke-*` 방식을 그대로 재현합니다.
7. `data-testid`는 이름·위치를 그대로 유지합니다. E2E가 이것으로 동일성을 판정합니다.

### 3.3 공용 컴포넌트
`Button`(142곳), `Input`(36), `Card`(29), `Row`/`Col`(34), `Badge`, `Separator`, `Tooltip`, `Checkbox`, `Switch`, `Popup`, `Toast`, `Layover`, `LoadingIndicator`를 **Dioxus 버전과 같은 요소·클래스 문자열**로 재현합니다. 클래스 문자열은 Rust enum의 `strum(serialize)` 값을 그대로 옮기고, 중복 클래스도 그대로 둡니다. `SuspenseBoundary` 폴백은 빈 렌더링입니다.

### 3.4 JavaScript
1. **리치 에디터**(`common/components/editor`, `script.js` 1,968줄)는 스크립트를 수정하지 않고 재사용합니다.
   - `.re-bridge`/`.re-slash-bridge`의 값은 React `onChange`가 받지 못하므로 ref로 네이티브 `input` 이벤트 리스너를 붙입니다.
   - `.re-content`는 `useRef`로 고정한 초기 HTML을 `dangerouslySetInnerHTML`로 한 번만 넣고 다시 렌더링하지 않습니다. 내용 교체는 `key`로 합니다.
   - 스크립트가 바꾸는 `data-open`/`data-empty`/`data-composing`/`data-bound`는 React가 관리하지 않게 정적 값으로만 렌더링합니다.
2. **페이지 스크립트 약 20개**(team_arena, post_edit, action_dashboard, drafts, report, analyzes, fact_or_fold …)는 수정 없이 한 번만 전역 로드합니다. 스크립트가 건드리는 클래스·속성은 React state로 관리하지 않습니다.
3. **전역 스크립트**: 키보드/visualViewport 스크립트(`--kb-inset`, `--vv-height`, `--vv-offset-top`, `html.kb-open`, 카카오톡 인앱 리다이렉트), `ratel-app-shell.js`(module), `wallet-connect.js`, PortOne SDK를 그대로 유지합니다.
4. `dioxus.send/recv` 드라이버 약 25개와 `document::eval` 약 75곳은 `lib/`의 일반 async 함수로 옮기고, `wasm_bindgen` extern은 `window.ratel.*` 직접 호출로 바꿉니다.
5. Dioxus 라우터가 쿼리스트링을 버려서 생긴 우회책(`window.__ratelInitialSearch`, 댓글 딥링크를 경로로 표현)은 동작 호환을 위해 **경로를 그대로 유지**합니다.

### 3.5 라우팅
1. 정적 경로(`/posts`, `/admin`, `/arcade`, `/spaces`, `/essence` …)를 `/:username` 와일드카드보다 먼저 매칭합니다.
2. `/sub-teams/manage`는 `/sub-teams/:sub_team_id`보다, `/sub-teams/:id/compose`는 상세보다 먼저 둡니다.
3. `/:username` 아래 10개 라우트는 지금처럼 social/team 레이아웃을 건너뜁니다.
4. 접근 제어는 지금처럼 컴포넌트 안에서 합니다 (라우터 게이트는 AdminLayout 하나).

---

## 4. API 계층

### 4.1 서버 함수 wire format (변경 없음, 클라이언트가 맞춤)
- 메서드는 매크로 이름, 경로 파라미터(`:x`, `{x}`)는 Display 문자열(SubPartition은 접두사 없는 ID).
- 쿼리는 `?a&b`의 인자 이름을 키로 씁니다. `Option`이 없으면 생략합니다.
- **본문은 인자 이름을 키로 한 객체입니다**: `{"req": {...}}`. 본문이 없으면 `{}`. DELETE도 본문을 가질 수 있습니다.
- 추출자(`user: User`, `team: Team`, `role: TeamRole` 등)는 클라이언트가 보내지 않습니다.
- 성공은 200 + `T`의 JSON. 핸들러 에러는 `{"message","code","data"}`이고 `data`는 `{"Auth":"UserNotFound"}` 같은 externally tagged 형식입니다. **추출자 거부(세션 없음 등)는 text/plain**이므로 클라이언트가 두 형식을 모두 처리합니다.
- 세션 쿠키 `{env}_sid` (`Secure`, `SameSite=None`, 30일). CSRF 없음. 브라우저는 `credentials: "include"`.
- 파일 업로드는 `GET /api/assets`로 presigned URL을 받아 S3에 직접 PUT합니다.

### 4.2 TS 생성 (asset의 `ts-server-fn`은 쓰지 않음)
asset의 `ts-server-fn`은 라우트 매크로를 대체하고 본문 형식·에러 형식을 바꾸므로 백엔드 재작성이 됩니다. 대신:
1. `packages/by-macros/src/server_fn/ts_bridge.rs`: 라우트 매크로가 모바일 HTTP 스텁을 만들 때 파싱하는 라우트 문자열·인자 목록으로 핸들러마다 `cfg(all(test, feature = "ts-bridge"))` 테스트(`ts_bridge_manifest_<fn>`)를 하나씩 만듭니다. 이 테스트는 `TS_SERVER_FN_PACKAGE_DIR`가 있을 때 `.gen/handlers/<METHOD>_<path>.json` 매니페스트를 씁니다(메서드, 경로, 경로·쿼리·본문 인자, `Result<T>`의 `T`). 타입 문자열과 import 경로는 매크로가 추측하지 않고 **ts-rs가 실제 Rust 타입에서** 뽑으므로 모듈만 다른 동명 타입·rename·제네릭(`ListResponse<TeamItem>`)이 정확합니다. 다른 빌드에서는 cfg로 빠져 결과물이 같습니다.
   - 라우트 매크로는 `fullstack`이 아닐 때만 클라이언트 스텁으로 펼쳐지므로 생성은 `tauri-web` 빌드로 합니다(핸들러 324개).
   - `scripts/gen-handlers.mjs`가 매니페스트를 `src/handlers/<camelFn>.ts`(asset 형식), `handlers/index.ts`·`types/index.ts`·`src/index.ts` 배럴로 렌더합니다. 경로·쿼리 조립, `{argName: value}` 본문, `Result<T>` → `T`. 모듈만 다른 동명 핸들러(6개)는 메서드+경로 접미사를 붙입니다.
2. 타입은 ts-rs 10.1(`serde-compat`, `uuid-impl`, `serde-json-impl`)로 생성합니다. derive는 `#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]`만 추가합니다(백엔드 동작 무변경).
   - **`i64`/`u64` → `bigint`**는 필드마다 속성을 달지 않고 asset처럼 생성 스크립트가 `number`로 정규화합니다(서버는 JSON number로 보냄).
   - ts-rs의 컨테이너 `type`/`as`는 선언만 바꾸고 **참조 이름과 import는 원래 타입 것을 씁니다.** 그래서 문자열·숫자로 직렬화되는 타입(SubPartition 구조체 220개는 매크로가, `SerializeDisplay`/`serde_repr` enum 27개는 속성으로)은 `ts(export, export_to = "types/", type = "string" | "number")`로 **별칭 파일**(`export type SpacePartition = string`)을 내보냅니다.
   - `serde(into = "XWire")`로 직렬화하는 모델 13개(`User`, `Post`, `SpaceAction` …)는 Wire 구조체를 모델 이름으로 export(`rename`)하고, 모델에는 모든 메서드를 Wire에 위임하는 수동 `impl TS`(`ts-bridge` 기능 한정)를 둡니다. `as`는 `serde(flatten)`과 함께 쓸 수 없고, 같은 파일을 두 곳이 쓰게 되기 때문입니다. 제네릭 `ListResponse<T>`(serde where 절이 ts-rs `Dummy`와 충돌)와 `CompositePartition<T, S>`(문자열)도 수동 impl입니다.
   - 이름이 겹치는 Rust 타입은 경로가 긴 쪽에 모듈 접두사 `rename`을 줍니다(예: `SocialSettingTeamResponse`, `PostsSpaceStatus`).
   - 서버 통합 테스트 모듈(`src/tests`, `features/character/tests`)은 `cfg(all(test, feature = "server"))`로 제한합니다. 클라이언트 빌드의 `cargo test`(gen-ts)가 이를 컴파일하면 해석 에러 수천 개로 빌드가 수십 분 걸립니다.
   - `serde_json::Value`는 `unknown`, untagged/flatten enum은 결과 타입을 수동 검토합니다.
3. `make gen-ts` (`app/ratel/Makefile`): `.gen`·`src/types` 초기화 → `TS_SERVER_FN_PACKAGE_DIR=… TS_RS_EXPORT_DIR=…/src cargo test --no-default-features --features tauri-web,ts-bridge --lib -- ts_bridge_manifest_ export_bindings_` → `gen-handlers.mjs`. 결과물은 커밋하고, CI `dx-check` 잡의 `gen-ts drift check` 단계가 재생성 후 diff 0을 강제합니다 (asset과 동일).
4. react-query 훅은 asset 컨벤션을 따릅니다: `src/hooks/use<Fn>.ts`를 asset의 `scaffold-ts-hooks.mjs`와 같은 규칙(GET → `useQuery`, 쿼리 키 `["<fn>", ...args]` / 그 외 → `useMutation`)으로 **한 번 스캐폴드한 뒤 수작업으로 관리**합니다(`make gen-ts`가 덮어쓰지 않음). 컴포넌트는 `@ratel/ts-bridges/hooks`만 쓰고 handler·`fetch`를 직접 부르지 않습니다. `use_infinite_query` 대체 훅은 bookmark 기반 `useInfiniteQuery` 래퍼로 하나 만듭니다.
5. 생성 대상이 아닌 경로(SSE `/api/arcade/events`, MCP, `/hooks/portone`, LinkedIn 콜백, `/launchpad/*`)는 필요한 경우만 수작업 클라이언트를 만듭니다.

### 4.3 런타임 클라이언트 (`packages/ts-bridges/src/runtime/client.ts`)
- **웹**: 같은 오리진 `fetch` + `credentials: "include"`.
- **Tauri**: `window.__TAURI_INTERNALS__`가 있으면 네이티브 `api_request` 명령으로 보냅니다. iOS WKWebView가 크로스사이트 세션 쿠키를 지우므로 필수입니다 (기존 `tauri_web/server_fn.rs`와 같은 동작). 베이스 URL은 빌드 시 `VITE_MOBILE_API_URL`로 고정합니다.
- 에러는 `ApiError(status, body)`로 던지고 JSON(`data` 파싱)과 text/plain을 모두 처리합니다. 로그인 흐름의 `Auth::UserNotFound` → 회원가입 분기처럼 variant 매칭이 필요한 곳을 지원합니다.
- **로컬 개발**: CORS가 `localhost`를 허용하지 않으므로 Vite 프록시(`/api`, `/v3`, `/mcp`)로만 개발합니다. 백엔드 CORS는 건드리지 않습니다.

---

## 5. 웹 배포와 SEO

### 5.1 서빙
- 앞단에서 경로를 나눕니다: `/api`, `/v3`, `/mcp`, `/hooks`, `/launchpad/health`, `/launchpad/points` → 기존 app-shell. 나머지 → React 정적 빌드(`index.html` 폴백). `/launchpad/return`은 페이지(`LaunchpadReturnPage`)이므로 React로 보냅니다.
- 사전 렌더링하는 경로는 `apps/web/src/prerendered-routes.ts`(현재 `/`)이고 `vite.config.ts`의 `ssgOptions.includedRoutes`와 공유합니다. `main.tsx`는 이 경로만 하이드레이트하고 **나머지 URL은 클라이언트에서 새로 렌더**합니다. 폴백으로 받는 HTML이 `/` 페이지 마크업이라, 다른 페이지를 그 위에 하이드레이트하면 React #418/#423이 납니다(스페이스 레이아웃에서 실제 발생). 폴백 HTML에 랜딩 콘텐츠가 들어가기 시작하면 JS 로드 전 잠깐 보이므로, 그 시점에 빌드가 `#main`이 빈 셸 HTML(`index.html` 템플릿)을 따로 내보내고 앞단 폴백을 그 파일로 바꿉니다.
- **prod는 React 전환을 k3s 이전보다 먼저 합니다 (D3).** 따라서 prod의 경로 분리는 현재 `ratel.foundation` 앞단인 **CloudFront behavior**(경로 패턴별 오리진)로 합니다. CloudFront 설정은 레포에 없으므로(`cdk/`에 소스 없음) 레포 밖 인프라 작업으로 진행하고, 이후 k3s 이전 때 같은 규칙을 `deploy/prod/30-ingress.yaml`로 옮깁니다.
- dev·PR 프리뷰는 이미 ingress-nginx 뒤에 있으므로 `deploy/{dev,pr-preview}` ingress에서 나눕니다.
- 같은 오리진이라 세션 쿠키·CORS 변경이 없습니다.
- 대상: `deploy/{dev,prod,pr-preview}`의 ingress, `dev-workflow.yml`/`prod-workflow.yml`/`pr-workflow.yml`.
- 서버 바이너리는 UI 없이(API 전용) 빌드합니다. `make build`/`build-testing`이 `cargo build --release`로 `target/server-image/server`를 만들고, 페이지는 `apps/web/server/serve.mjs` 파드가 서빙합니다(§9.1 P7).

### 5.2 SEO (결정 D1)
지금 스페이스(`SpaceLayout`)와 게시물 상세(`PostDetail`)의 title·description·og:image는 서버에서 데이터를 불러와 HTML에 넣습니다. SPA로 바꾸면 링크 미리보기에서 사라집니다. 정적 페이지의 메타는 `vite-react-ssg` 사전 렌더링(`/`, `/privacy`, `/terms`, `/child-safety`)으로 해결합니다. 동적 페이지는 아래 중 하나를 고릅니다.

| 방안 | 내용 | 장점 | 단점 |
|---|---|---|---|
| **A. 메타 주입 셸 (추천)** | `/spaces/:id*`, `/posts/:id`만 작은 Node/엣지 워커가 기존 GET API를 불러 `index.html`에 메타를 넣어 반환 | 정확, 백엔드 무수정, 대상 라우트 3계열 | 배포할 런타임이 하나 늘어남 |
| B. 크롤러만 엣지 함수 | User-Agent가 크롤러일 때만 A를 수행 | 파드 추가 없음 | UA 판별이 불안정, CloudFront 종속 (prod가 k3s로 이동 중) |
| C. 사전 렌더 서비스 | 헤드리스 브라우저로 URL별 렌더 캐시 | 모든 페이지 대응 | 무겁고 캐시가 오래됨 |
| D. 해당 라우트만 Dioxus SSR 유지 | 스페이스·게시물 페이지는 교체 전까지 기존 서버가 렌더 | 인프라 추가 없음 | 두 프론트엔드 병행, "동시 전환"과 충돌 |

---

## 6. 모바일 (Android / iOS)

1. `app/ratel-tauri/Makefile`의 `dx-build`를 `web-build`로 교체합니다: `VITE_BASE=/ VITE_MOBILE_API_URL=… pnpm -C apps/web build` → `dist/`에 복사. `build-android`, `release-aab`, `build-ios`, `build-ios-sim`, `testflight`가 이것에 의존합니다.
2. 네이티브 명령의 JS 래퍼를 `lib/platform/`에 둡니다: `api_request`, `google_sign_in`, `s3_put_object`, `save_file`, `print_page`, `open_external_url`, `plugin:opener|open_url`. 같은 번들이 웹에서도 돌도록 기능 감지로 분기합니다.
3. `tauri-web` 전용 경로(세션 복원 `restore_session`, 파일 업로더, 붙여넣기 이미지, `use_origin`, 구독/멤버십 mailto, DAO 탐색기 링크, 푸시)를 React 쪽에 옮깁니다.
4. FCM: Kotlin(`RatelMessagingService.kt`, `MainActivity.kt`)이 WebView에 넣는 토큰·탭 페이로드 계약을 그대로 유지하고, `deep_link_path` 매핑을 TS로 옮깁니다.
5. `tauri.conf.json` CSP에서 WASM용 `'wasm-unsafe-eval'`을 제거할 수 있는지 확인합니다 (다른 라이브러리가 `unsafe-eval`을 쓰는지 점검 후).
6. `mobile-release.yml`에서 dioxus-cli 설치를 pnpm 설치로 바꿉니다.

---

## 7. i18n

1. **추출 도구** (`packages/i18n-extract`, 구현됨): `translate!` 매크로와 같은 syn 파싱으로 `app/ratel/src`를 훑어 asset console 형식의 모듈을 생성합니다 — `const en = {…}`, `const ko: Record<keyof typeof en, string>`, `export const i18n = { en, ko }`, 타입 있는 `use<Name>I18n()` 훅(react-i18next 네임스페이스).
   - `translate!` 블록 148개 → `apps/web/src/i18n/generated/<Rust 디렉터리>/<name>.i18n.tsx`. 네임스페이스는 블록 이름(`PostDetailTranslate` → `postDetail`)이고, 겹치면 디렉터리로 한정합니다(4개).
   - `derive(Translate)` enum 54개 → `enums.i18n.tsx`의 `enum` 네임스페이스, `<Type>.<Variant>` 키, `useEnumI18n()`. `#[translate(from)]` 34개는 `delegates`에 감쌀 타입을 적습니다.
   - Rust에서 `str::replace("{n}", …)`로 채우던 `{n}`은 i18next `{{n}}`로 바꾸고, 훅은 해당 키를 `(values) => string`으로 노출합니다(`t(key, { replace: values })`).
   - 생성물은 커밋하고 `--check`로 CI(`dx-check` 잡의 `i18n drift check`)가 재생성 diff 0을 강제합니다. 페이지를 옮기면 해당 모듈을 페이지 옆으로 옮겨 수작업 관리로 전환하고, Dioxus 제거 시 추출 도구도 제거합니다. (이 "페이지 옆으로" 단계는 P7까지 누락됐고 2026-09-15에 일괄 정리했습니다 — §9.1 P7 참고.)
2. RSX에서 문자열을 이어 붙이던 곳은 보간 함수로 바꿔야 해서 사람이 검토합니다.
3. 언어 저장 키 `localStorage["language"]`와 쿠키 `language`를 그대로 씁니다 (기존 사용자 설정 유지, 서버 에러 메시지 언어와 일치). `src/i18n/index.ts`의 `initI18n`/`setLanguage`/`applyPersistedLanguage`가 asset과 같은 구조로 이를 처리합니다.
4. 기본 언어·폴백은 현재 동작과 같게 둡니다: 저장값 → 브라우저 언어 → 영어. 사전 렌더 HTML은 영어이고 하이드레이션 후 전환합니다.

---

## 8. 동일성 검증 도구 (P0에서 먼저 만듦)

1. **같은 데이터**: LocalStack/Postgres 시드 데이터로 Dioxus 빌드와 React 빌드를 각각 띄웁니다.
2. **스크린샷 diff**: Playwright로 라우트 목록 × 375/900/1280px × light/dark를 찍어 `toHaveScreenshot`/pixelmatch로 비교합니다. 애니메이션 끔, 폰트 로드 대기, lottie 마스킹.
3. **DOM diff** (구현됨): `playwright/tests/react/dom-parity.spec.js` — 파일 상단의 라우트 목록마다 Dioxus(`DIOXUS_BASE_URL`, 기본 `:8080`)와 React(`PLAYWRIGHT_BASE_URL`)를 열어 `#main`을 정규화(태그, id, class, role, `data-*`/`aria-*`(Dioxus 내부 속성 제외), style, 병합한 텍스트, 해시 제거한 에셋 경로)해 `toEqual`로 비교하고, 두 앱 스크린샷을 남깁니다. 페이지를 옮기면 라우트를 목록에 추가합니다. 현재 `/privacy`, `/terms`, `/child-safety`, 404 일치.
4. **Tailwind diff** (구현됨): `pnpm -C apps/web parity:tailwind` — 두 빌드의 CSS 선택자 목록 diff = 0. 경로 테이블은 `parity:routes`가 `route.rs`와 비교합니다(73/73, 레이아웃 체인·매칭 우선순위 포함).
5. **E2E** (하네스 구현됨): `playwright/tests/utils.js`의 `goto`·`waitForHydrated`·`waitForAppReady`가 `<meta name="ratel-app" content="react">`로 앱을 구분해 React는 `html[data-app-ready="true"]`, Dioxus는 기존 대기를 씁니다. Dioxus 앱 Desktop E2E는 교체 후에도 196 통과/3 skip(기존 skip)/0 실패. React 빌드에는 `tests/react/*.spec.js`(`--project=React`, `REACT_APP=1`)를 돌리고, 페이지가 옮겨지면 기존 spec을 React 빌드에 그대로 돌립니다.
6. **입력 검증**: 에디터 한국어 IME 입력, 슬래시 메뉴, 모바일 키보드 레이아웃은 Android 에뮬레이터·iOS 시뮬레이터에서 직접 확인합니다.

---

## 9. 단계별 계획

각 단계는 **완료 기준을 통과해야 다음 단계로** 갑니다. P2 이후 페이지 작업은 라우트 테이블이 페이지 파일 추가만으로 끝나도록(P0) 해서 병렬로 진행합니다.

| 단계 | 범위 | 규모 (rsx 줄) | 완료 기준 |
|---|---|---|---|
| **P0 기반** | pnpm 워크스페이스, `apps/web` 골격, CSS 파이프라인(3.1), `index.html`·전역 스크립트, 라우터 테이블(73개 경로 스텁), `ts-bridges` 생성(4.2) + 런타임 클라이언트(4.3), i18n 추출 도구(7), 검증 도구(8), CI(`web-lint`, `web-build`, `gen-ts-check`) | – | Tailwind diff 0, `gen-ts` diff 0, 샘플 GET/POST가 웹·Tauri에서 왕복, 빈 페이지 스크린샷이 레이아웃 배경까지 일치 |
| **P1 공용** | 3.3 공용 컴포넌트, popup/toast/theme/layover 서비스, RootLayout(인증·팀·알림·푸시), 로그인·회원가입 모달, 에디터 래퍼(3.4-1), 무한 스크롤 훅 | common 5.3천 + auth 650 | 컴포넌트별 DOM diff 0, 에디터 IME 테스트 통과 |
| **P2 소형·공개** | `/`, `/privacy`, `/terms`, `/child-safety`, 404, `/membership`, `/essence`, `/my-ai`, `/me/character`, `/my-follower`, `/launchpad/return`, `/onboarding/connections`, `/credentials` | 약 5천 | 라우트별 스크린샷·DOM diff 0, 해당 E2E 통과 |
| **P3 게시물** | `/posts/:id`, `/posts/:id/edit`, cross_posting 설정 | 약 4.2천 | 같음 + 게시물 작성·임시저장 E2E |
| **P4 소셜·팀** | `/:username` 아래 사용자·팀 페이지 13개, 팀 아레나, 설정(SocialSetting), 하위팀 13개 | 약 1.3만 | 같음 + 팀·하위팀 E2E |
| **P5 스페이스** | 스페이스 인덱스·액션(투표·퀴즈·토론·팔로우·미팅)·앱(분석·패널·파일·보상 …)·보고서 23개 | 약 2.3만 | 같음 + 스페이스 E2E 전부 |
| **P6 아케이드·관리자** | 아케이드 10개(Fact-or-Fold 포함, SSE), `/admin` | 약 3.1천 | 같음 + 아케이드 E2E |
| **P7 전환** | 경로 분리(dev·프리뷰는 ingress, prod는 CloudFront behavior), 메타 주입 셸(D1) 배포, 모바일 `web-build` 전환 후 스토어 빌드, UI 없는 서버 빌드 타깃, Dioxus UI 코드 제거 | – | PR 프리뷰에서 전체 E2E 통과, dev 환경 1주 운영, Android·iOS 실기기 확인 |

### 9.1 진행 현황 (2026-09-14 기준)

**P0 기반 — 완료**
- `apps/web`: Vite + vite-react-ssg, Dioxus와 같은 head 순서·전역 스크립트, Tailwind 4.1.5 파이프라인(`parity:tailwind` 1713/1713, 누락 0).
- 라우트 73개 테이블(`src/lib/route-tree.ts`, `parity:routes`가 `route.rs`와 경로·레이아웃 체인·매칭 우선순위 비교). 사전 렌더 경로(`/`)만 하이드레이트하고 나머지는 클라이언트 렌더.
- `packages/ts-bridges`: `make gen-ts`로 handler 324개·타입 698개 생성, asset 컨벤션의 hook 324개 스캐폴드 + `useInfiniteList`. 런타임은 웹 fetch / Tauri `api_request`.
- i18n: `packages/i18n-extract`가 `translate!` 148블록·`Translate` enum 54개를 asset 형식 `*.i18n.tsx`로 생성, react-i18next 런타임(저장 키 `language`).
- 검증: React 스모크(74 라우트), Dioxus 대비 DOM 동일성 스펙, 컴포넌트 DOM 스크립트(`scripts/component-dom-parity.mjs`), Playwright 헬퍼 React/Dioxus 겸용(Dioxus Desktop E2E 196 통과/0 실패 유지).
- CI: `web-build`(타입체크·파리티·빌드), `dx-check`에 gen-ts·i18n drift 검사.
- 백엔드 영향: `ts-bridge` 기능 한정 derive·impl, 통합 테스트 모듈 `server` 게이팅만. `server`/`web`/`tauri-web` `cargo check -D warnings` 통과. (`--features mobile`은 이 작업 이전부터 `login_modal`의 `interop::sign_in` import로 실패하며, CI는 이 조합을 검사하지 않습니다.)

**P1 공용 — 완료**
- UI 프리미티브(Button·Card·Row·Col·Input·Badge·Switch·Separator·Checkbox·Tooltip·LoadingIndicator·SeoMeta·ThemeSwitcher·SpaceCard·FileExtensionIcon·Collapsible·Pagination·CommentImageGrid·ImageUploadPreview·BottomSheet·ContextMenu·ScrollArea·Select·Tabs·Sheet·Dialog), Popup·Toast·Layover·scroll lock, 테마, ErrorBoundary/ErrorPage, AuthContext(`lib/auth.tsx`).
- LoginModal·회원가입(아레나 탑바·멤버십 요금제에서 호출), 리치 에디터(`components/editor`, IME·마크다운 단축키 36개 스펙), 알림 부트스트랩·벨·패널·푸시 딥링크(`components/notifications`), PremiumSwitch.
- 네이티브 명령은 `lib/native.ts` 한 곳에서만 호출합니다(`s3_put_object`, `save_file`, `print_page`, `google_sign_in`, `open_external_url`, `plugin:opener|open_url`). `open_external_url`의 인자는 `{ req: { url } }`입니다(Rust `tauri-common`은 `{ url }`만 보내 명령 시그니처와 맞지 않음).

**P2 소형·공개 — `/` 외 완료**
- DOM 일치 확인(비로그인, 1440·375px 로그인 상태 포함): `/privacy`, `/terms`, `/child-safety`, 404, `/me/character`, `/essence`, `/membership`, `/credentials`, `/my-ai`, `/my-follower`, `/launchpad/return`, `/onboarding/connections`.
- 진행 중: `/`(홈 아레나, 유일한 사전 렌더 경로).

**P2 `/` · P3~P5 — 병합 완료**: 홈 아레나(사전 렌더·하이드레이션 오류 없음), 게시물 3개, 소셜 레이아웃·사용자/팀 페이지, 팀 DAO·멤버·설정, 하위팀 작성기 5개·거버넌스 6개, 스페이스 레이아웃·인덱스·토론·액션(투표·퀴즈·토론 편집·팔로우·미팅)·앱(일반·파일·패널·인센티브)·분석·보고서. 73개 라우트에 스캐폴드 플레이스홀더 페이지는 남아 있지 않습니다.
- 검증(HEAD `12ffb7a86`): `typecheck`·`build`·`parity:tailwind` 1713/1713·`parity:routes` 73/73, React Playwright 139개 실행 → 102 통과·37 건너뜀(개발 서버 전용 에디터 36개·알림 1개)·실패 0. DOM 동일성 스펙 22개(홈 상호작용 4개 포함) 전부 일치.
- 병합 중 정리: 업로드는 `lib/upload.ts` 하나(네이티브 `s3_put_object` → fetch 폴백), `FileUploader`는 `components/ui/file-uploader.tsx` 하나, 알림은 `components/notifications` 하나, 무한 스크롤 훅은 `useSuspenseInfiniteList` 하나로 합쳤습니다. `ActionDescriptionEditor`는 데스크톱에서 리치 에디터, AI 모더레이터 토글은 `PremiumSwitch`.
- 암호화 투표: `packages/attr-voting-wasm`(기존 `attr_voting` 크레이트의 wasm-bindgen 래퍼, `make gen-attr-voting-wasm`, 결정적 빌드)로 브라우저에서 CP-ABE 암호화. 로컬 서버는 `ATTR_VOTING_AUTHORITY_JSON` 없이 빌드되어 실서버 왕복은 불가하고, Rust 경로와 암·복호화 결과가 바이트 단위로 같음을 확인했습니다.

**기존 E2E를 React 대상으로 실행** (`vite preview` + 로컬 `bypass` 서버, React 빌드는 `VITE_BYPASS=true` — Rust `make build-testing`의 `bypass` 기능에 대응):
- Desktop(`tests/web`, 21개 스펙 199개 테스트): 전부 통과. 3개는 스펙 자체의 `test.skip`. 첫 실행의 실패 6건은 앱 수정으로 해결했습니다 — `DiscussionArenaContent`가 로딩 중 조기 return 뒤에 훅을 호출해 React #310으로 토론 페이지가 깨짐, `/:username/credentials`의 본인인증이 `VITE_BYPASS`를 무시함, 하위팀 문서 수정 후 관리 페이지 목록 캐시가 갱신되지 않음, 스펙의 `waitForAppReady` import 누락. 참여 버튼 2건은 `VITE_BYPASS` 없이 빌드해 실제 PortOne을 호출한 것이 원인이었습니다.
- SysAdmin(`tests/web-admin`): 10 통과, 3건은 스펙의 `describe.skip`.
- Mobile(`tests/mobile`): 4 통과, 17건 스킵. `mobile-bottom-nav`는 `describe.skip`이고, 나머지 두 스펙은 `route.rs`에 더 이상 없는 `/spaces/:id/dashboard`를 찾지 못해 건너뜁니다(두 앱 공통).
- 같은 과정에서 맞춘 것: 스페이스 액션 컴포넌트 4개의 Tailwind 클래스 문자열 순서를 Rust와 일치(앱 전체 스캔 결과 순서만 다른 문자열 0개), 쿼리 재시도 제거(Rust `use_loader`는 재시도하지 않음), DOM 동일성 스펙은 `#main`에 내용이 생긴 뒤 비교(React는 데이터가 오면 클라이언트 렌더).
- 주의: Playwright 실행을 겹치면 새 실행이 `test-results/`를 비워 앞선 실행의 trace 쓰기가 `ENOENT`로 실패합니다. 한 번에 하나씩 실행합니다.

**후속 정리 — 완료**:
- 암호화 투표: wasm에 `decrypt_vote_json_with_key_json` export를 추가해 검증 패널이 실제로 복호화·검증합니다. 액션 투표 페이지도 `lib/poll-encryption.ts`를 쓰고 `lib/poll-crypto.ts`(스텁)는 삭제했습니다. wasm 재생성은 결정적(두 번 빌드 바이트 동일)이고, 네이티브 Rust와 양방향 암·복호화 결과가 일치합니다.
- TS 타입: `DynamoEnum`/사용자 정의 `Serialize` enum 15개에 ts-rs 주석(`rename_all`, 리터럴 유니온 `type`)만 추가해 생성 타입이 실제 JSON과 같아졌습니다(예: `ReportStatus` = `"DRAFT" | "PUBLISHED"`, `MembershipTier` = `"FREE" | … | \`ENTERPRISE#${string}\``). `make gen-ts` 재실행 차이 0, 이를 가리던 우회 코드(`isReportPublished` 등)는 삭제했습니다.
- 컨텍스트: 팀 페이지 7곳을 SocialLayout의 wall/team-arena 컨텍스트로 옮겨 페이지당 `getWallByUsername` 1회, 중복 `use-wall-context.ts` 삭제. `space-context:` 등 임시 로컬 로드는 공유 컨텍스트로 교체했고, SocialLayout 밖 전체 화면 라우트(하위팀 신청·작성기 등)만 Rust와 같이 로컬 조회를 유지합니다.

**최종 검증 (HEAD `1f0c15dc1`)**:
- `typecheck`·`build`·`parity:tailwind`(누락 0)·`parity:routes`(73/73), React Playwright 140개 → 103 통과·37 건너뜀(개발 서버 전용)·실패 0.
- 기존 E2E(React, `VITE_BYPASS=true`): Desktop 199 → 196 통과·3 스펙 스킵, SysAdmin 10 통과·3 스펙 스킵, Mobile 4 통과·17 스킵(Dioxus와 동일).
- 팀 아레나 상단바 활성 탭: 직접 진입·SPA 이동 모두 두 앱 DOM 일치(§12의 Rust 버그 참고).
- 기기: Android 에뮬레이터·iOS 시뮬레이터 모두 최신 번들로 스모크(부팅 → 네이티브 로그인 → 로그인 후 페이지 → 새로고침 뒤 세션 유지) 통과, 로그인 상태 라우트 39개 스윕에서 오류·404·준비 안 됨 0건.

**P6 아케이드·관리자 — 완료**: 아케이드 레이아웃·홈·리더보드·Fact-or-Fold 매칭/게임룸(Rust와 같은 폴링 주기), 관리자 레이아웃 2개·페이지 7개. 실시간 갱신은 Rust와 같이 폴링만 씁니다(SSE 구독 없음).

**P7 준비**: `app/ratel-tauri/Makefile`에 `web-build` 타깃과 `FRONTEND=web` 선택 추가(기본값 `dx` 유지). 전환 시 기본값만 바꾸면 `build-android`·`release-aab`·`build-ios`·`build-ios-sim`·`testflight`가 `apps/web` 번들을 씁니다.
- **Android 실측(에뮬레이터, 디버그 APK, 로컬 서버)**: React 번들로 부팅 → 네이티브 `api_request` 로그인 → 로그인 후 `/user1/drafts`·`/my-ai` 로드 → WebView 새로고침 뒤 세션 유지까지 통과.
- 실측에서 찾은 문제 두 가지:
  1. React 쪽에 Tauri 시작 시 세션 복원이 없었습니다. Rust `AuthContext::init` + `try_restore_session`처럼 `/api/auth/me` 전에 refresh token을 교환하도록 `lib/auth.tsx`에 추가했습니다.
  2. 로컬 서버의 세션 쿠키가 `Secure`라서 `http://10.0.2.2`로는 네이티브 쿠키 저장소가 쿠키를 보내지 않습니다(`cookie_store`는 `localhost`·루프백만 보안 출처로 취급). 로컬 검증은 `adb reverse tcp:8080 tcp:8080` + `MOBILE_API_URL=http://localhost:8080`으로 합니다. HTTPS 환경(dev·prod)에는 해당 없습니다.
- **iOS 실측(시뮬레이터 iPhone 16 Plus, `make build-ios-sim FRONTEND=web MOBILE_API_URL=http://localhost:8080`)**: 같은 흐름(부팅 → 로그인 → `/user1/drafts` → `/my-ai` → 새로고침 뒤 세션 유지) 통과. WKWebView는 CDP가 아니라 WebKit 인스펙터 프로토콜이므로 `ios_webkit_debug_proxy -s unix:<webinspectord_sim.socket>`로 붙고, 명령은 `Target.sendMessageToTarget`으로 페이지 타깃에 보냅니다. 시뮬레이터는 호스트 `localhost`에 바로 닿아 `adb reverse` 같은 설정이 필요 없습니다.
- **기기 내 라우트 스윕(Android·iOS 모두)**: 로그인 상태로 이관한 라우트 39개를 WebView 안에서 전부 방문했습니다. 공개 페이지, 캐릭터·My AI·멤버십·자격증명·Essence, 아케이드, 사용자 월(드래프트·보상·게시물·멤버십·스페이스·설정·연결), 게시물 상세·편집, 팀(홈·DAO·멤버·설정·멤버 설정·구독·하위팀 관리·규약), 스페이스(인덱스·액션·앱 4종·분석·보고서)가 포함되며, 오류 페이지·404·준비 안 됨이 두 플랫폼 모두 0건입니다. 팀·게시물·스페이스 id는 네이티브 `api_request`로 로컬 서버에서 조회했습니다. iOS 시뮬레이터는 한국어 로케일이라 시스템 언어 반영도 확인됐습니다. WebKit의 `Runtime.evaluate`는 `awaitPromise`가 없어, 비동기 호출 결과는 `window`에 저장한 뒤 폴링합니다.
- Android 15 에뮬레이터는 `libratel_tauri_lib.so`가 16KB 페이지 정렬이 아니라는 호환성 경고를 띄웁니다. 기존 Rust 네이티브 라이브러리 빌드 설정 문제로, 이번 전환과는 무관합니다.
- 로컬 Tauri 스모크: `playwright/tests/tauri/cdp-client.js`로 WebView CDP에 붙는 방식은 기존 CI 스모크와 같습니다(기존 `create-space.spec.js`는 dev 백엔드 대상).

**P7 전환 — 코드 (로컬 커밋, push 전)**
- **Dioxus UI 삭제**: `app/ratel/src`의 Rust 파일 1984개 중 UI 934개 삭제 → 1050개(104,617줄) 남음. 앱 루트(`app.rs`·`route.rs`·`views`·`components`), `common/components`·`hooks`·`providers`, 각 기능의 `components`·`views`·`hooks`·`interop`·`web`·`i18n.rs`·`layout.rs`·페이지 컴포넌트, `ssr_cache` 미들웨어, `Dioxus.toml`·`index.html`, `design-system-preview` 크레이트, `packages/i18n-extract`를 지웠습니다. 복구용 브랜치: `backup/pre-dioxus-ui-removal`.
- **백엔드 동일성 확인**: 서버 함수 매크로 302개·axum 라우트 10개가 삭제 전과 같고, `make gen-ts` 재생성 차이 0(TS 클라이언트 동일). `server,bypass,local-dev`(lib·bin·tests)와 `tauri-web,ts-bridge` `cargo check` 오류·경고 0.
- UI 코드에 섞여 있던 서버용 코드는 옮기거나 문자열로 바꿨습니다: `FileUploadError` → `common/types/file_upload_error.rs`, 알림 CTA URL(`SpaceAction::get_cta_url`)은 `Route` 대신 같은 경로 문자열(`/spaces/{id}`). UI 전용 `Route`/`rsx` 메서드(`PostResponse::url`, `SpaceActionSummary::get_url`, `SpaceActionType::create`, `SpaceAppType::settings_path`·`icon`)와 wasm 전용 `create_dao`는 삭제했습니다.
- **서버 진입점**: `common::api_router()` = `Router::<FullstackState>::new().register_server_functions().with_state(FullstackState::headless())`. 페이지 렌더러·정적 파일 폴백 없이 API·MCP·멤버십·아케이드·크로스포스팅·런치패드 라우터만 합칩니다. 통합 테스트도 같은 라우터를 씁니다.
- **프론트 에셋 이동**: `app/ratel/assets`(main.css·테마·아이콘·애니메이션 등) → `apps/web/assets`, `app/ratel/js` → `apps/web/shell-js`(빌드 결과가 `apps/web/assets`로), `app/ratel/tailwind.css` → `apps/web/src/styles/tokens.css`, React가 쓰던 페이지 스크립트 15개 → `apps/web/src/legacy-scripts/`. `app/ratel/assets/design`(목업, local-dev `/designs`)은 서버에 남깁니다.
- **Tailwind**: Rust 소스 스캔이 없어지면서 빠지는 클래스 409개를 `src/styles/safelist.css`(`@source inline`)로 고정해, 생성 CSS의 클래스 집합이 삭제 전과 같습니다(추가된 것은 미사용 `--shadow-*` 변수 3개).
- i18n 번들(`src/i18n/generated`)은 이제 직접 편집하는 원본입니다(헤더 문구 변경). `parity:tailwind`·`parity:routes`·`component-dom-parity` 스크립트 삭제.
- **i18n 위치 정리 (P7 이후, 2026-09-15)**: §7-1의 "페이지를 옮기면 모듈을 페이지 옆으로" 단계가 빠져 번들 149개가 `src/i18n/generated/<삭제된 Rust 경로>`에 남아 있던 것을 asset 컨벤션대로 옮겼습니다. 한 폴더에서만 쓰는 모듈은 그 폴더의 `i18n.tsx`(한 폴더에 여럿이면 `<name>.i18n.tsx`), 여러 곳에서 쓰는 모듈은 기능의 본 폴더(예: `pages/[username]/sub-teams/sub-team.i18n.tsx`)로, 앱 전역인 `enums.i18n.tsx`만 `src/i18n/`에 둡니다. 등록은 `src/i18n/modules.ts`(네임스페이스 이름 불변). 어디서도 쓰지 않던 번들 37개(React로 옮기며 다른 번들·문구로 대체된 Dioxus 컴포넌트의 것)는 삭제했습니다. 옮긴 112개는 머리 주석 2줄 외 내용이 원본과 같습니다.
- **링크 미리보기(D1)**: `apps/web/server/serve.mjs`(의존성 없는 Node 서버)가 `/spaces/:id/**`는 `GET /api/spaces/:id`, `/posts/:id`는 `GET /api/posts/:id`를 익명으로 조회해 Dioxus `SeoMeta`와 같은 title·description·og/twitter 태그를 `index.html`에 넣습니다(1.5초 타임아웃, 60초 캐시, 실패 시 원본). 태그에 `data-rh`를 붙여 react-helmet-async가 중복 없이 교체합니다. `/healthz`, `PROXY_API=1`(로컬 검증용 API 프록시, SSE 스트리밍) 포함.
- **페이지 캐시 (2026-09-15, tc14 처리량 저하 대응)**: 초기 `serve.mjs`는 요청마다 `index.html`을 디스크에서 읽고 메타를 넣은 뒤 **동기 gzip**으로 압축하고 로그를 남겼습니다. Dioxus의 `ssr_cache`(익명 `/spaces/**` HTML 메모리 캐시)가 없어진 셈이라, tc14에서 web 파드가 포화되어 `/healthz` 응답이 늦어지고 liveness 실패로 재시작됐습니다. 이제 완성된 페이지(메타 삽입 + plain/gzip)를 메모리에 캐시합니다 — 60초(메타 조회 실패는 10초), 최대 1,000개, 같은 페이지 동시 미스는 한 번만 생성, `index.html`은 5초마다 mtime만 확인, 요청 로그는 오류·1초 초과만(`LOG_REQUESTS=all`이면 전부). 로컬 단일 프로세스(동시 200, gzip): 초당 10,518 → 50,922건, 요청 1만 건당 CPU 1,483 → 158ms. 테스트 26개 통과. web 파드 probe `timeoutSeconds`는 1초 → 5초(dev·prod·pr-preview).

**P7 전환 — 검증 (로컬, 커밋 `c4eb4638d`·`4674e5f1f`)**
- 구성: API 전용 app-shell(`cargo build --release --features server,bypass,local-dev`, 8080) + `apps/web/server/serve.mjs`(4173, `PROXY_API=1`로 ingress와 같은 경로 분리) + React 빌드(`VITE_BYPASS=true`). Playwright는 4173을 대상으로 실행.
- React 77 통과·37 건너뜀(개발 서버 전용)·실패 0 (Dioxus 대비 DOM 동일성 스펙 삭제분 제외), Desktop 196 통과·3 스펙 스킵, SysAdmin 10 통과·3 스펙 스킵, Mobile 4 통과·17 스킵 — 전환 전 기준선과 같음.
- 서버 통합 테스트: 라우터를 쓰는 `cors_`·`mcp_` 14개 통과. `cargo check -D warnings`(server·tauri-web) 오류·경고 0(미사용 UI 의존성 9개·기능 3개 제거 후).
- 주의: 통합 테스트(`TestContext::setup`)는 로컬 Postgres 픽스처를 지웁니다. 이후 Playwright를 돌리려면 `scripts/postgres-seed.sql`을 다시 적재해야 합니다(첫 실행의 로그인 실패 원인 — 삭제 전 바이너리로도 같은 401을 재현해 코드 문제가 아님을 확인).
- **Android 에뮬레이터**(디버그 APK, 새 Makefile의 `web-build` 번들, `MOBILE_API_URL=http://localhost:8080` + `adb reverse`): 앱 데이터 초기화 후 부팅 → 이메일 코드 로그인(네이티브 `api_request`) → `/user1/drafts`·`/my-ai`·`/membership`·`/me/character` 전체 이동(세션 복원 경유) → 새로고침 뒤 세션 유지, 9단계 통과. `build-android-debug`에 `web-build` 의존성이 없어 이전 번들이 들어갈 수 있던 문제를 고쳤습니다.
- **iOS 시뮬레이터**(iPhone 16 Plus, `make build-ios-sim`, `dx` 없이 BUILD SUCCEEDED): 스모크(로그인 → 드래프트 → My AI → 새로고침 뒤 세션 유지) 통과, 로그인 상태 라우트 39개 스윕에서 오류·404·준비 안 됨 0건.
- 남은 확인: `kubectl --dry-run`·`actionlint`(로컬에 없음), 실제 PR 프리뷰·dev 배포, prod 도메인은 아직 CloudFront 앞단이라 DNS 전환 시 링크 미리보기·경로 분리 확인.

**P7 전환 — 배포 (로컬 커밋, push 전)**
- **ingress 경로 분리 (dev·prod·PR 프리뷰)**: `/api`·`/v3`·`/mcp`·`/hooks`·`/launchpad/health`·`/launchpad/points`·`/admin/proxy` → `app-shell:8080`, 나머지 `/` → `web:3000`. PR 프리뷰는 local-dev 기능의 `/designs`·`/roadmap`도 app-shell로 보냅니다. 모두 `pathType: Prefix`(세그먼트 단위, 가장 구체적인 경로 우선).
- **`web` 워크로드**: `deploy/{dev,prod}/15-web.yaml`, `deploy/pr-preview/35-web.yaml` — `ratel-web` 이미지(`apps/web/Dockerfile`: node:22-alpine, `dist`+`server`만 복사, non-root), `API_ORIGIN=http://app-shell:8080`, readiness·liveness `/healthz`, 레플리카는 app-shell과 같게.
- **app-shell readiness**: `/`가 없어져 `tcpSocket:8080`으로 변경. `/launchpad/health`는 서명된 POST만 받아 프로브로 쓸 수 없습니다(`launchpad_partner/server.rs`).
- **CI**: `dev-workflow`·`prod-workflow`는 app-shell을 `make build`(cargo, dx·wasm·dioxus-cli 없음)로 빌드해 `target/server-image`를 이미지로 올리고, 이어서 `shell-js` → `pnpm -C apps/web build`(VITE_* ← 기존 Firebase·WalletConnect·PortOne 시크릿) → `ratel-web` 이미지를 올립니다. 배포 대기 단계는 ingress로 `/`(web)와 `/launchpad/health`(app-shell, 5xx가 아니면 통과)를 둘 다 확인합니다.
- `pr-workflow`: `dx-check` → `rust-check`(`cargo check --features server`, `--no-default-features --features tauri-web`, gen-ts drift), i18n drift·Tailwind/라우트 파리티 단계 삭제, `build-web-image` 잡 추가(`VITE_BYPASS=true`), e2e는 두 이미지를 기다립니다.
- **모바일**: `app/ratel-tauri/Makefile`의 `dx-build`와 `FRONTEND` 선택 삭제 — `build-android`·`release-aab`·`build-ios`·`build-ios-sim`·`testflight`는 항상 `web-build`(shell-js 빌드 + VITE_* 전달)를 씁니다. `mobile-release.yml`은 dioxus-cli 설치 제거, Node 22 + pnpm 설치, `WALLETCONNECT_PROJECT_ID` 추가.
- 로컬: `docker-compose.yaml`의 testing 프로필에 `web-testing`(4173, `PROXY_API=1`), `scripts/building-lambda-bootstrap.sh`는 `cargo build --features server,lambda`.
- 검증: 변경한 YAML 전부 파싱, `make -n build-android`/`testflight`에 dx 없음, `apps/web/Dockerfile` 로컬 빌드 후 `/healthz`·`/` 200. `kubectl --dry-run=client`와 `actionlint`는 로컬에 서버 설정·도구가 없어 실행하지 못했습니다(PR 프리뷰에서 확인 필요).

---

## 10. 전환 방식 (결정 D2)

- **일괄 전환 (추천, "웹·모바일 동시" 결정과 맞음)**: P1~P6을 브랜치에서 모두 끝내고 PR 프리뷰·dev에서 검증한 뒤 P7에서 한 번에 바꿉니다. 두 프론트엔드가 섞이는 기간이 없지만 전환 시점의 위험이 큽니다.
- **라우트별 전환**: 완료된 라우트만 ingress로 React에 보냅니다. 위험은 작지만 두 앱 사이 이동 시 전체 새로고침, 테마·언어·팝업 상태 불일치, 모바일은 부분 전환이 불가능해서 웹과 시점이 갈립니다.

---

## 11. 결정이 필요한 항목

| # | 항목 | 추천 |
|---|---|---|
| D1 | 동적 페이지 SEO 방식 (5.2) | **결정: A. 메타 주입 셸** |
| D2 | 전환 방식 (10) | **결정: 일괄 전환** |
| D3 | prod 전환 순서: CloudFront → k3s 이전과 React 전환 중 무엇을 먼저 | **결정: React 전환 먼저.** prod는 CloudFront behavior로 경로 분리, k3s 이전 때 ingress로 이동 (5.1) |
| D4 | 백엔드 어노테이션 범위: 엔티티(모델)에 직접 `derive(TS)` vs 응답 DTO 분리 | 추천안 적용: 어노테이션만 추가 (DTO 분리는 백엔드 변경이므로 제외) |
| D5 | iOS 네이티브 세션 트랜스포트 미완료 작업 처리 시점 | 추천안 적용: P0에서 런타임 클라이언트와 함께 마무리 |

---

## 12. 이관하면서 정리할 기존 문제

- 쓰이지 않는 라우트 파일: `features/{spaces,social,admin,my_follower}/route.rs`, `spaces/pages/{overview,report}/route.rs`, `apps/incentive_pool/route.rs`, 미사용 `apps/rewards/route.rs`, 라우트 없는 `spaces/pages/{dashboard,overview}` → 옮기지 않습니다.
- `/posts`는 "app shell" 문자열만 렌더링하는 스텁입니다 → 동작을 확인하고 유지 여부를 정합니다.
- `asset!("/assets/ratel-team-dao.js")`가 가리키는 파일이 없습니다.
- SocialLayout 사이드바가 금지된 `use_resource`를 씁니다 → React에서는 훅으로 정리됩니다.
- `LoadingIndicator`가 unpkg `@latest` lottie를 불러옵니다 → 버전을 고정합니다.
- PortOne SDK가 전역 외에 3곳에서 다시 주입됩니다 → 한 번만 로드합니다.
- 팀 아레나 상단바의 활성 탭 표시가 동작하지 않습니다. `TeamArenaLayout`이 렌더마다 `wall_ctx.into()`로 `TeamArenaContext`(`Signal::new(TeamArenaTab::Home)`)를 새로 만들어 `provide_context`로 교체하므로, 하위 페이지가 `active_tab.set(...)`해도 상단바에 반영되지 않습니다. 실행 중인 Dioxus 앱은 직접 진입·SPA 이동 모두 `arena-topbar__hud--active`를 한 번도 붙이지 않는 것을 실측했습니다. React는 DOM 동일성을 위해 상단바에 항상 Home을 넘겨 같은 결과를 냅니다. 전환 후 컨텍스트를 한 번만 만들고 양쪽을 함께 고칩니다.

---

## 13. 전체 완료 기준

1. 73개 라우트가 모두 React에서 동작하고, 라우트별 스크린샷(3개 폭 × 2개 테마)·DOM diff가 기준을 통과합니다.
2. Playwright 28개 spec이 React 빌드에서 통과합니다.
3. `make gen-ts` diff 0, `pnpm lint`, `pnpm -C apps/web typecheck`, `pnpm -C apps/web build`가 CI에서 통과합니다.
4. 백엔드 변경은 0장 2항의 허용 범위뿐이고, `cargo check --features server`와 서버 테스트가 그대로 통과합니다.
5. Android·iOS 실기기에서 로그인(세션 유지), 게시물 작성, 스페이스 참여, 푸시 탭 딥링크가 동작합니다.
6. prod 앞단(CloudFront, 이후 k3s ingress)이 페이지 경로를 React로 보내고, 스페이스·게시물 링크 미리보기 메타가 메타 주입 셸로 유지됩니다.
