import { getSupabaseClient } from "@/lib/supabase/client";

import type { Review } from "./types";

/**
 * 한 화장실의 리뷰를 최신순으로 가져온다.
 *
 * 조회는 브라우저에서 anon 키로 직접 한다 — reviews 는 RLS 가 "읽기는 누구나"라
 * 서버를 거칠 이유가 없다(fetch-toilets.ts 와 같은 이유). 정렬·조건은
 * reviews_toilet_id_idx(toilet_id, created_at desc)와 그대로 맞는다.
 *
 * 상한을 두지 않는다. 화장실 하나의 리뷰가 수백 건이 되는 상황은 아직 없고,
 * 평균 별점을 그 화장실의 **전부**로 계산해야 맞기 때문이다. 일부만 받아
 * 평균을 내면 화면마다 다른 별점이 나온다.
 */
export async function fetchReviews(toiletId: string): Promise<Review[]> {
  const { data, error } = await getSupabaseClient()
    .from("reviews")
    .select("*")
    .eq("toilet_id", toiletId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`리뷰를 불러오지 못했습니다. (${error.message})`);
  }

  return (data ?? []) as Review[];
}
