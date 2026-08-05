import { getSupabaseClient } from "@/lib/supabase/client";

import type { Review, ReviewDraft } from "./types";

/** unique_violation. reviews_one_per_user_idx 에 걸렸다는 뜻. */
const UNIQUE_VIOLATION = "23505";

export type ReviewInput = ReviewDraft & {
  toilet_id: string;
  user_id: string;
  nickname: string;
};

/**
 * 리뷰를 저장하고 저장된 행을 그대로 돌려준다.
 *
 * toilet_submissions 와 달리 **`.select()` 를 붙인다.** 저쪽은 SELECT 정책이
 * 없어서 붙이면 실패하지만, reviews 는 읽기가 공개라 된다. 돌려받은 행을 그대로
 * 목록에 넣으면 id·created_at 이 서버가 정한 진짜 값이라, 화면과 DB 가 어긋나지
 * 않는다(직접 지어내면 새로고침하는 순간 다른 값으로 바뀐다).
 *
 * user_id 를 클라이언트가 넣지만 위조할 수 없다. RLS 의
 * `with check (user_id = auth.uid())` 가 자기 것이 아닌 값을 거부한다.
 */
export async function submitReview(input: ReviewInput): Promise<Review> {
  const { data, error } = await getSupabaseClient()
    .from("reviews")
    .insert(input)
    .select()
    .single();

  if (error) {
    // 남용 방지 규칙에 걸린 것은 "실패"가 아니라 "이미 했다"이다. 원인을 그대로
    // 보여주면 사용자가 무슨 일인지 알 수 없다.
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error("이 화장실에는 이미 리뷰를 남기셨어요.");
    }
    throw new Error(`리뷰를 저장하지 못했습니다. (${error.message})`);
  }

  return data as Review;
}
