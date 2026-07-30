# 화장실 찾기 앱(뿡)

낯선 곳에서 가까운 화장실을 찾고, 청결도·편의시설·이용조건까지 알려주는 지도 웹앱.
상세 기획과 기능 명세(P0/P1/P2)는 @README.md 참고. 기획 배경은 @idea.md 참고.

배포: https://toilet-app-azure.vercel.app/ · 저장소: https://github.com/xodn0802/toilet-app

## 진행 상황 (2026-07-30 기준)

- 완료 1단계 — 프로젝트 셋업 + Vercel 배포 (324dd9e)
- 완료 2단계 — Supabase 스키마 toilets·reviews·review_photos + RLS (c2d32a6)
- 완료 5단계 — 지도 홈: 현재 위치 + 화장실 마커 + 마커 상세 시트 (9b37f1e)
  - 흰 화면 버그 해결. 지도·마커 6개·상세시트까지 로컬 프로덕션 빌드에서 확인됨.
- 대기 3·4단계 — 공공데이터 수집 + 주소 지오코딩. 키가 없어 시작 못 함.
  - DATA_GO_KR_SERVICE_KEY: 포털 점검 ~2026-08-02 18시
  - KAKAO_REST_API_KEY: 지금 발급 가능 (4단계 지오코딩용)
- 임시데이터 `lib/toilets/mock-toilets.ts` (6건). 실제 데이터로 갈아끼울 지점은
  `lib/toilets/fetch-toilets.ts` 한 곳.

다음 할 일 (키 도착 전에도 가능한 것부터)

1. P0 4번 길찾기 — 상세 시트에 카카오맵 앱·웹 길찾기 링크 추가. 의존성 없음.
2. `fetch-toilets.ts`를 Supabase 쿼리로 교체 — 스키마는 이미 있으니 가능. 단
   테이블이 비어 있어 지도가 빈 상태가 되므로, 시드 몇 건을 먼저 넣는다.
3. 키가 오면 3단계(공공데이터 적재) → 4단계(지오코딩) 순서로.

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
- 지도: 카카오맵 SDK (주소→좌표 지오코딩 포함)
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
