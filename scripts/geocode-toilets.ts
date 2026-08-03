/**
 * geocode-toilets.ts — 4단계: 주소 → 좌표
 *
 * geocode_status='pending' 인 행을 카카오 로컬 주소검색으로 지오코딩해
 * lat/lng 를 채우고 'ok' 로 바꾼다. 좌표를 못 얻으면 'failed' 로 둔다.
 *
 * 실행:
 *   npm run geocode
 *
 * 필요한 환경변수 (.env.local):
 *   KAKAO_REST_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 중단해도 안전하다. 'pending' 인 것만 대상이라 다시 돌리면 남은 것부터 이어진다
 * (toilets_pending_idx 부분 인덱스가 이 용도로 스키마에 있다). 'failed' 는 다시
 * 시도하지 않는다 — 주소가 그대로인 한 결과도 같기 때문이다. 재시도하려면
 * 그 행을 다시 pending 으로 돌려놓고 실행한다:
 *   update public.toilets set geocode_status='pending' where geocode_status='failed';
 */

import { createClient } from "@supabase/supabase-js";

const KAKAO_URL = "https://dapi.kakao.com/v2/local/search/address.json";

/** 한 번에 가져와 처리할 pending 행 수. */
const BATCH_SIZE = 200;

/** 동시 호출 수. 일 쿼터(10만)는 넉넉하지만 순간 폭주는 429 를 부른다. */
const CONCURRENCY = 5;

/** 429 를 받았을 때의 재시도 횟수. */
const MAX_RETRY = 3;

/**
 * 좌표로 인정할 검색 결과 유형.
 *
 * 카카오는 address_type 을 네 가지로 준다.
 *   ROAD_ADDR   도로명주소 — 건물 단위. 쓸 수 있다.
 *   REGION_ADDR 지번주소   — 필지 단위. 쓸 수 있다.
 *   ROAD        도로명     — 도로의 중심점.
 *   REGION      지역명     — 동의 중심점.
 *
 * 뒤 둘은 건물이 아니라 넓은 영역의 대표점이다. 이걸 'ok' 로 넣으면 화장실
 * 수십 개가 동사무소 앞 한 점에 겹쳐 쌓이고, 지도는 멀쩡해 보이는데 길찾기가
 * 엉뚱한 곳으로 안내한다. 틀린 좌표를 넣느니 failed 로 남겨 사람이 보게 한다.
 */
const USABLE_ADDRESS_TYPES = new Set(["ROAD_ADDR", "REGION_ADDR"]);

type PendingToilet = {
  id: string;
  name: string;
  road_address: string | null;
  jibun_address: string | null;
};

type KakaoDocument = {
  address_type?: string;
  /** 경도. 숫자가 아니라 문자열로 온다. */
  x?: string;
  /** 위도. 마찬가지로 문자열이다. */
  y?: string;
};

type GeocodeOutcome =
  | { status: "ok"; lat: number; lng: number }
  /** 실패 사유를 남긴다. 통계를 봐야 주소 형식 문제인지 판단할 수 있다. */
  | { status: "failed"; reason: "결과없음" | "대표점만" };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} 가 필요합니다. .env.local 을 확인하세요.`);
  }
  return value;
}

/**
 * 주소 하나를 좌표로. 쓸 수 있는 결과가 없으면 null.
 *
 * 여러 건이 와도 첫 번째만 본다. 카카오는 정확도 순으로 정렬해 주고, 공공데이터
 * 주소는 이미 행정 표준 주소라 동명이인 같은 모호함이 거의 없다.
 */
async function geocodeAddress(
  apiKey: string,
  address: string,
): Promise<{ lat: number; lng: number } | "대표점만" | null> {
  const params = new URLSearchParams({ query: address, size: "1" });

  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${KAKAO_URL}?${params}`, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });

    // 429 는 잠깐 쉬면 풀린다. 그 외 4xx·5xx 는 고쳐질 것이 아니라 그대로 던진다.
    if (response.status === 429 && attempt < MAX_RETRY) {
      await sleep(1000 * attempt);
      continue;
    }
    if (!response.ok) {
      throw new Error(
        `카카오 ${response.status} — ${(await response.text()).slice(0, 200)}`,
      );
    }

    const body = (await response.json()) as { documents?: KakaoDocument[] };
    const doc = body.documents?.[0];
    if (!doc) return null;

    if (!USABLE_ADDRESS_TYPES.has(doc.address_type ?? "")) return "대표점만";

    // x=경도, y=위도이고 둘 다 문자열이다. 뒤집어 쓰면 좌표가 바다로 간다.
    const lng = Number.parseFloat(doc.x ?? "");
    const lat = Number.parseFloat(doc.y ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  }
}

