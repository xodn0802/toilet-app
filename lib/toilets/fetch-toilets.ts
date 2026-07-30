import { MOCK_TOILETS } from "./mock-toilets";
import type { Toilet } from "./types";

/**
 * 지도에 표시할 화장실 목록을 가져온다.
 *
 * 화면 코드가 데이터 출처를 모르게 하려고 둔 함수다. 지금은 임시 데이터를
 * 그대로 돌려주고, 3·4단계로 실제 데이터가 쌓이면 이 함수 본문만 바꾼다.
 * 반환 타입이 toilets 테이블 구조와 같아서 호출부는 손대지 않아도 된다.
 *
 * 6단계에서 교체할 내용 — 지도 영역(bbox) 안의 좌표 확보된 행만 조회:
 *
 *   const { data } = await supabase
 *     .from("toilets")
 *     .select("*")
 *     .eq("geocode_status", "ok")
 *     .gte("lat", minLat).lte("lat", maxLat)
 *     .gte("lng", minLng).lte("lng", maxLng)
 *     .limit(100);
 *   return data ?? [];
 *
 * 그때 bbox 파라미터를 인자로 받고, 호출부는 지도 idle 이벤트에서 다시 부른다.
 */
export async function fetchToilets(): Promise<Toilet[]> {
  return MOCK_TOILETS;
}
