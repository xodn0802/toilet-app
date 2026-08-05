/**
 * 리뷰를 쓸 수 있는 상태인지.
 *
 * 익명 신원은 브라우저 데이터를 지우면 새로 만들 수 있어서, 신원만으로는 남용이
 * 안 막힌다. 실제로 막는 것은 규칙 둘이다.
 *
 * 1. **한 화장실에 하나** — DB 의 reviews_one_per_user_idx 가 강제한다.
 * 2. **가 본 사람만** — 여기서 거리로 판정한다.
 *
 * 2번은 위치정보를 **신원이 아니라 자격**으로 쓰는 자리다. 위치로 사람을
 * 식별하려 들면(IP·좌표로 계정을 만들면) 같은 통신망을 쓰는 사람이 한 사람으로
 * 묶이고, 이동하면 같은 사람이 다른 사람이 된다. 자격 판정에는 그런 문제가 없다.
 */

import { straightLineDistance } from "@/lib/geo/distance";
import { formatDistance } from "@/lib/route/types";
import type { MappableToilet } from "@/lib/toilets/types";

import type { Review } from "./types";

/** 리뷰를 쓰려면 이만큼 안에 있어야 한다(m). 걸어서 3분 거리. */
export const REVIEW_RADIUS_M = 200;

export type ReviewGate =
  | { kind: "ok" }
  /** 리뷰 목록을 아직 못 읽어 중복인지 알 수 없다. */
  | { kind: "loading" }
  | { kind: "already" }
  | { kind: "far"; meters: number };

/**
 * @param origin 현재 위치. **믿을 수 있을 때만** 넘긴다(ToiletMap 의 anchored).
 *   null 이면 거리를 따지지 않고 통과시킨다 — summarizeNearby 와 같은 원칙이다.
 *   기준점을 못 믿으면 반경을 주장하지 않는다. 데스크톱은 브라우저가 주는 좌표가
 *   km 단위로 틀리는 일이 흔해서, 여기서 막으면 리뷰 기능이 통째로 죽는다.
 * @param reviews 그 화장실의 리뷰. 아직 조회 중이면 undefined.
 * @param userId 이 브라우저의 신원. 아직 발급 전이면 null(= 쓴 적이 없다).
 */
export function reviewGate({
  origin,
  toilet,
  reviews,
  userId,
}: {
  origin: { lat: number; lng: number } | null;
  toilet: MappableToilet;
  reviews: Review[] | undefined;
  userId: string | null;
}): ReviewGate {
  if (reviews === undefined) return { kind: "loading" };

  if (userId && reviews.some((review) => review.user_id === userId)) {
    return { kind: "already" };
  }

  if (origin) {
    const meters = straightLineDistance(origin, toilet);
    if (meters > REVIEW_RADIUS_M) return { kind: "far", meters };
  }

  return { kind: "ok" };
}

/**
 * 제출 버튼에 적을 말. 왜 못 쓰는지를 버튼 자리에서 바로 알려준다.
 *
 * null 이면 쓸 수 있는 상태라, 버튼 문구는 폼이 정한다(별점을 골랐는지에 따라
 * 달라지는데 그건 여기서 알 바가 아니다).
 */
export function gateLabel(gate: ReviewGate): string | null {
  switch (gate.kind) {
    case "ok":
      return null;
    case "loading":
      return "불러오는 중…";
    case "already":
      return "이미 리뷰를 남기셨어요";
    case "far":
      return `가까이 가야 쓸 수 있어요 · ${formatDistance(gate.meters)} 떨어짐`;
  }
}
