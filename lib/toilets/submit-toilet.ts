import { getSupabaseClient } from "@/lib/supabase/client";

import { remember } from "./my-submissions";
import type { SubmissionDraft } from "./submission";

/**
 * 제보를 검토 큐에 넣는다.
 *
 * 브라우저에서 anon 키로 직접 넣는다. toilet_submissions 의 RLS 는 INSERT 만
 * 허용하고 **SELECT 정책이 없어서** 남의 제보를 읽을 수 없다. 그래서
 * `.select()` 를 붙이면 안 된다 — supabase-js 는 `.select()` 가 없을 때만
 * `Prefer: return=minimal` 로 보내고, 붙이는 순간 읽기 권한이 없어 실패한다.
 *
 * status·reviewed_at·toilet_id 는 **넘기지 않는다.** RLS 의 with check 가
 * status='pending' 을 강제하므로 다른 값을 넣으면 거부당한다.
 *
 * 에러는 그대로 던진다. 화면이 폼을 그대로 둔 채 안내하게 하려는 것 —
 * 적은 내용이 날아가면 다시 안 쓴다.
 *
 * 성공하면 **이 브라우저가 그 사실을 기억한다**(my-submissions). 읽기 권한이
 * 없어 서버에는 다시 물어볼 수 없고, 물어볼 필요도 없다 — 방금 내가 보냈다.
 */
export async function submitToilet(draft: SubmissionDraft): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("toilet_submissions")
    .insert(draft);

  if (error) {
    throw new Error(`추가 요청을 보내지 못했습니다. (${error.message})`);
  }

  remember({ lat: draft.lat, lng: draft.lng, name: draft.name });
}
