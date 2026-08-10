import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * 여러 화장실의 평균 청결도를 한 번에 가져온다.
 *
 * `fetchReviews` 와 나눠 두는 이유: 저쪽은 화장실 **하나**의 리뷰 본문까지 전부
 * 받아 상세 시트를 그린다. 여기는 목록에 별점 숫자 하나만 붙이면 되므로 별점
 * 컬럼만 받는다. 후보 5곳이든 한 좌표에 겹친 31곳이든 **왕복은 한 번**이다.
 *
 * **집계 컬럼도 DB 뷰도 만들지 않는다.** 리뷰가 몇 건 안 되는 지금 집계 인프라를
 * 먼저 세우면, 리뷰를 쓸 때마다 그 값을 갱신하는 경로까지 함께 관리해야 한다.
 * 평균은 클라이언트에서 낸다 — 리뷰가 없으면 응답이 비어 비용이 거의 0이다.
 *
 * 값이 **없는 화장실은 Map 에 아예 안 들어간다.** 0 으로 채우면 "리뷰가 없는 곳"이
 * "최악으로 평가된 곳"과 같아진다.
 */
export async function fetchRatingsFor(
  toiletIds: string[],
): Promise<Map<string, number>> {
  if (toiletIds.length === 0) return new Map();

  const { data, error } = await getSupabaseClient()
    .from("reviews")
    .select("toilet_id, cleanliness")
    .in("toilet_id", toiletIds);

  if (error) {
    throw new Error(`별점을 불러오지 못했습니다. (${error.message})`);
  }

  const sums = new Map<string, { total: number; count: number }>();
  for (const row of (data ?? []) as {
    toilet_id: string;
    cleanliness: number;
  }[]) {
    const found = sums.get(row.toilet_id);
    if (found) {
      found.total += row.cleanliness;
      found.count += 1;
    } else {
      sums.set(row.toilet_id, { total: row.cleanliness, count: 1 });
    }
  }

  const averages = new Map<string, number>();
  for (const [id, { total, count }] of sums) {
    averages.set(id, total / count);
  }
  return averages;
}
