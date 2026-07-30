/**
 * toilets 테이블의 행 구조와 1:1로 맞춘 타입.
 *
 * 필드명을 snake_case 로 두는 이유: Supabase 는 컬럼명을 그대로 돌려준다.
 * 여기서 camelCase 로 바꿔두면 나중에 실제 쿼리로 교체할 때 변환 계층이
 * 하나 더 필요해진다. 스키마는 supabase/migrations/0001_init.sql 참고.
 */

export type ToiletSource = "public" | "user";
export type GeocodeStatus = "pending" | "ok" | "failed";

export type Toilet = {
  id: string;
  source: ToiletSource;
  external_id: string | null;
  name: string;
  road_address: string | null;
  jibun_address: string | null;
  /** 공공데이터가 좌표를 주지 않으므로 지오코딩 전에는 null 이다. */
  lat: number | null;
  lng: number | null;
  geocode_status: GeocodeStatus;
  unisex: boolean | null;
  male_toilet_count: number | null;
  male_urinal_count: number | null;
  female_toilet_count: number | null;
  open_hours: string | null;
  has_diaper_table: boolean | null;
  has_disabled_toilet: boolean | null;
  manager: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

/** 좌표가 확보돼 지도에 그릴 수 있는 화장실. */
export type MappableToilet = Toilet & { lat: number; lng: number };

/**
 * 지도에 그릴 수 있는지 판별한다.
 * DB 의 `geocode_status = 'ok'` 조건과 같은 역할이고, 마커를 만들 때마다
 * null 검사를 반복하지 않기 위해 타입 가드로 둔다.
 */
export function isMappable(toilet: Toilet): toilet is MappableToilet {
  return toilet.lat !== null && toilet.lng !== null;
}
