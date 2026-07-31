# 화장실 찾기 앱(뿡)

낯선 곳에서 가까운 화장실을 찾고, 청결도·편의시설·이용조건까지 알려주는 지도 웹앱.
상세 기획과 기능 명세(P0/P1/P2)는 @README.md 참고. 기획 배경은 @idea.md 참고.

배포: https://toilet-app-azure.vercel.app/ · 저장소: https://github.com/xodn0802/toilet-app

## 진행 상황 (2026-07-31 기준)

- 완료 1단계 — 프로젝트 셋업 + Vercel 배포 (324dd9e)
- 완료 2단계 — Supabase 스키마 toilets·reviews·review_photos + RLS (c2d32a6)
- 완료 P0 1·3번 — 지도 홈: 현재 위치 + 화장실 마커 + 마커 상세 시트 (9b37f1e)
  - 흰 화면 버그 해결. 아래 "지도 레이아웃 주의" 참고.
- 완료 P0 4번 — 도보 길찾기 (6d29534)
  - TMAP 보행자 경로 API로 좌표를 받아 카카오맵 Polyline으로 그린다.
    상단 배너와 상세 시트에 "279m · 도보 4분" 표시. 실시간 안내는 하지 않는다.
  - 카카오모빌리티 길찾기는 **자동차 전용**이라 못 쓴다. 카카오맵 JS SDK에는
    경로 탐색 기능 자체가 없다. 그래서 좌표는 TMAP, 그리기만 카카오다.
- 완료 데이터 소스 교체 — mock 제거, Supabase 조회로 전환 (5db971a)
  - `lib/toilets/fetch-toilets.ts`가 `geocode_status='ok'` 행을 조회한다.
  - 개발용 표본 6건은 `supabase/seed/dev-toilets.sql`. 실제 데이터가 들어오면
    `delete from public.toilets where external_id like 'seed-%';` 로 지운다.
- 완료 앱 정체성 — 청자 색 체계 + 워드마크 앱바 + 리뷰 UI (a74815f)
  - 색은 `app/globals.css` 한 곳에만 있다. 아래 "색은 globals.css 에서만" 참고.
  - 리뷰 UI(별점·태그·사진)는 **화면만** 만들었다. 저장은 아직 안 한다.
    로그인(P0 7번)이 있어야 RLS를 통과한다.
- 완료 배포 정상화 (c6ce8e0) — Vercel에 Supabase 두 변수 등록 후 재배포.
  배포된 앱에서 마커 6건·콘솔 에러 0 확인(2026-07-31).
- 대기 3·4단계 — 공공데이터 수집 + 주소 지오코딩.
  - `DATA_GO_KR_SERVICE_KEY`: **아직 비어 있음.** 이것만 있으면 3단계 시작 가능.
  - `KAKAO_REST_API_KEY`: 발급 완료. 지오코딩 호출 성공 확인함(2026-07-31).
    응답의 `x`=경도·`y`=위도이고 문자열이라 `parseFloat`이 필요하다.
    `address_type`이 `REGION`이면 동 중심점이라 화장실 좌표로는 부정확하니
    4단계에서 `geocode_status='failed'`로 두고 사람이 보게 한다.

### 배포 깨짐 해결됨 (2026-07-31)

프로덕션이 "NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 가
필요합니다"로 죽어 있었다. 5db971a로 데이터 소스를 Supabase로 바꿨는데
Vercel에 두 변수를 등록하지 않아서였다. 사용자가 등록했고, c6ce8e0 배포에서
**마커 6개·콘솔 에러 0**으로 정상 동작을 확인했다.

교훈 — 클라이언트에서 새 환경변수를 쓰기 시작하면 **push 전에 Vercel 등록
여부를 먼저 확인한다.** 로컬 `.env.local`에 있다고 배포되는 것이 아니다.
그리고 `NEXT_PUBLIC_*`은 빌드 때 번들에 박히는 값이라, 변수만 추가하고
재배포하지 않으면 **기존 배포는 그대로 깨져 있다.**

