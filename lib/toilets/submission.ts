/**
 * 사용자 화장실 제보의 값 목록과 타입.
 *
 * toilet_submissions 테이블(supabase/migrations/0002_toilet_submissions.sql)에
 * 필드명을 맞춰 두었다. 그대로 insert 하는 모양이라 snake_case 다.
 */

import type { Gender } from "./types";

export type AccessType = "free" | "open" | "purchase" | "paid";

/**
 * 성별은 4단이다 — 남자 / 여자 / 공용 / 모름. 모름이 null 이다.
 *
 * 3단(예/아니오/모름)이던 남녀공용 칩을 이걸로 갈아치웠다. "아니오"는 공용이
 * 아니라는 것까지만 말해서, 정작 남자용인지 여자용인지는 못 담았다.
 */
export const GENDER_OPTIONS: { value: Gender | null; label: string }[] = [
  { value: "male", label: "남자" },
  { value: "female", label: "여자" },
  { value: "all", label: "공용" },
  { value: null, label: "모름" },
];

/**
 * unisex 를 gender 에서 만든다. **두 값이 어긋날 자리를 없애는 것이 목적이다.**
 *
 * 화면이 둘을 따로 묻지 않고, 시설 정보 표시는 여전히 unisex 를 읽는다
 * (공공데이터 5만 행에는 gender 가 없다). 0005_gender.sql 주석 참고.
 */
export function unisexFromGender(gender: Gender | null): boolean | null {
  return gender === null ? null : gender === "all";
}

/** 이용조건. README P1-9 의 태그와 같은 값이지만 필터는 아직 안 만든다. */
export const ACCESS_OPTIONS: { value: AccessType; label: string }[] = [
  { value: "free", label: "무료" },
  { value: "open", label: "개방" },
  { value: "purchase", label: "음료구매" },
  { value: "paid", label: "유료" },
];

export type Facility = "tissue" | "soap" | "accessible" | "diaper";

/**
 * 편의시설. `REVIEW_TAGS` 와 값이 겹치지만 **재사용하지 않는다.**
 *
 * 리뷰 태그는 "지금 가 보니 이랬다"(신선도가 붙는 정보)이고, 여기는 "이 화장실의
 * 사양"이다. 뜻이 다르니 한쪽을 고칠 때 다른 쪽이 딸려 가면 안 된다.
 *
 * DB 의 facilities 는 text[] 라 값 검증을 하지 않는다 — 이 배열이 유효한 값의
 * 유일한 정의다.
 */
export const FACILITY_OPTIONS: { value: Facility; label: string }[] = [
  { value: "tissue", label: "휴지" },
  { value: "soap", label: "비누" },
  { value: "accessible", label: "장애인" },
  { value: "diaper", label: "기저귀교환대" },
];

/** 스키마의 char_length check 와 같은 값. 넘으면 DB 가 거부한다. */
export const MAX_NAME_LENGTH = 60;
export const MAX_OPEN_HOURS_LENGTH = 40;
export const MAX_NOTE_LENGTH = 300;
export const MAX_BUILDING_LENGTH = 60;
export const MAX_FLOOR_LENGTH = 20;

/**
 * 폼이 만들어 넘기는 값. id·status·검토 컬럼은 DB 기본값과 RLS 가 채운다.
 *
 * 필수는 이름과 좌표뿐이다. 나머지가 비어도 보낼 수 있어야 한다 — 폼이 길수록
 * 중간에 포기하고, 반쯤 채운 제보라도 없는 것보다 낫다.
 */
export type SubmissionDraft = {
  name: string;
  /**
   * 건물·층. 실내 화장실은 좌표로 구분되지 않아서 이 둘이 유일한 단서다
   * (0004_building_floor.sql). 캠퍼스 건물처럼 같은 좌표에 층별로 여러 개가
   * 붙는 경우를 위해 받는다 — 안 적어도 접수된다.
   */
  building: string | null;
  floor: string | null;
  /** 남자/여자/공용/모름. 모름이 null 이다(0005_gender.sql). */
  gender: Gender | null;
  lat: number;
  lng: number;
  /** 역지오코딩 결과. 못 읽었으면 null 이고, 그래도 접수는 된다. */
  road_address: string | null;
  jibun_address: string | null;
  access: AccessType | null;
  open_hours: string | null;
  /** 폼이 묻지 않는다 — `unisexFromGender` 가 gender 에서 만든다. */
  unisex: boolean | null;
  facilities: Facility[];
  note: string | null;
};
