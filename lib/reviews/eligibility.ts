/**
 * 리뷰를 쓸 수 있는 상태인지.
 *
 * 익명 신원은 브라우저 데이터를 지우면 새로 만들 수 있어서, 신원만으로는 남용이
 * 안 막힌다. 실제로 막는 것은 **한 화장실에 하나** 뿐이고, 그건 DB 의
 * reviews_one_per_user_idx 가 강제한다. 여기서는 그 사실을 미리 알려줘서,
 * 사용자가 다 쓰고 나서야 거절당하는 일을 막는다.
 *
 * 예전에는 "200m 안에 있는 사람만" 이라는 규칙이 하나 더 있었다. **지웠다.**
 * 판정이 클라이언트에만 있어 위치 권한을 끄면 그대로 우회됐고, 좌표를 못 믿을
 * 때(locationCoarse)는 아예 건너뛰는 예외까지 있었다. 막지도 못하면서 지도를
 * 보다가 리뷰를 남기려는 사람만 막고 있었다.
 */

import type { Review } from "./types";

export type ReviewGate =
  | { kind: "ok" }
  /** 리뷰 목록을 아직 못 읽어 중복인지 알 수 없다. */
  | { kind: "loading" }
  | { kind: "already" };

/**
 * @param reviews 그 화장실의 리뷰. 아직 조회 중이면 undefined.
 * @param userId 이 브라우저의 신원. 아직 발급 전이면 null(= 쓴 적이 없다).
 */
export function reviewGate({
  reviews,
  userId,
}: {
  reviews: Review[] | undefined;
  userId: string | null;
}): ReviewGate {
  if (reviews === undefined) return { kind: "loading" };

  if (userId && reviews.some((review) => review.user_id === userId)) {
    return { kind: "already" };
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
  }
}