### 배포에서 지도가 안 뜬다 — 원인 확정됨 (2026-07-31)

**배포별 URL이라서 맞았다.** 사용자가 본 주소는
`toilet-iby4ufu5h-xodn0802s-projects.vercel.app` 이었다. `curl` 로 Referer 만
바꿔 카카오 SDK 에 요청해 확인했다.

| Referer                       | 응답                                                     |
| ----------------------------- | -------------------------------------------------------- |
| `toilet-app-azure.vercel.app` | **200** — SDK 정상                                       |
| `toilet-iby4ufu5h-….app`      | **401** `domain mismatched! ... registered web domains.` |

**등록으로 해결하지 말 것.** 배포별 URL 은 매 배포마다 해시가 바뀌어 등록해도
다음 배포에 또 깨진다. 확인은 항상 프로덕션 URL 로 한다. Vercel 대시보드의
Visit 버튼이 배포별 URL 로 보내는 것이 함정이다. (그 URL 은 Vercel SSO 뒤에
있어서 로그인한 본인에게만 보인다 — 302 → `vercel.com/sso-api`.)

재현 방법 — 배포된 HTML 에서 키를 뽑아 Referer 만 바꿔 두 번 부른다.
`curl -s <프로덕션> | grep -o 'sdk\.js?appkey=[a-f0-9]*'` 로 키를 얻고,
`curl -H "Referer: <검사할 URL>" "https://dapi.kakao.com/v2/maps/sdk.js?appkey=$KEY"`.

아래는 원인을 찾기 전에 적어 둔 기록이다.

### (기록) 배포에서 지도가 안 뜬다는 제보 (2026-07-31, 당시 원인 미확정)

사용자가 Vercel 배포에 접속하니 **"지도를 불러오지 못했습니다. 카카오 개발자
사이트에 이 도메인이 등록되어 있는지 확인해 주세요."** 가 떴다.

확인된 사실 — **`toilet-app-azure.vercel.app` 은 정상이다.** 같은 시각에
브라우저로 열어 마커 6개, SDK 요청 200, 실패 문구 없음을 확인했다.
그러니 **사용자가 본 화면은 다른 호스트일 가능성이 크다.**

이 문구는 `ToiletMap.tsx` 의 `<Script onError>` 에서만 뜬다. 즉 SDK
**스크립트 자체를 못 받았다**는 뜻이고, 카카오는 미등록 도메인에서 온 요청에
스크립트를 주지 않는다. 앞서 `localhost:3111` 에서 같은 문구가 뜨고 `3000`
에서는 정상이었던 것도 같은 이유다 — **호스트·포트가 정확히 일치해야 한다.**

가장 유력한 원인 — Vercel은 배포마다 URL을 여러 개 만든다.

| 종류     | 예                                 | 바뀌나          |
| -------- | ---------------------------------- | --------------- |
| 프로덕션 | `toilet-app-azure.vercel.app`      | 고정            |
| 브랜치   | `toilet-app-git-main-….vercel.app` | 고정            |
| 배포별   | `toilet-app-<해시>-….vercel.app`   | **매 배포마다** |

대시보드의 배포 목록이나 Visit 버튼으로 열면 **배포별 URL**로 가기 쉽다.
카카오에는 프로덕션 URL만 등록돼 있을 것이므로 그 화면만 지도가 죽는다.

다음 세션에서 할 일 — **순서대로.**

1. 그 화면의 **주소창 호스트를 정확히 확인한다.** 이게 먼저다.
2. `toilet-app-azure.vercel.app` 이었다면 원인이 다르므로 다시 판단한다
   (네트워크 차단, 광고 차단 확장, 회사망 등).
3. 다른 호스트였다면 카카오 > 내 애플리케이션 > 플랫폼 > Web 에 등록한다.
   **배포별 URL은 매 배포마다 바뀌므로 등록해도 소용없다.** 고정된 두 개
   (프로덕션·브랜치)만 등록하고, 확인은 항상 프로덕션 URL로 하는 편이 낫다.

