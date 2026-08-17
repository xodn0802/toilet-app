-- 0002_toilet_submissions.sql — 사용자 화장실 추가 요청 (README P2)
--
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전하도록 if not exists / drop policy if exists 를 사용한다.
--
-- 설계 메모
-- - 제보를 toilets 에 바로 넣지 않고 **별도 테이블**에 쌓는다. 검증 없이 지도에
--   올리면 장난 등록 하나가 급한 사람을 헛걸음시킨다. 개발자가 검토한 뒤 옮긴다.
--   (toilets 에 status 컬럼을 붙이는 방법도 있지만, 그러면 조회 조건·부분 인덱스를
--    전부 손봐야 하고 검토 전 데이터가 지도 조회 경로에 섞인다.)
-- - **로그인을 요구하지 않는다.** 카카오 로그인이 KOE205 로 막혀 있어서, 로그인을
--   요구하면 이 기능도 같이 죽는다. 대신 RLS 를 "등록만 되고 읽기는 안 됨"으로 둔다.
-- - 사용자가 지도에서 좌표를 직접 찍으므로 지오코딩이 필요 없다. 승인할 때
--   geocode_status 를 바로 'ok' 로 넣는다.

-- ---------------------------------------------------------------------------
-- toilets.access — 이용조건
--
-- 제보 폼이 무료/개방/음료구매/유료를 받는데, 받을 칸이 없으면 승인할 때 그 값이
-- 그냥 버려진다. 컬럼만 먼저 만든다 — 필터·우선노출(README P1-9)은 아직 안 한다.
-- 공공데이터에는 이 필드가 없어서 수집된 행은 전부 NULL 이다.
-- ---------------------------------------------------------------------------

alter table public.toilets
  add column if not exists access text
    check (access in ('free', 'open', 'purchase', 'paid'));

-- ---------------------------------------------------------------------------
-- toilet_submissions — 검토 대기 중인 제보
-- ---------------------------------------------------------------------------

create table if not exists public.toilet_submissions (
  id uuid primary key default gen_random_uuid(),

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),

  -- 이름만 필수다. 폼이 길수록 중간에 포기하므로 나머지는 전부 선택.
  name text not null check (char_length(name) between 1 and 60),

  -- 지도에서 직접 찍은 좌표. 이게 있어서 지오코딩 단계가 없다.
  lat double precision not null,
  lng double precision not null,

  -- 역지오코딩 결과. 검토할 때 좌표 두 개만 보는 것보다 낫다.
  -- 건물이 없는 곳은 도로명주소가 없어서 둘 다 NULL 일 수 있다.
  road_address text,
  jibun_address text,

  access text check (access in ('free', 'open', 'purchase', 'paid')),
  open_hours text check (char_length(open_hours) <= 40),
  unisex boolean,

  -- 'tissue' | 'soap' | 'accessible' | 'diaper'
  -- reviews.tags 와 같은 이유로 값 검증은 앱에서 한다.
  facilities text[] not null default '{}',

  note text check (char_length(note) <= 300),

  -- 로그인이 막혀 있어 지금은 늘 NULL. 열리면 채워진다.
  user_id uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),

  -- 검토 결과. 승인해서 toilets 로 옮겼다면 그 행을 toilet_id 로 가리킨다.
  reviewed_at timestamptz,
  toilet_id uuid references public.toilets(id) on delete set null
);

-- 검토 대기 목록을 오래된 순으로 훑는 용도.
create index if not exists toilet_submissions_pending_idx
  on public.toilet_submissions (created_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- RLS — 등록은 누구나, 읽기는 아무도 못 한다
--
-- SELECT 정책을 **일부러 두지 않는다.** 그래서 anon 키로는 남이 올린 제보를
-- 조회할 수 없다. supabase-js 의 .insert() 는 .select() 를 붙이지 않으면
-- Prefer: return=minimal 로 보내므로 SELECT 정책 없이도 등록은 정상 동작한다.
-- 앱 코드(lib/toilets/submit-toilet.ts)가 .select() 를 붙이지 않는 이유가 이것이다.
--
-- 읽기·수정·삭제는 service_role(개발자 대시보드)만 할 수 있다.
-- ---------------------------------------------------------------------------

alter table public.toilet_submissions enable row level security;

drop policy if exists "제보 등록은 누구나" on public.toilet_submissions;
create policy "제보 등록은 누구나"
  on public.toilet_submissions for insert
  to anon, authenticated
  with check (
    -- 이걸 안 막으면 클라이언트가 status='approved' 를 직접 넣어 검토를 건너뛴다.
    status = 'pending'
    and reviewed_at is null
    and toilet_id is null
    -- 로그인한 사람이 남의 이름으로 올리는 것도 막는다.
    and (user_id is null or user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 검토 절차 — 대시보드에서 손으로 돌린다
--
-- 승인 UI 는 만들지 않았다. 제보가 쌓이면 그때 판단한다.
--
-- ⚠️ 아래 승인 SQL 은 **낡았다. 0005_gender.sql 의 것을 쓸 것.**
--    이 쿼리는 building·floor(0004) 와 gender(0005) 를 모르므로, 그대로 쓰면
--    제보의 건물·층·성별이 조용히 버려진다. 여기는 기록으로만 남긴다.
-- ---------------------------------------------------------------------------

-- 대기 목록 보기
--
--   select id, name, road_address, jibun_address, access, open_hours,
--          unisex, facilities, note, created_at
--     from public.toilet_submissions
--    where status = 'pending'
--    order by created_at;

-- 승인 — 제보 한 건을 toilets 로 옮긴다. 좌표를 직접 받았으므로 지오코딩은 없다.
--
-- ⚠️ toilets_has_address check 때문에 **주소가 둘 다 NULL 이면 실패한다.**
--    역지오코딩이 안 된 제보가 여기 해당한다 — 주소를 채워 넣고 다시 실행할 것.
--
-- ⚠️ 휴지·비누는 toilets 에 컬럼이 없어 옮겨지지 않는다. 그건 "오늘 있고 내일
--    없는" 정보라 원래 reviews.tags 의 몫이고, 등록 시점에 박아 두면 정보가 썩는다.
--    제보 행에는 그대로 남으니 참고만 한다.
--
--   with s as (
--     select * from public.toilet_submissions where id = '<제보 id>'
--   ), ins as (
--     insert into public.toilets
--       (source, name, road_address, jibun_address, lat, lng, geocode_status,
--        access, open_hours, unisex, has_diaper_table, has_disabled_toilet)
--     select 'user', s.name, s.road_address, s.jibun_address, s.lat, s.lng, 'ok',
--            s.access, s.open_hours, s.unisex,
--            'diaper' = any(s.facilities), 'accessible' = any(s.facilities)
--       from s
--     returning id
--   )
--   update public.toilet_submissions
--      set status = 'approved', reviewed_at = now(),
--          toilet_id = (select id from ins)
--    where id = '<제보 id>';

-- 반려
--
--   update public.toilet_submissions
--      set status = 'rejected', reviewed_at = now()
--    where id = '<제보 id>';
