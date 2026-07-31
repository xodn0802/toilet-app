-- dev-toilets.sql — 개발용 표본 화장실 6건
--
-- ⚠️ 실제 화장실 정보가 아닙니다.
-- 공공데이터포털 점검(~2026-08-02)으로 API 키를 받기 전, 지도·마커·상세·길찾기를
-- 만들기 위해 인하대 주변 좌표로 지어낸 값이다. 좌표는 대략적인 위치이고
-- 편의시설·개방시간은 확인한 값이 아니다.
--
-- 적용: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run.
--
-- 이 파일은 스키마가 아니라 임시 데이터라서 migrations/ 가 아닌 seed/ 에 둔다.
-- 3단계(공공데이터 적재)가 끝나면 아래 "되돌리기"를 실행하고 이 파일을 지운다.
--
-- 되돌리기:
--   delete from public.toilets where external_id like 'seed-%';
--
-- 설계 메모
-- - id 는 넣지 않는다. uuid 기본값(gen_random_uuid)이 만들어 준다.
-- - 대신 external_id 에 'seed-000n' 을 준다. unique 제약이 걸려 있어
--   on conflict 로 upsert 가 되고, 여러 번 실행해도 행이 늘지 않는다.
-- - geocode_status 는 'ok'. 좌표를 직접 넣었으므로 지오코딩 대상이 아니다.

insert into public.toilets (
  external_id, source, name, road_address,
  lat, lng, geocode_status,
  unisex, male_toilet_count, male_urinal_count, female_toilet_count,
  open_hours, has_diaper_table, has_disabled_toilet, manager
) values
  ('seed-0001', 'public', '인하대학교 학생회관 화장실', '인천 미추홀구 인하로 100',
   37.4508, 126.6541, 'ok',
   false, 3, 5, 5,
   '평일 07:00 ~ 22:00', false, true, '인하대학교'),

  ('seed-0002', 'public', '인하대역 공중화장실', '인천 미추홀구 경인로 지하 1',
   37.4419, 126.6500, 'ok',
   false, 2, 3, 4,
   '05:30 ~ 24:00 (첫차~막차)', true, true, '한국철도공사'),

  ('seed-0003', 'public', '용현시장 공영주차장 화장실', '인천 미추홀구 용현동 627',
   37.4456, 126.6553, 'ok',
   true, 1, 1, 1,
   '09:00 ~ 20:00', false, false, '미추홀구청'),

  ('seed-0004', 'public', '수봉공원 화장실', '인천 미추홀구 수봉로 8',
   37.4590, 126.6470, 'ok',
   false, 2, 4, 3,
   '24시간', false, true, '미추홀구청'),

  ('seed-0005', 'public', '인하대병원 본관 1층 화장실', '인천 미추홀구 인항로 27',
   37.4516, 126.6626, 'ok',
   false, 4, 6, 6,
   '24시간', true, true, '인하대병원'),

  ('seed-0006', 'public', '용현5동 주민센터 화장실', '인천 미추홀구 인하로 141',
   37.4470, 126.6520, 'ok',
   true, 1, 2, 2,
   '평일 09:00 ~ 18:00', false, false, '용현5동 주민센터')

on conflict (external_id) do update set
  name                = excluded.name,
  road_address        = excluded.road_address,
  lat                 = excluded.lat,
  lng                 = excluded.lng,
  geocode_status      = excluded.geocode_status,
  unisex              = excluded.unisex,
  male_toilet_count   = excluded.male_toilet_count,
  male_urinal_count   = excluded.male_urinal_count,
  female_toilet_count = excluded.female_toilet_count,
  open_hours          = excluded.open_hours,
  has_diaper_table    = excluded.has_diaper_table,
  has_disabled_toilet = excluded.has_disabled_toilet,
  manager             = excluded.manager;