같이 고치면 좋을 것 — 지금 문구는 원인을 도메인 하나로 단정한다. 실제로는
네트워크 문제일 수도 있다. `location.host` 를 문구에 같이 보여주면 이번처럼
"어느 주소로 봤는지"를 되묻지 않아도 된다.

### 현재 위치가 부정확한 문제 (2026-07-31 확인)

데스크톱에서 열면 실제 위치(인하대)와 4km 떨어진 곳(송현근린공원)이 찍힌다.
`ToiletMap.tsx`의 위치 코드는 정상이고, **브라우저가 그 좌표를 준 것이다.**
데스크톱은 GPS가 없어 WiFi·IP로 추정하는데, IP만 남으면 ISP 기지국 위치가 나온다.
휴대폰(GPS)으로 열면 정확한지 먼저 확인할 것.

문제는 지금 코드가 `position.coords.accuracy`(오차 반경, m)를 **아예 안 본다는**
점이다. GPS면 10-50m, IP 기반이면 수천 m 이상이 들어온다. 그래서 4km 떨어진
지점을 파란 점으로 자신 있게 찍고, **길찾기 출발지도 그 틀린 위치가 된다.**
"279m · 도보 4분"이 실제로는 4km일 수 있다.

**A안으로 해결함.** `ACCURACY_LIMIT_M = 1000`(GPS 10-50m, WiFi 수백 m, IP 수 km
사이가 여기서 갈린다)을 넘으면 `locationCoarse`가 되고 네 가지가 바뀐다.

1. 파란 점 대신 **오차 반경 원**(`kakao.maps.Circle`). 점은 "여기 있다"라서
   수 km 벗어난 좌표에 찍으면 거짓말이 된다. 원은 "이 안 어딘가"다.
2. **축척을 원에 맞춘다.** 반경이 화면보다 크면 지도가 통째로 주황이 돼
   고장난 것처럼 보인다. `handleRecenter`도 같은 규칙을 따른다.
3. `현재 위치가 부정확합니다 · 오차 반경 약 4.0km` 안내(signal 톤).
4. **상세 시트의 직선거리를 감춘다.** 출발지가 수 km 불확실한데 "555m"라고
   세 자리로 적으면 없는 정밀도를 있는 것처럼 말하게 된다.

길찾기는 **막지 않고 경고만 한다**(`RouteBanner`의 `originUncertain`). 막으면
데스크톱에서 핵심 기능이 통째로 죽고, 임계값 1km가 틀렸을 수도 있다.

남은 선택지 — 아직 안 했고, 필요해지면 그때 한다.

- **B.** `watchPosition`으로 더 정확한 값이 오면 갱신한다. 처음엔 IP였다가 곧
  WiFi로 정밀해지는 경우를 잡는다.
- **C.** 지도를 눌러 출발지를 직접 지정한다. 실내·지하까지 대응.

검증 방법 — Playwright로 `accuracy`를 주입하면 데스크톱에서 재현된다.
`newContext({ permissions: ["geolocation"], geolocation: { latitude, longitude,
accuracy } })`로 4000과 30을 각각 넣어 두 경로를 다 확인했다. 카카오는 Circle을
`<ellipse>`로 그리고 **색을 `style` 속성에 넣는다** — `fill`·`stroke` 속성을
보면 못 찾는다. MCP의 Playwright는 `chrome` 채널을 찾다 실패하니
`~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`를 직접 지정할 것.

### UI에서 바로 고칠 두 가지 (2026-07-31 사용자 요청)

**1. 다크 모드 토글 버튼이 없다.** 지금은 OS 설정(`prefers-color-scheme`)만
따라가서, 사용자가 앱 안에서 바꿀 방법이 없다. 화면에 버튼이 안 보이는 게
당연한 상태다. 붙일 곳은 `AppBar.tsx`.

