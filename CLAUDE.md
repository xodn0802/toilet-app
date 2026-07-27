# 화장실 찾기 앱(뿡)

낯선 곳에서 가까운 화장실을 찾고, 청결도·편의시설·이용조건까지 알려주는 지도 웹앱.
상세 기획과 기능 명세(P0/P1/P2)는 @README.md 참고. 기획 배경은 @idea.md 참고.

진행: 1단계(프로젝트 셋업 + Vercel 배포) 완료. 다음은 2단계 Supabase 스키마.
배포: https://toilet-app-azure.vercel.app/ · 저장소: https://github.com/xodn0802/toilet-app

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
