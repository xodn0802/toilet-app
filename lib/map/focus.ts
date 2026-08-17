/**
 * 지도를 특정 좌표에서 열어 주는 링크 — `?lat=&lng=&level=`.
 *
 * **`?campus=inha` 같은 이름 링크로 안 만들었다.** 좌표 링크는 어디에나 쓸 수
 * 있어서 P1 12번(위치 링크 공유)이 그대로 가져다 쓴다. 학교 이름을 주소에
 * 새기면 학교가 늘 때마다 코드에 이름을 하나씩 더해야 하고, 그 목록을 들고
 * 있는 곳이 또 하나 생긴다.
 */

export type MapFocus = {
  lat: number;
  lng: number;
  /** null 이면 지도가 쓰던 기본 축척을 그대로 쓴다. */
  level: number | null;
};

/** 카카오 축척의 실제 범위. 밖의 값은 SDK 가 조용히 무시한다. */
const MIN_LEVEL = 1;
const MAX_LEVEL = 14;

type Param = string | string[] | undefined;

function num(value: Param): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 주소의 쿼리에서 좌표를 읽는다.
 *
 * 둘 중 하나라도 이상하면 **통째로 null** 이다. 반쪽짜리 좌표로 엉뚱한 바다를
 * 열어 주느니 평소대로(내 위치에서) 여는 편이 낫다. 축척만 이상한 경우는
 * 좌표를 살리고 축척만 버린다 — 어디를 보여줄지는 이미 알고 있으니까.
 */
export function parseFocus(params: {
  lat: Param;
  lng: Param;
  level: Param;
}): MapFocus | null {
  const lat = num(params.lat);
  const lng = num(params.lng);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const level = num(params.level);
  const usable = level !== null && level >= MIN_LEVEL && level <= MAX_LEVEL;

  return { lat, lng, level: usable ? Math.round(level) : null };
}
