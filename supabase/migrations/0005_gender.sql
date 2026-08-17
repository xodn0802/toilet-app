-- 0005_gender.sql — 남/여 구분
--
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전하다(add column if not exists).
--
-- 왜 필요한가
-- - `unisex` 는 **"공용이냐"만 답한다.** 공용이 아니라는 것까지는 말해도 그것이
--   남자용인지 여자용인지는 못 말한다. 공공데이터는 한 건물의 화장실을 한 줄로
--   묶어 놓아서 그 구분이 필요 없었지만, **캠퍼스 실내 화장실은 같은 층에 남/여가
--   따로 있다.** "정석학술정보관 지하 1층 남자"를 지금 스키마로는 표현할 수 없다.
-- - `seed-campus.ts` 의 `external_id` 가 `inha-{건물}-{층}` 이라 같은 층의 남/여를
--   넣으면 **upsert 가 서로를 덮어쓴다.** 그래서 이 컬럼과 함께 그 규칙에도
--   성별이 들어간다(`inha-{건물}-{층}-{성별}`).

-- ---------------------------------------------------------------------------
-- 컬럼
--
-- NULL 이 정상값이다. 공공데이터로 수집한 5만여 행은 전부 NULL 이고, 화면은 값이
-- 있을 때만 그린다 — building·floor(0004) 와 같은 규칙이다.
--
-- 값이 셋뿐이라 text + check 로 둔다. enum 을 쓰면 값을 하나 더할 때 타입 변경이
-- 필요한데, 이 목록이 늘어날 일은 없다.
-- ---------------------------------------------------------------------------

alter table public.toilets
  add column if not exists gender text
    check (gender is null or gender in ('male', 'female', 'all'));

alter table public.toilet_submissions
  add column if not exists gender text
    check (gender is null or gender in ('male', 'female', 'all'));

-- RLS 는 손대지 않는다. 0002 의 insert 정책은 컬럼을 열거하지 않고 status·
-- reviewed_at·toilet_id·user_id 만 검사하므로 새 컬럼도 그대로 통과한다.

-- ---------------------------------------------------------------------------
-- unisex 는 지우지 않고 gender 에서 파생시킨다
--
--   unisex = (gender is null) ? null : (gender = 'all')
--
-- 두 컬럼이 서로 다른 말을 하는 사태를 **입력 지점 하나에서** 막는다. 폼은
-- 성별만 묻고 unisex 를 계산해 함께 보낸다(components/AddToiletForm.tsx).
--
-- unisex 를 없애지 않는 이유: 공공데이터 5만 행이 그 값을 갖고 있고 시설 정보
-- 표시가 이미 그걸 읽는다. gender 는 제보·시드에만 차므로 그 자리를 대신할 수
-- 없다. 화면은 gender 가 있으면 그것을, 없으면 unisex 를 보여준다.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 승인 SQL — 0004 주석의 것을 **이 파일이 대체한다**
--
-- ⚠️ toilets_has_address check 때문에 **주소가 둘 다 NULL 이면 실패한다(23514).**
--    역지오코딩이 안 된 제보가 여기 해당한다 — 주소를 채워 넣고 다시 실행할 것.
--
-- ⚠️ 휴지·비누는 여전히 옮겨지지 않는다. toilets 에 컬럼이 없다. "오늘 있고
--    내일 없는" 정보라 reviews.tags 의 몫이다(0002 주석 참고).
-- ---------------------------------------------------------------------------

-- 대기 목록 보기
--
--   select id, name, building, floor, gender, road_address, jibun_address,
--          access, open_hours, unisex, facilities, note, created_at
--     from public.toilet_submissions
--    where status = 'pending'
--    order by created_at;

-- 승인 — 제보 한 건을 toilets 로 옮긴다. 좌표를 직접 받았으므로 지오코딩은 없다.
--
--   with s as (
--     select * from public.toilet_submissions where id = '<제보 id>'
--   ), ins as (
--     insert into public.toilets
--       (source, name, building, floor, gender, road_address, jibun_address,
--        lat, lng, geocode_status, access, open_hours, unisex,
--        has_diaper_table, has_disabled_toilet)
--     select 'user', s.name, s.building, s.floor, s.gender,
--            s.road_address, s.jibun_address, s.lat, s.lng, 'ok',
--            s.access, s.open_hours, s.unisex,
--            'diaper' = any(s.facilities), 'accessible' = any(s.facilities)
--       from s
--     returning id
--   )
--   update public.toilet_submissions
--      set status = 'approved', reviewed_at = now(),
--          toilet_id = (select id from ins)
--    where id = '<제보 id>';

-- 반려는 0002 의 것 그대로다.
