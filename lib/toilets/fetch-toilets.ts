import { unionBounds, type Bounds } from "@/lib/geo/bounds";
import { getSupabaseClient } from "@/lib/supabase/client";

import type { Toilet } from "./types";

/**
 * 한 번에 그릴 마커 수 상한.
 *
 * 이 상한에 닿으면 조용히 잘린다 — 어떤 행이 빠졌는지 알 수 없다. 그래서
 * 상한 자체보다 **닿았다는 사실**이 중요하고, fetchToilets 가 truncated 로
 * 함께 돌려준다. 지도를 확대하면 영역이 좁아져 자연히 풀리는 문제라 조회를
 * 막지는 않는다.
 */
const MAX_ROWS = 300;

export type ToiletsPage = {
  toilets: Toilet[];
  /** 상한에 걸려 일부만 왔는지. 사용자에게 "확대해 보세요"를 안내하는 근거. */
  truncated: boolean;
};

/**
 * 사각형 안에서 좌표가 확보된 행을 가져온다.
 *
 * 조회는 브라우저에서 anon 키로 직접 한다. toilets 는 RLS 가 "읽기는 누구나"라
 * 서버를 거칠 이유가 없다. geocode_status='ok' 조건과 lat/lng 범위는
 * toilets_coords_idx 부분 인덱스와 그대로 맞는다.
 */
async function queryBounds(bounds: Bounds): Promise<Toilet[]> {
  const { data, error } = await getSupabaseClient()
    .from("toilets")
    .select("*")
    .eq("geocode_status", "ok")
    .gte("lat", bounds.minLat)
    .lte("lat", bounds.maxLat)
    .gte("lng", bounds.minLng)
    .lte("lng", bounds.maxLng)
    .limit(MAX_ROWS);

  if (error) {
    throw new Error(`화장실 목록을 불러오지 못했습니다. (${error.message})`);
  }

  return (data ?? []) as Toilet[];
}

/**
 * 지도에 그릴 화장실을 가져온다.
 *
 * 화면 코드가 데이터 출처를 모르게 하려고 둔 함수다.
 *
 * @param viewport 지도가 보고 있는 영역.
 * @param anchor 현재 위치 주변(반경 판정에 쓰는 영역). **믿을 수 있을 때만**
 *   넘긴다. 이걸 안 넘기면 지도를 옮겨 현재 위치가 화면 밖으로 나가는 순간
 *   그 주변 화장실이 목록에서 빠지고, summarizeNearby 는 받은 것만 세므로
 *   앱바가 "1km 이내 없음"이라고 거짓말한다.
 */
export async function fetchToilets(
  viewport: Bounds,
  anchor: Bounds | null,
): Promise<ToiletsPage> {
  const rows = await queryBounds(
    anchor ? unionBounds(viewport, anchor) : viewport,
  );
  const truncated = rows.length >= MAX_ROWS;

  if (!truncated || !anchor) return { toilets: rows, truncated };

  // 상한에 걸리면 **어느 행이 빠졌는지 알 수 없다.** 정렬을 주지 않았으므로
  // 기준점 주변이 통째로 잘려 나갔을 수도 있다(실측: 인천 전역까지 축소하니
  // 앱바가 "1km 이내 37곳"에서 "7곳"으로 줄었다). 합집합만으로는 못 막는다.
  //
  // 그래서 기준점 주변만 따로 온전히 받아 합친다. 그 영역은 반경 1km 라
  // 상한에 닿을 일이 사실상 없다.
  const nearRows = await queryBounds(anchor);
  const byId = new Map(rows.map((toilet) => [toilet.id, toilet]));
  for (const toilet of nearRows) byId.set(toilet.id, toilet);

  return { toilets: [...byId.values()], truncated };
}
