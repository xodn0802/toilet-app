-- 0004_building_floor.sql — 건물·층
--
-- 적용 방법: Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전하다(add column if not exists).
--
-- 왜 필요한가
-- - 공공데이터의 이름·주소는 **부지 단위**다. "인하대학교" 한 줄에 캠퍼스 전체가
--   들어 있어 어느 건물의 화장실인지 알 수 없고, 같은 주소를 지오코딩하면 좌표도
--   같아진다(전국 실측 4,755그룹 13,773곳이 좌표 완전 일치 — 전체의 26.9%.
--   최다 71곳 충남대, 54곳 스타필드하남, 37곳 부경대).
-- - 캠퍼스 실내 화장실은 좌표로 구분되지 않는다. idea.md 가 "확장 시 좌표가 아니라
--   건물 → 층 구조로 모델링한다"고 적어 둔 것이 이 자리다.
-- - 그래서 **같은 좌표에 여러 행이 쌓이는 것을 고치지 않고, 그것을 읽는 UI 를
--   만든다.** 마커 하나를 누르면 목록 시트가 뜨고, 그 목록이 곧 층 목록이 된다.
--   건물·층은 그 목록에서 행을 구분하는 유일한 단서다.

-- ---------------------------------------------------------------------------
-- 컬럼
--
-- 둘 다 nullable 이고 기본값이 없다. 공공데이터에는 이 정보가 아예 없어서
-- 수집된 5만여 행은 전부 NULL 이다 — **NULL 이 정상값이다.** 화면도 값이 있을
-- 때만 그린다.
--
-- floor 를 정수가 아니라 text 로 두는 이유: "3", "B1", "지하 1층", "1~3층"이 다
-- 들어온다. 정수로 두면 지하·중층·범위를 못 담고, 사용자가 적은 그대로 보여주는
-- 편이 층수 계산보다 쓸모 있다(층수로 정렬할 일이 없다).
-- ---------------------------------------------------------------------------

alter table public.toilets
  add column if not exists building text
    check (building is null or char_length(building) between 1 and 60);

alter table public.toilets
  add column if not exists floor text
    check (floor is null or char_length(floor) between 1 and 20);

alter table public.toilet_submissions
  add column if not exists building text
    check (building is null or char_length(building) between 1 and 60);

alter table public.toilet_submissions
  add column if not exists floor text
    check (floor is null or char_length(floor) between 1 and 20);

-- RLS 는 손대지 않는다. 0002 의 insert 정책은 컬럼을 열거하지 않고 status·
-- reviewed_at·toilet_id·user_id 만 검사하므로 새 컬럼도 그대로 통과한다.

-- ---------------------------------------------------------------------------
-- 승인 SQL — 0002 주석의 것을 **이 파일이 대체한다**
--
-- 0002 의 쿼리는 building·floor 를 모르므로 그대로 쓰면 제보의 건물·층이 조용히
-- 버려진다. 앞으로는 아래를 쓸 것.
--
-- ⚠️ toilets_has_address check 때문에 **주소가 둘 다 NULL 이면 실패한다(23514).**
--    역지오코딩이 안 된 제보가 여기 해당한다 — 주소를 채워 넣고 다시 실행할 것.
--
-- ⚠️ 휴지·비누는 여전히 옮겨지지 않는다. toilets 에 컬럼이 없다. "오늘 있고
--    내일 없는" 정보라 reviews.tags 의 몫이다(0002 주석 참고).
-- ---------------------------------------------------------------------------

-- 대기 목록 보기
--
--   select id, name, building, floor, road_address, jibun_address, access,
--          open_hours, unisex, facilities, note, created_at
--     from public.toilet_submissions
--    where status = 'pending'
--    order by created_at;

-- 승인 — 제보 한 건을 toilets 로 옮긴다. 좌표를 직접 받았으므로 지오코딩은 없다.
--
--   with s as (
--     select * from public.toilet_submissions where id = '<제보 id>'
--   ), ins as (
--     insert into public.toilets
--       (source, name, building, floor, road_address, jibun_address, lat, lng,
--        geocode_status, access, open_hours, unisex,
--        has_diaper_table, has_disabled_toilet)
--     select 'user', s.name, s.building, s.floor, s.road_address, s.jibun_address,
--            s.lat, s.lng, 'ok', s.access, s.open_hours, s.unisex,
--            'diaper' = any(s.facilities), 'accessible' = any(s.facilities)
--       from s
--     returning id
--   )
--   update public.toilet_submissions
--      set status = 'approved', reviewed_at = now(),
--          toilet_id = (select id from ins)
--    where id = '<제보 id>';

-- 반려는 0002 의 것 그대로다.