- 값은 `라이트 / 다크 / 시스템` 3단이어야 한다. 2단으로 만들면 "OS를 따라간다"는
  현재 동작으로 되돌아갈 수 없다.
- 구현은 `<html>`에 `data-theme`를 얹고 `globals.css`에
  `[data-theme="dark"]` 블록을 `@media (prefers-color-scheme: dark)`와 **같은 값**으로
  하나 더 두는 방식. 변수만 갈아끼우면 되므로 컴포넌트는 안 건드린다.
- **첫 페인트 전에** 저장값을 적용해야 흰 화면이 번쩍이지 않는다
  (`layout.tsx`의 인라인 `<script>`). localStorage는 이 용도로는 써도 된다 —
  저장 금지 대상은 TMAP 경로 응답이지 화면 설정이 아니다.

**2. "주변 N곳"에 범위가 없다.** `fetch-toilets.ts`의 조건은
`geocode_status='ok'`와 `limit(100)`뿐이고 **위치 필터가 없다.** 지금 숫자는
"주변"이 아니라 "좌표가 있는 전부"라서, 지도를 아무리 옮겨도 안 변한다.

- 문구를 `1km 이내 6곳`처럼 **반경과 함께** 보여준다. 숫자만 있으면 기준을
  알 수 없다.
- 거리 계산 함수는 이미 있다 — `lib/geo/distance.ts`의 `straightLineDistance`.
  시트의 "직선 555m"가 그걸 쓴다. 표본 6건이면 **가져온 뒤 걸러도** 충분하다.
- 정할 것: 반경을 고정(1km)할지, 지도 축척에 따라 바꿀지, 사용자가 고르게 할지.
  **처음에는 고정 1km를 권함.** 표본이 6건뿐이라 반경을 좁히면 0곳이 되기 쉬우니
  0곳일 때 무엇을 보여줄지(반경을 넓히라는 안내)까지 같이 정해야 한다.
- 반경 밖 화장실의 마커를 숨길지 말지도 함께 정한다. 숫자와 마커가 다르면
  사용자는 숫자를 안 믿는다.
- 공공데이터가 적재되면 이 걸러내기는 **DB 조회 조건으로 내려가야 한다.**
  `fetch-toilets.ts` 주석에 적어 둔 bbox 조회(6단계)와 같은 작업이니 그때 합친다.

### 다음 할 일

네 건 중 **배포 지도 미표시와 위치 정확도는 끝났다.** 남은 두 건(다크 모드
토글, 반경 표시)을 처리한 뒤 아래로 간다.

별점(P0 5번)을 하려면 **로그인(P0 7번)이 먼저다.** `reviews.user_id`가
`auth.users(id)` 참조에 not null이고, RLS 작성 정책이 `to authenticated` +
`user_id = auth.uid()`라서 로그인 없이는 저장 자체가 안 된다. RLS를 풀어
우회하지 말 것 — 아무나 남의 이름으로 쓰고 지울 수 있게 된다.

1. **P0 7번 로그인** — Supabase Auth + 카카오 소셜. 카카오 REST 키는 이미 있다.
   - 대안: Supabase 익명 로그인도 `authenticated` 역할이라 RLS를 통과한다.
     빠르지만 스팸에 취약하고, 나중에 소셜 로그인을 붙일 때 익명 계정의 리뷰를
     이관해야 한다. 급하지 않으면 처음부터 소셜로 가는 편이 싸다.
2. **P0 5번 리뷰 등록** — 청결도 별점 + 상태 태그(`tissue`·`soap`·`bidet`·
   `hot_water`·`accessible`). 태그 값 검증은 DB가 아니라 앱에서 한다.
   - reviews에는 UPDATE 정책이 의도적으로 없다. 수정하면 `created_at`이
     "최종 확인 시점"을 잘못 나타내기 때문. 삭제 후 재작성으로 처리한다.
