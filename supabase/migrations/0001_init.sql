-- 0001_init.sql — 뿡 P0 초기 스키마
--
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전하도록 if not exists / drop policy if exists 를 사용한다.
--
-- 설계 메모
-- - 공공데이터(source='public')와 사용자 등록(source='user', P2)을 한 테이블에 담는다.
--   idea.md의 "통합 스키마" 방침. 지도는 출처와 무관하게 같은 마커로 그린다.
-- - 공공데이터는 2025년 2월부터 좌표를 주지 않는다. 그래서 lat/lng 는 NULL 허용이고,
--   geocode_status 로 지오코딩 진행 상태를 따로 관리한다. 스크립트가 중단돼도
--   'pending' 행부터 이어서 돌릴 수 있게 하려는 것.
-- - PostGIS 는 쓰지 않는다. 인천 한정 수천 건 규모에서는 lat/lng 범위 조건으로 충분하다.
--   전국으로 넓힐 때 재검토.

-- ---------------------------------------------------------------------------
-- 공통: updated_at 자동 갱신
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- toilets — 화장실 기본 정보
-- ---------------------------------------------------------------------------

create table if not exists public.toilets (
  id uuid primary key default gen_random_uuid(),

  -- 출처. 'public' = 공공데이터 수집, 'user' = 사용자 직접 등록(P2)
  source text not null default 'public'
    check (source in ('public', 'user')),

  -- 공공데이터 관리번호. 재수집 시 이 값으로 upsert 해서 중복 적재를 막는다.
  -- 사용자 등록 건은 NULL (Postgres 는 NULL 을 unique 중복으로 보지 않는다).
  external_id text unique,

  name text not null,
  road_address text,
  jibun_address text,

  -- 지오코딩 결과. 둘 중 하나라도 NULL 이면 지도에 그리지 않는다.
  lat double precision,
  lng double precision,
  geocode_status text not null default 'pending'
    check (geocode_status in ('pending', 'ok', 'failed')),

  -- 마커 상세에 보여줄 필수 정보 (README P0-3)
  unisex boolean,                    -- 남녀공용 여부
  male_toilet_count integer,         -- 남성용 대변기 수
  male_urinal_count integer,         -- 남성용 소변기 수 (남자 화장실 수용력의 대부분)
  female_toilet_count integer,       -- 여성용 대변기 수
  open_hours text,                   -- 개방시간 (원본이 자유 서술이라 text)
  has_diaper_table boolean,          -- 기저귀 교환대
  has_disabled_toilet boolean,       -- 장애인용 화장실

  manager text,                      -- 관리기관명
  phone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 주소가 둘 다 없으면 지오코딩할 방법이 없다.
  constraint toilets_has_address
    check (road_address is not null or jibun_address is not null)
);

-- 주변 화장실 조회(6단계): lat/lng 범위 조건. 좌표가 확보된 행만 대상이라 부분 인덱스.
create index if not exists toilets_coords_idx
  on public.toilets (lat, lng)
  where geocode_status = 'ok';

-- 지오코딩 스크립트(4단계): 아직 처리 안 된 행만 골라내는 용도.
create index if not exists toilets_pending_idx
  on public.toilets (geocode_status)
  where geocode_status = 'pending';

drop trigger if exists toilets_set_updated_at on public.toilets;
create trigger toilets_set_updated_at
  before update on public.toilets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reviews — 크라우드소싱 리뷰 (청결도 별점 + 상태 태그)
-- ---------------------------------------------------------------------------

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  toilet_id uuid not null references public.toilets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  cleanliness smallint not null check (cleanliness between 1 and 5),

  -- 상태 태그: 'tissue' | 'soap' | 'bidet' | 'hot_water' | 'accessible'
  -- 값 검증은 앱에서 한다. 태그 목록이 늘어날 때 DB 마이그레이션을 하지 않으려는 것.
  tags text[] not null default '{}',

  comment text,

  -- 리뷰 신선도 표시(README P1-13)의 기준값이 된다.
  created_at timestamptz not null default now()
);

create index if not exists reviews_toilet_id_idx
  on public.reviews (toilet_id, created_at desc);

-- ---------------------------------------------------------------------------
-- review_photos — 리뷰 사진 (Supabase Storage 경로만 저장)
-- ---------------------------------------------------------------------------

create table if not exists public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,

  -- 'review-photos' 버킷 안의 경로. 파일 자체는 Storage 에 있다.
  storage_path text not null,

  created_at timestamptz not null default now()
);

create index if not exists review_photos_review_id_idx
  on public.review_photos (review_id);

-- ---------------------------------------------------------------------------
-- RLS — 읽기는 전부 공개, 쓰기는 로그인 사용자 본인 것만
--
-- 주의: service_role 키는 RLS 를 우회한다. 데이터 적재/지오코딩 스크립트가
--       toilets 에 쓸 수 있는 이유가 이것이고, 그래서 그 키는 서버·Vercel 에
--       올리지 않고 로컬 .env.local 에만 둔다.
-- ---------------------------------------------------------------------------

alter table public.toilets enable row level security;
alter table public.reviews enable row level security;
alter table public.review_photos enable row level security;

-- toilets: 누구나 읽기만. 쓰기 정책은 없다(= 스크립트의 service_role 만 쓸 수 있음).
drop policy if exists "toilets 읽기는 누구나" on public.toilets;
create policy "toilets 읽기는 누구나"
  on public.toilets for select
  using (true);

-- reviews
drop policy if exists "reviews 읽기는 누구나" on public.reviews;
create policy "reviews 읽기는 누구나"
  on public.reviews for select
  using (true);

drop policy if exists "reviews 작성은 로그인 사용자 본인 명의로만" on public.reviews;
create policy "reviews 작성은 로그인 사용자 본인 명의로만"
  on public.reviews for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- UPDATE 정책은 의도적으로 두지 않는다.
-- 리뷰를 수정할 수 있으면 created_at 이 "최종 확인 시점"을 잘못 나타내게 된다.
-- P0 에서는 삭제 후 재작성으로 처리하고, 그래야 신선도 표시가 항상 정확하다.
drop policy if exists "reviews 수정은 본인 것만" on public.reviews;

drop policy if exists "reviews 삭제는 본인 것만" on public.reviews;
create policy "reviews 삭제는 본인 것만"
  on public.reviews for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- review_photos: 소유권은 부모 리뷰를 따라간다.
drop policy if exists "review_photos 읽기는 누구나" on public.review_photos;
create policy "review_photos 읽기는 누구나"
  on public.review_photos for select
  using (true);

drop policy if exists "review_photos 등록은 본인 리뷰에만" on public.review_photos;
create policy "review_photos 등록은 본인 리뷰에만"
  on public.review_photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and r.user_id = (select auth.uid())
    )
  );

drop policy if exists "review_photos 삭제는 본인 리뷰만" on public.review_photos;
create policy "review_photos 삭제는 본인 리뷰만"
  on public.review_photos for delete
  to authenticated
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and r.user_id = (select auth.uid())
    )
  );
