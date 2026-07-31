import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 브라우저에서 쓰는 Supabase 클라이언트.
 *
 * anon 키를 클라이언트에 노출해도 되는 이유는 RLS 때문이다. toilets 는
 * "읽기는 누구나" 정책만 있고 쓰기 정책이 없어서, 이 키로는 조회만 된다.
 * 적재·지오코딩 스크립트가 쓰는 service_role 키는 RLS 를 우회하므로
 * 절대 클라이언트로 내려보내지 않는다. supabase/migrations/0001_init.sql 참고.
 */

let client: SupabaseClient | null = null;

/**
 * 모듈을 불러오는 시점이 아니라 실제로 쓸 때 만든다.
 * 환경변수가 없을 때 앱 전체가 흰 화면으로 죽는 대신, 호출한 쪽에서
 * 에러를 받아 화면에 안내를 띄울 수 있게 하려는 것.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다.",
    );
  }

  client = createClient(url, anonKey);
  return client;
}
