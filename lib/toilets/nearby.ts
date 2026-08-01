/**
 * "주변 N곳"의 근거.
 *
 * 앱바가 세던 숫자는 원래 조회해 온 전부였다. 지도를 아무리 옮겨도 안 변하는
 * 숫자를 "주변"이라 부르면 사용자는 기준을 알 수 없다. 여기서 반경을 정하고,
 * 그 반경을 문구에 같이 적는다.
 *
 * 문구와 마커가 한 번의 계산을 나눠 쓰도록 둘을 함께 돌려준다. 각자 계산하면
 * "3곳이라 써 놓고 진한 핀은 4개"처럼 어긋날 수 있다.
 */

import { straightLineDistance } from "@/lib/geo/distance";
// 거리 표기는 경로 배너가 쓰던 것과 같아야 한다. "1.4km" 를 두 가지로 적을 이유가 없다.
import { formatDistance } from "@/lib/route/types";

import type { MappableToilet } from "./types";

/** "주변"이라고 부를 반경(m). 도보 15분 안쪽이다. */
export const NEARBY_RADIUS_M = 1000;

/** 문구에 쓰는 반경 표기. 상수에서 끌어내 둘이 어긋나지 않게 한다. */
const RADIUS_LABEL = `${NEARBY_RADIUS_M / 1000}km`;

export type NearbySummary =
  /** 기준점이 없거나 못 믿는 상태. 반경을 주장하지 않고 개수만 말한다. */
  | { kind: "unanchored"; total: number }
  | { kind: "within"; count: number }
  /** 반경 안에 없을 때. 가장 가까운 곳까지의 거리로 막다른 길을 면한다. */
  | { kind: "none"; nearestMeters: number | null };

export type NearbyResult = {
  summary: NearbySummary;
  /** 반경 안이라 진하게 그릴 화장실. 기준점이 없으면 전부 진하므로 null. */
  nearIds: Set<string> | null;
};

/**
 * @param origin 현재 위치. **믿을 수 있을 때만** 넘긴다. 위치를 못 받았거나
 *   오차가 커서 좌표를 단정할 수 없으면 null 을 넘겨야 한다 — 그런 좌표로 잰
 *   "1km 이내"는 사용자와 무관한 숫자다.
 */
export function summarizeNearby(
  toilets: MappableToilet[],
  origin: { lat: number; lng: number } | null,
): NearbyResult {
  if (!origin) {
    return {
      summary: { kind: "unanchored", total: toilets.length },
      nearIds: null,
    };
  }

  const nearIds = new Set<string>();
  let nearestMeters: number | null = null;

  for (const toilet of toilets) {
    const meters = straightLineDistance(origin, toilet);
    if (meters <= NEARBY_RADIUS_M) nearIds.add(toilet.id);
    if (nearestMeters === null || meters < nearestMeters)
      nearestMeters = meters;
  }

  return {
    summary:
      nearIds.size > 0
        ? { kind: "within", count: nearIds.size }
        : { kind: "none", nearestMeters },
    nearIds,
  };
}

export function nearbyLabel(summary: NearbySummary): string {
  switch (summary.kind) {
    case "unanchored":
      return summary.total === 0
        ? "등록된 곳 없음"
        : `화장실 ${summary.total}곳`;
    case "within":
      return `${RADIUS_LABEL} 이내 ${summary.count}곳`;
    case "none":
      // 거리가 null 이면 반경 밖에도 아무것도 없다는 뜻이라 반경을 말할 이유가 없다.
      return summary.nearestMeters === null
        ? "등록된 곳 없음"
        : `${RADIUS_LABEL} 이내 없음 · 가까운 곳 ${formatDistance(summary.nearestMeters)}`;
  }
}
