-- 0003_reviews_anonymous.sql — 익명 인증으로 리뷰 등록 (README P0-5)
--
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전하도록 if not exists / drop constraint if exists 를 사용한다.
--
-- **대시보드에서 따로 켜야 하는 것이 하나 있다.**
--   Authentication > Sign In / Providers > "Allow anonymous sign-ins" ON
-- 이걸 안 켜면 signInAnonymously() 가 422 로 거부되고 리뷰를 아예 못 쓴다.
--
-- 설계 메모
-- - 카카오 로그인을 걷어내고 **익명 인증**으로 간다. 로그인의 목적은 리뷰 남용
--   방지 하나뿐인데, 카카오는 동의항목 설정(KOE205)에 막혀 P0-5 를 통째로 세웠다.
-- - **RLS 정책은 한 줄도 안 바꾼다.** signInAnonymously() 가 만드는 사용자도
--   auth.users 에 진짜 행이 생기고 JWT 의 role 이 'authenticated' 다. 그래서
--   0001_init.sql 의 "to authenticated + user_id = auth.uid()" 정책이 그대로 맞는다.
--   (익명과 정식 계정을 구분해야 할 때가 오면 auth.jwt()->>'is_anonymous' 로 가른다.
--    지금은 전원 익명이라 구분할 대상이 없다.)
-- - 나중에 카카오를 얹고 싶으면 auth.linkIdentity({provider:'kakao'}) 로 같은
--   user_id 에 붙인다. 이미 쓴 리뷰가 그대로 따라오므로 지금 선택은 되돌릴 수 있다.

-- ---------------------------------------------------------------------------
-- reviews.nickname — 작성자 표시 이름
--
-- 별명은 가입할 때 auth.users.raw_user_meta_data 에도 들어가지만, 클라이언트는
-- **자기 것만** 읽을 수 있어 남의 별명을 못 가져온다. 프로필 테이블을 따로 두는
-- 대신 리뷰 행에 함께 박는다 — 목록 조회가 조인 없이 끝난다.
--
-- 위조는 RLS 로 막을 수 없다(클라이언트가 아무 문자열이나 넣을 수 있다). 표시용
-- 이라 피해가 없고, 화면이 깨지지 않도록 길이만 제한한다.
--
-- not null 을 기본값 없이 붙이므로 테이블이 비어 있어야 통과한다. 지금 reviews 는
-- 0건이다. 행이 있는데 이걸 돌리면 조용히 넘어가는 대신 에러로 멈추는 편이 낫다.
-- ---------------------------------------------------------------------------

alter table public.reviews
  add column if not exists nickname text not null;

alter table public.reviews
  drop constraint if exists reviews_nickname_length;
alter table public.reviews
  add constraint reviews_nickname_length
    check (char_length(nickname) between 1 and 20);

-- ---------------------------------------------------------------------------
-- 남용 방지 — 한 화장실에 한 신원당 리뷰 하나
--
-- 익명 신원은 브라우저 데이터를 지우면 새로 만들 수 있다. 그래서 신원만으로는
-- 남용이 안 막히고, **규칙**이 막아야 한다. 이 인덱스가 "한 화장실 도배"를 막고,
-- "실제로 가 본 사람만" 은 앱에서 근접 검증(lib/reviews/eligibility.ts)이 맡는다.
--
-- 근접 검증을 DB 로 못 내리는 이유: DB 는 사용자가 어디 있는지 모른다. 위치를
-- 행에 실어 보내게 하면 클라이언트가 아무 좌표나 넣을 수 있어 검증이 안 되고,
-- 작성 위치를 저장하는 개인정보 부담만 생긴다.
-- ---------------------------------------------------------------------------

create unique index if not exists reviews_one_per_user_idx
  on public.reviews (toilet_id, user_id);