3. **P0 3번 보강** — 상세 시트에 리뷰 목록·평균 별점 표시. 읽기는 RLS가 공개라
   로그인 없이도 되지만, 1·2번이 없으면 보여줄 데이터가 없다.
4. **3단계 → 4단계** — 공공데이터 키가 들어오면. 3단계가 행을 만들고(좌표 없음,
   `pending`), 4단계가 지오코딩해 `ok`로 바꿔야 비로소 지도에 뜬다.

### 환경변수 — 어디에 두는지

Vercel에 등록할 것은 앱이 **런타임·빌드에 실제로 쓰는 것만**이다.
`scripts/`용 키는 로컬 `.env.local`에만 두고 Vercel에 올리지 않는다.

| 키                                          | Vercel           | 쓰는 곳                     |
| ------------------------------------------- | ---------------- | --------------------------- |
| `NEXT_PUBLIC_KAKAO_MAP_KEY`                 | 필요             | 브라우저 지도 SDK           |
| `NEXT_PUBLIC_SUPABASE_URL` · `..._ANON_KEY` | 필요             | 브라우저 조회               |
| `TMAP_APP_KEY`                              | 필요             | `app/api/walk-route` 런타임 |
| `KAKAO_REST_API_KEY`                        | 불필요           | 로컬 지오코딩 스크립트      |
| `DATA_GO_KR_SERVICE_KEY`                    | 불필요           | 로컬 적재 스크립트          |
| `SUPABASE_SERVICE_ROLE_KEY`                 | **올리지 말 것** | RLS를 통째로 우회함         |

`NEXT_PUBLIC_*`은 빌드 시 클라이언트 번들에 문자열로 박힌다. Vercel에서
Sensitive로 표시해도 배포된 JS를 열면 보이므로 의미가 없다. 카카오 JS 키는
노출이 전제이고 **도메인 등록**으로 보호한다 — 그래서 포트가 다르면
(`localhost:3111` 등) SDK가 거부된다. 로컬 확인은 등록해 둔 포트로 할 것.

### 색은 globals.css 에서만 (a74815f)

컴포넌트에 `zinc-500`·`emerald-600` 같은 팔레트 색을 직접 쓰지 않는다.
`app/globals.css`가 CSS 변수로 색을 정하고, Tailwind v4의 `@theme inline`이
그걸 유틸리티 이름으로 바꿔준다. 컴포넌트는 이름만 쓴다.

| 이름                                         | 뜻                                 |
| -------------------------------------------- | ---------------------------------- |
| `paper`                                      | 화면 바닥                          |
| `surface`                                    | 앱바·시트·카드                     |
| `sunken`                                     | 입력칸처럼 한 단 들어간 면         |
| `ink` · `muted`                              | 본문 글자 · 보조 글자              |
| `line`                                       | 테두리                             |
| `brand` · `brand-strong` · `brand-ink`       | 청록, 눌렀을 때, 그 위에 얹는 글자 |
| `brand-soft` · `-ink` · `-line`              | 연청자 배경의 강조 칩              |
| `signal` · `signal-soft` · `signal-soft-ink` | 경고·오류 (주황)                   |
| `star` · `star-empty`                        | 별점                               |

**다크 모드에 `dark:` 변형을 쓰지 않는다.** `@media (prefers-color-scheme: dark)`
안에서 변수 값만 바꾼다. `dark:`를 쓰기 시작하면 색 하나를 고치는 데 파일
열 개를 열어야 하고, 두 모드가 서서히 어긋난다.

예외는 **지도에 넘기는 색**이다. 카카오 SDK의 Polyline 색이나 마커 SVG의
데이터 URI 안에서는 CSS 변수가 풀리지 않아 리터럴을 쓸 수밖에 없다
(`ToiletMap.tsx`의 `ROUTE_COLOR`, `lib/map/toilet-marker.ts`의 `BODY`).
`globals.css`의 `--brand`를 바꾸면 이 두 곳도 같이 고쳐야 한다.

