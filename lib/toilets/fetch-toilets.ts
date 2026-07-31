import { getSupabaseClient } from "@/lib/supabase/client";

import type { Toilet } from "./types";

/** 한 번에 그릴 마커 수 상한. 지금은 6건뿐이지만 적재 후 폭주를 막는 안전장치다. */
const MAX_ROWS = 100;

/**
 * 지도에 표시할 화장실 목록을 가져온다.
 *
 * 화면 코드가 데이터 출처를 모르게 하려고 둔 함수다. 조회는 브라우저에서
 * anon 키로 직접 한다. toilets 는 RLS 가 "읽기는 누구나"라 서버를 거칠 이유가 없다.
 *
 * 좌표가 없는 행은 마커를 찍을 수 없으므로 geocode_status='ok' 만 가져온다.
 * 이 조건은 toilets_coords_idx 부분 인덱스와 같은 기준이다.
 *
 * 6단계에서 할 일 — 지금은 전체를 가져오지만, 공공데이터가 적재되면 지도
 * 영역(bbox) 안의 행만 조회하도록 인자를 받는다. .gte("lat", minLat)
 * .lte("lat", maxLat) 형태의 조건이 붙고, 호출부는 지도 idle 이벤트에서 다시 부른다.
 */
export async function fetchToilets(): Promise<Toilet[]> {
  const { data, error } = await getSupabaseClient()
    .from("toilets")
    .select("*")
    .eq("geocode_status", "ok")
    .limit(MAX_ROWS);

  if (error) {
    throw new Error(`화장실 목록을 불러오지 못했습니다. (${error.message})`);
  }

  return (data ?? []) as Toilet[];
}
