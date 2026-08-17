/**
 * toilets 테이블의 행 구조와 1:1로 맞춘 타입.
 *
 * 필드명을 snake_case 로 두는 이유: Supabase 는 컬럼명을 그대로 돌려준다.
 * 여기서 camelCase 로 바꿔두면 나중에 실제 쿼리로 교체할 때 변환 계층이
 * 하나 더 필요해진다. 스키마는 supabase/migrations/0001_init.sql 참고.
 */

export type ToiletSource = "public" | "user";
export type GeocodeStatus = "pending" | "ok" | "failed";

/**
 * 남자용 / 여자용 / 남녀공용. 0005_gender.sql 의 check 와 같은 값이다.
 *
 * `unisex` 로는 "공용이냐"까지만 말할 수 있어서 따로 둔다. 캠퍼스 실내
 * 화장실은 같은 층에 남/여가 따로 있어 이 구분이 없으면 두 행을 구별할 수 없다.
 */
export type Gender = "male" | "female" | "all";

const GENDER_LABELS: Record<Gender, string> = {
  male: "남자",
  female: "여자",
  all: "남녀공용",
};

/** 모르면 null 을 돌려준다 — 화면이 아무것도 안 그리게 하기 위해서다. */
export function genderLabel(gender: Gender | null): string | null {
  return gender === null ? null : GENDER_LABELS[gender];
}

export type Toilet = {
  id: string;
  source: ToiletSource;
  external_id: string | null;
  name: string;
  /**
   * 건물·층. 공공데이터는 이 정보를 안 주므로 **수집된 행은 전부 null 이다.**
   * 사용자 제보와 캠퍼스 시드에만 찬다 — 같은 좌표에 쌓인 행들을 목록에서
   * 구분하는 유일한 단서다(0004_building_floor.sql).
   */
  building: string | null;
  floor: string | null;
  /**
   * 남/여 구분. 건물·층과 같은 자리의 정보다 — 같은 좌표·같은 층에 두 행이
   * 있을 때 이것만이 둘을 가른다(0005_gender.sql). 공공데이터는 안 주므로
   * 수집된 행은 전부 null 이다.
   */
  gender: Gender | null;
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