/**
 * 도로명주소로 먼저, 안 되면 지번주소로. 공공데이터에는 도로명이 비어 있거나
 * 옛 주소만 남은 행이 섞여 있다.
 */
async function geocodeToilet(
  apiKey: string,
  toilet: PendingToilet,
): Promise<GeocodeOutcome> {
  const candidates = [toilet.road_address, toilet.jibun_address].filter(
    (address): address is string => address !== null,
  );

  let sawRepresentativePoint = false;

  for (const address of candidates) {
    const result = await geocodeAddress(apiKey, address);
    if (result === "대표점만") {
      sawRepresentativePoint = true;
      continue;
    }
    if (result !== null) return { status: "ok", ...result };
  }

  return {
    status: "failed",
    reason: sawRepresentativePoint ? "대표점만" : "결과없음",
  };
}

/** 동시 실행 수를 제한하며 전부 처리한다. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  const apiKey = requireEnv("KAKAO_REST_API_KEY");
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const tally = { ok: 0, 결과없음: 0, 대표점만: 0 };

  for (;;) {
    // 처리한 행은 status 가 바뀌어 다음 조회에서 빠진다. 그래서 offset 이 필요 없다.
    const { data, error } = await supabase
      .from("toilets")
      .select("id, name, road_address, jibun_address")
      .eq("geocode_status", "pending")
      .limit(BATCH_SIZE);

    if (error) throw new Error(`pending 조회 실패 — ${error.message}`);

    const pending = (data ?? []) as PendingToilet[];
    if (pending.length === 0) break;

    const outcomes = await mapWithConcurrency(pending, CONCURRENCY, (toilet) =>
      geocodeToilet(apiKey, toilet),
    );

    // upsert 로 한 번에 쓴다. 개별 update 를 수천 번 보내면 그만큼 왕복이 생긴다.
    // name·주소를 함께 넣는 이유는 PostgREST 가 INSERT 문을 만들기 때문이다 —
    // not null 인 name 과 toilets_has_address 체크를 만족시켜야 conflict 까지 간다.
    const rows = pending.map((toilet, index) => {
      const outcome = outcomes[index];
      if (outcome.status === "ok") {
        tally.ok += 1;
      } else {
        tally[outcome.reason] += 1;
      }

      return {
        id: toilet.id,
        name: toilet.name,
        road_address: toilet.road_address,
        jibun_address: toilet.jibun_address,
        lat: outcome.status === "ok" ? outcome.lat : null,
        lng: outcome.status === "ok" ? outcome.lng : null,
        geocode_status: outcome.status,
      };
    });

    const { error: writeError } = await supabase
      .from("toilets")
      .upsert(rows, { onConflict: "id" });

    if (writeError) throw new Error(`저장 실패 — ${writeError.message}`);

    const done = tally.ok + tally.결과없음 + tally.대표점만;
    process.stdout.write(`\r  지오코딩… ${done}건 (성공 ${tally.ok})`);
  }

  const done = tally.ok + tally.결과없음 + tally.대표점만;
  if (done === 0) {
    console.log(
      "pending 인 행이 없습니다. 먼저 npm run collect 를 실행하세요.",
    );
    return;
  }

  console.log(
    `\n완료 ${done}건 — 성공 ${tally.ok} · 실패 ${tally.결과없음 + tally.대표점만}` +
      ` (결과없음 ${tally.결과없음} · 대표점만 ${tally.대표점만})`,
  );
}

main().catch((error: unknown) => {
  console.error(`\n실패: ${(error as Error).message}`);
  process.exit(1);
});