### 지도 레이아웃 주의 (같은 버그 재발 방지)

지도가 흰 화면이었던 원인은 SDK가 아니라 **높이 0**이었다. `body`가 `min-h-full`,
`main`·래퍼가 `flex-1`(= `flex-basis:0%`)이면 flex가 계산한 높이는 퍼센트 해석의
기준이 못 되고, 지도 컨테이너의 `h-full`이 `auto`로 무너진다. 카카오 내부 요소는
전부 `position:absolute`라 내용 높이가 0 → 지도는 정상 생성·타일 로드까지 되고도
`overflow:hidden` 박스에 갇혀 안 보인다.

- 지도까지 이어지는 높이는 `flex-1`이 아니라 **`h-full`로 잇는다.**
- 지도 위에 얹는 배너·오버레이는 **`z-10` 이상**을 준다. 카카오 내부 레이어가
  z-index 1·2를 쓰므로 `z-index:auto`면 덮인다.
- 확인 방법: `npm run build && npm start` 후 브라우저에서 지도 컨테이너의
  `getBoundingClientRect().height`가 0이 아닌지부터 본다. 콘솔 에러는 안 난다.

## 기술 스택

- 프론트엔드: Next.js (React) + Tailwind
- 지도: 카카오맵 SDK (표시·마커·폴리라인) + 카카오 REST (주소→좌표 지오코딩)
- 도보 경로: TMAP 보행자 경로안내 API (일 1,000건 무료)
  - 약관상 응답을 24시간 이상 보관할 수 없다. 경로를 DB·localStorage에 저장하지 말 것.
- 백엔드: Next.js API Routes
- DB·인증·스토리지: Supabase
- 배포: Vercel (GitHub 연동)

## 개발 원칙

- 지금은 P0(MVP 핵심) 기능만 만든다. P1·P2는 나중.
- 바로 코딩하지 말고, 먼저 계획을 세워 확인받은 뒤 구현한다.
- 기능은 작게 쪼개서 하나씩 진행하고, 한 기능이 끝나면 커밋한다.
- 커밋은 기능 단위로 나누고, 무엇을·왜 바꿨는지 메시지에 남긴다.

## Git · 배포 규칙 (중요)

- 이 프로젝트는 GitHub에 올리고 Vercel로 배포한다.
- Vercel은 GitHub의 main 브랜치에 push되면 자동으로 배포한다.
  따라서 main은 항상 실행 가능한(빌드되는) 상태를 유지한다.
- API 키·비밀값(카카오·Supabase 등)은 절대 커밋하지 않는다.
  - 로컬은 `.env.local`에 저장하고, `.gitignore`에 반드시 포함한다.
  - 배포용 값은 Vercel 대시보드의 환경변수(Environment Variables)에 등록한다.
- 커밋·푸시 전에 diff를 확인해 키나 `.env`가 섞이지 않았는지 점검한다.

## 코드 컨벤션

- Next.js는 16.x다. 학습 데이터와 API·규약이 다를 수 있으니
  코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 확인한다. @AGENTS.md 참고.
- App Router + TypeScript + Tailwind v4. `src/` 없이 루트에 `app/`을 둔다.
- 폴더 구조
  - `app/` — 페이지·레이아웃, `app/api/` — API Routes
  - `components/` — 재사용 UI 컴포넌트
  - `lib/` — Supabase 클라이언트 등 공용 모듈
  - `scripts/` — 데이터 수집·지오코딩 등 로컬 실행 스크립트 (배포에 포함되지 않음)
  - `supabase/migrations/` — DB 스키마 SQL
- 파일명: 컴포넌트는 PascalCase(`KakaoMap.tsx`), 그 외는 kebab-case(`geocode-toilets.ts`).
- 임포트는 `@/` 별칭을 쓴다 (`@/lib/supabase/client`).
- UI 문구는 한국어. `lang="ko"`, 폰트는 시스템 한글 스택.
