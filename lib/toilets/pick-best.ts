/**
 * 「바로 안내」가 고르는 화장실.
 *
 * 급한 사람은 마커를 하나씩 눌러 보고 다닐 여유가 없다. 버튼 하나로 갈 곳이
 * 정해져야 한다. 그런데 "가장 가까운 곳"만으로는 부족하다 — 20m 더 가까운
 * 대신 아무도 다시 안 가는 화장실이면 소용이 없다.
 *
 * **거리순 상위 다섯 중 평점이 가장 높은 곳.** 거리가 먼저 자르고 청결도가
 * 그 안에서 고른다. 5는 "몇 걸음 차이로 서로 대체할 만한" 범위다. 이보다 넓게
 * 잡으면 800m 를 더 걷게 만들 수 있고, 좁게 잡으면 청결도가 개입할 자리가
 * 없어진다.
 *
 * 리뷰가 아직 거의 없어서 지금은 사실상 최근접으로 동작한다. 그래서 왜 이 곳을
 * 골랐는지를 화면이 말해야 한다(`reason`) — 리뷰가 쌓이면 같은 자리에서 결과만
 * 바뀐다.
 */

import { straightLineDistance } from "@/lib/geo/distance";

import { NEARBY_RADIUS_M } from "./nearby";
import type { MappableToilet } from "./types";

/** 청결도로 고를 후보 수. */
export const GUIDE_CANDIDATE_COUNT = 5;

export type GuideCandidate = {
  toilet: MappableToilet;
  distanceMeters: number;
};

export type GuidePick = GuideCandidate & {
  /**
   * 왜 이 곳인지. 화면 문구를 가른다.
   *
   * `nearest` 는 후보 중 평점이 붙은 곳이 하나도 없었다는 뜻이다. 실패가 아니라
   * "아직 아무도 평가하지 않았다"이므로 안내는 그대로 한다.
   */
  reason: "cleanest" | "nearest";
};

/**
 * 반경 안에서 가까운 순으로 후보를 뽑는다.
 *
 * 반경은 앱바의 "1km 이내"와 같은 값을 쓴다. 화면이 "1km 이내 5곳"이라 말해
 * 놓고 버튼이 3km 밖으로 보내면 두 숫자가 서로를 부정한다.
 *
 * 별점 조회가 뒤따라야 하므로 고르는 일과 나눠 두었다 — 후보가 정해져야 어떤
 * id 의 리뷰를 받을지 알 수 있다.
 */
export function nearbyCandidates(
  toilets: MappableToilet[],
  origin: { lat: number; lng: number },
): GuideCandidate[] {
  return toilets
    .map((toilet) => ({
      toilet,
      distanceMeters: straightLineDistance(origin, toilet),
    }))
    .filter((it) => it.distanceMeters <= NEARBY_RADIUS_M)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, GUIDE_CANDIDATE_COUNT);
}

/**
 * 후보 중 하나를 고른다. 후보가 없으면 null 이고, 화면은 "1km 이내에 없어요"로
 * 답해야 한다.
 *
 * @param ratings toilet_id → 평균 별점. **리뷰가 없는 곳은 들어 있지 않다.**
 *   0 으로 채워 넣으면 평가가 없는 곳이 "가장 나쁜 곳"으로 밀린다.
 */
export function pickBest(
  candidates: GuideCandidate[],
  ratings: Map<string, number>,
): GuidePick | null {
  if (candidates.length === 0) return null;

  let best: GuideCandidate | null = null;
  let bestRating = -Infinity;

  for (const candidate of candidates) {
    const rating = ratings.get(candidate.toilet.id);
    // 부등호가 > 라서 점수가 같으면 앞선 것이 남는다. 후보가 거리순이므로
    // 동점일 때는 자연히 더 가까운 쪽이 된다.
    if (rating !== undefined && rating > bestRating) {
      best = candidate;
      bestRating = rating;
    }
  }

  return best
    ? { ...best, reason: "cleanest" }
    : { ...candidates[0], reason: "nearest" };
}
