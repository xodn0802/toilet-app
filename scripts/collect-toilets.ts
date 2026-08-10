/**
 * collect-toilets.ts — 3단계: 공공데이터 수집
 *
 * 행정안전부_공중화장실정보 조회서비스(data.go.kr/data/15155058)에서 화장실을
 * 받아 toilets 테이블에 upsert 한다. 좌표는 넣지 않는다 — 이 API 는 2025년 2월
 * 원천데이터 정책 변경으로 WGS84 위경도 제공을 중단했다. 좌표는 4단계
 * (geocode-toilets.ts)가 주소를 지오코딩해 채운다.
 *
 * 실행:
 *   node --env-file=.env.local scripts/collect-toilets.ts          ← 전국 전량
 *   node --env-file=.env.local scripts/collect-toilets.ts 인천     ← 특정 지역만
 *
 * 필요한 환경변수 (.env.local):
 *   DATA_GO_KR_SERVICE_KEY   ← 디코딩 키. 아래 "인증키" 주석 참고.
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  ← toilets 에 쓰기 정책이 없어 RLS 우회가 필요하다.
 *
 * 인증키 — 공공데이터포털은 키를 Encoding/Decoding 두 가지로 준다. 여기서는
 * URLSearchParams 가 값을 한 번 인코딩하므로 **디코딩 키**를 넣어야 한다.
 * 인코딩 키를 넣으면 '%2B' 가 '%252B' 로 이중 인코딩돼
 * SERVICE_KEY_IS_NOT_REGISTERED_ERROR 가 난다.
 *
 * 여러 번 돌려도 안전하다. external_id 로 upsert 하고, geocode_status·lat·lng 는
 * payload 에 넣지 않아서 이미 지오코딩이 끝난 행을 pending 으로 되돌리지 않는다.
 */

import { createClient } from "@supabase/supabase-js";

const API_URL =
  "https://apis.data.go.kr/1741000/public_restroom_info_v2/info_v2";

/** 한 페이지 최대 건수. API 명세가 max 100 으로 못박고 있다. */
const PAGE_SIZE = 100;

/** upsert 를 나눠 보내는 크기. 수천 건을 한 요청에 담으면 거부된다. */
const UPSERT_CHUNK = 500;

/** 폭주 방지. 개발계정 트래픽은 일 10,000건이라 여유롭지만 순간 연타는 피한다. */
const PAGE_DELAY_MS = 120;

/** 페이지 조회 실패 시 재시도 횟수. 공공데이터 API 는 간헐적으로 502 를 준다. */
const MAX_RETRY = 3;

/**
 * 수집할 지역. **인자가 없으면 전국 전량이다.**
 *
 * 지역을 주면 소재지도로명주소에 그 문자열이 든 행만 받는다
 * (cond[LCTN_ROAD_NM_ADDR::LIKE]).
 *
 * 전국을 시도별 루프로 받지 않는 이유 (2026-08-10 실측) — 접두 일치가 새는 곳이
 * 두 군데다. ① 데이터에 **`전남광주통합특별시`** 라는 통합 개편 지명이 들어와 있어
 * "광주광역시"·"전라남도"로는 각각 0건·5건만 잡힌다(실제로는 4,973건).
 * ② `울산 울주군 …` 처럼 **시도명이 축약된 행**이 섞여 있다. 17개 시도를 다 돌아도
 * 42,195건뿐이라 **전체 53,552건 중 21%를 놓친다.**
 *
 * 그래서 전국은 조건 없이 전량을 받는다. 호출이 536회로 늘지만 버려지는 것이 없고,
 * 지역 필터 때문에 필요했던 예외 처리(isOutsideRegion)도 같이 사라진다.
 *
 * 이 파일은 원래 "전국을 받으면 대부분이 버려진다"고 적어 두고 지역 필터를 골랐다.
 * 그 판단은 인천만 쓰던 때의 것이고, 목적이 전국으로 바뀌면서 뒤집혔다.
 */
const REGION = process.argv[2] ?? null;

// ---------------------------------------------------------------------------
// API 응답 — 필드명은 swagger 명세(2026-06-05 기준)에서 확인한 것이다.
// ---------------------------------------------------------------------------

/** 값이 전부 문자열로 온다. 숫자 컬럼도 "3" 처럼 따옴표가 붙어 있다. */
type ApiItem = Record<string, string | undefined>;

type ApiResponse = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      totalCount?: number;
      items?: { item?: ApiItem[] } | ApiItem[];
    };
  };
};

/** toilets 테이블에 넣을 행. geocode_status·lat·lng 는 일부러 빠져 있다. */
type ToiletRow = {
  external_id: string;
  source: "public";
  name: string;
  road_address: string | null;
  jibun_address: string | null;
  unisex: boolean | null;
  male_toilet_count: number | null;
  male_urinal_count: number | null;
  female_toilet_count: number | null;
  open_hours: string | null;
  has_diaper_table: boolean | null;
  has_disabled_toilet: boolean | null;
  manager: string | null;
  phone: string | null;
};

// ---------------------------------------------------------------------------
// 값 변환
// ---------------------------------------------------------------------------

/** 빈 문자열·공백은 null 로. 공공데이터는 미기재를 "" 나 " " 로 준다. */
function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** "3" → 3, "" → null, "해당없음" → null. 숫자가 아닌 값을 0 으로 두지 않는다. */
function count(value: string | undefined): number | null {
  const raw = text(value);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 있음/없음/모름의 3상태. null 을 false 로 뭉개면 "정보 없음"과 "없음"이 같아지고,
 * 실제로는 있는 장애인 화장실을 없다고 말하게 된다(ToiletFacts.tsx 의 UNKNOWN).
 *
 * 표기가 제각각이라 값을 봐 가며 넓게 받는다. 못 알아본 값은 null 이다.
 */
function yesNo(value: string | undefined): boolean | null {
  const raw = text(value);
  if (raw === null) return null;
  if (/^(Y|유|있음|설치)/i.test(raw)) return true;
  if (/^(N|무|없음|미설치|해당없음)/i.test(raw)) return false;
  return null;
}

/**
 * 장애인 화장실 유무를 변기 수에서 끌어낸다. 이 API 에는 유무 필드가 없고
 * 남/여 장애인용 대변기·소변기 수만 있다.
 *
 * 셋 다 모르면 null(모름)이다. 하나라도 0 보다 크면 있음, 전부 0 이면 없음.
 */
function hasDisabledToilet(item: ApiItem): boolean | null {
  const counts = [
    count(item.MALE_FRDBL_TOILT_CNT),
    count(item.MALE_FRDBL_URNL_CNT),
    count(item.FEMALE_FRDBL_TOILT_CNT),
  ].filter((n): n is number => n !== null);

  if (counts.length === 0) return null;
  return counts.some((n) => n > 0);
}

/**
 * 개방시간은 두 필드로 나뉘어 온다 — OPN_HR("상시개방" 같은 구분)과
 * OPN_HR_DTL(실제 시각). 사용자에게는 한 줄이면 되므로 합치되, 한쪽이 다른 쪽을
 * 그대로 포함하면 겹쳐 적지 않는다.
 */
function openHours(item: ApiItem): string | null {
  const summary = text(item.OPN_HR);
  const detail = text(item.OPN_HR_DTL);

  if (summary === null) return detail;
  if (detail === null) return summary;
  if (summary.includes(detail) || detail.includes(summary)) {
    return summary.length >= detail.length ? summary : detail;
  }
  return `${summary} (${detail})`;
}

/**
 * 재수집 시 중복 적재를 막는 키.
 *
 * 관리번호(MNG_NO)만으로는 위험하다. 자치단체 안에서만 매긴 일련번호라면
 * 다른 지역과 충돌한다. 개방자치단체코드를 앞에 붙여 전국에서 유일하게 만든다.
 */
function externalId(item: ApiItem): string | null {
  const mngNo = text(item.MNG_NO);
  if (mngNo === null) return null;
  const orgCode = text(item.OPN_ATMY_GRP_CD) ?? "unknown";
  return `mois-${orgCode}-${mngNo}`;
}

/**
 * 못 들어가는 화장실을 걸러낸다.
 *
 * 데이터에는 개방시간이 "미개방"인 행이 섞여 있다(인천 2,276건 중 98건 —
 * 학교·사설 빌딩이 대부분이다). 시설로서는 존재하지만 일반인이 쓸 수 없으므로
 * 지도에 마커로 찍으면 **급한 사람을 헛걸음시킨다.** 이 앱이 없애려는 문제가
 * 바로 그것이다(idea.md 의 문제 정의).
 *
 * "불규칙"(41건)은 남긴다 — 열려는 있고 시간만 일정하지 않다는 뜻이라,
 * 상세 시트에 그대로 보여 주고 판단은 사용자에게 맡기는 편이 낫다.
 */
function isClosedToPublic(item: ApiItem): boolean {
  const hours = `${item.OPN_HR ?? ""} ${item.OPN_HR_DTL ?? ""}`;
  return hours.includes("미개방");
}

/**
 * 다른 지역이 딸려 온 것을 걸러낸다. **전국 수집에서는 하지 않는다** — 전량을
 * 받으므로 걸러낼 "다른 지역"이 없다.
 *
 * API 의 LIKE 조건은 주소 **어디에든** 그 문자열이 있으면 잡는다. "인천"으로
 * 받으면 "충청남도 논산시 양촌면 **인천**리"가 함께 온다(실측 2건). 좌표는
 * 정확하게 논산으로 찍히므로 지오코딩으로는 안 걸러지고, 인천 사용자에게는
 * 그냥 없는 데이터가 된다.
 *
 * 한국 주소는 시도명으로 시작하므로 **접두 일치**면 충분하다. 지번주소만 있는
 * 행도 있어 둘 중 하나라도 REGION 으로 시작하면 통과시킨다. 이 규칙이 새는
 * 경우는 REGION 주석에 적어 뒀다 — 그래서 전국은 필터를 안 쓴다.
 */
function isOutsideRegion(item: ApiItem): boolean {
  if (REGION === null) return false;
  const road = text(item.LCTN_ROAD_NM_ADDR) ?? "";
  const jibun = text(item.LCTN_LOTNO_ADDR) ?? "";
  return !road.startsWith(REGION) && !jibun.startsWith(REGION);
}

/** API 항목 하나를 DB 행으로. 넣을 수 없는 항목은 null 을 돌려준다. */
function toRow(item: ApiItem): ToiletRow | null {
  const id = externalId(item);
  const name = text(item.RSTRM_NM);
  const roadAddress = text(item.LCTN_ROAD_NM_ADDR);
  const jibunAddress = text(item.LCTN_LOTNO_ADDR);

  // name 은 not null 이고, 주소가 둘 다 없으면 toilets_has_address 체크 제약에
  // 걸려 배치 전체가 실패한다. 지오코딩할 방법도 없으므로 여기서 버린다.
  if (id === null || name === null) return null;
  if (roadAddress === null && jibunAddress === null) return null;

  return {
    external_id: id,
    source: "public",
    name,
    road_address: roadAddress,
    jibun_address: jibunAddress,
    // 이 API 에는 남녀공용 여부가 없다. UI 는 null 을 "정보 없음"으로 보여준다.
    unisex: null,
    male_toilet_count: count(item.MALE_TOILT_CNT),
    male_urinal_count: count(item.MALE_URNL_CNT),
    female_toilet_count: count(item.FEMALE_TOILT_CNT),
    open_hours: openHours(item),
    has_diaper_table: yesNo(item.DIAP_EXCHCON_EN),
    has_disabled_toilet: hasDisabledToilet(item),
    manager: text(item.MNG_INST_NM),
    phone: text(item.TELNO),
  };
}

// ---------------------------------------------------------------------------
// API 호출
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} 가 필요합니다. .env.local 에 넣고 --env-file=.env.local 로 실행하세요.`,
    );
  }
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** items 가 배열일 때도 { item: [...] } 일 때도 있다. 둘 다 받는다. */
function readItems(body: NonNullable<ApiResponse["response"]>["body"]) {
  const items = body?.items;
  if (!items) return [];
  return Array.isArray(items) ? items : (items.item ?? []);
}

async function fetchPage(
  serviceKey: string,
  pageNo: number,
): Promise<{ items: ApiItem[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey,
    pageNo: String(pageNo),
    numOfRows: String(PAGE_SIZE),
    returnType: "json",
  });

  // 지역 인자가 있을 때만 필터를 건다.
  //
  // 이 키는 URLSearchParams 가 대괄호·콜론을 %5B·%3A%3A·%5D 로 인코딩해 줘야
  // 먹는다. 날것으로 보내면 API 가 **에러 없이 totalCount:0 을** 돌려주므로
  // 데이터가 없는 것과 구별되지 않는다(2026-08-10 조사 중 실제로 헛다리를 짚었다).
  if (REGION !== null) {
    params.set("cond[LCTN_ROAD_NM_ADDR::LIKE]", REGION);
  }

  const response = await fetch(`${API_URL}?${params}`);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${body.slice(0, 300)}`);
  }

  // 인증키 오류·서버 장애는 returnType=json 을 줘도 XML 이나 HTML 로 온다.
  // 그대로 파싱하면 "Unexpected token '<'" 만 남아 원인을 알 수 없으므로
  // 원문 앞부분을 그대로 보여준다.
  let parsed: ApiResponse;
  try {
    parsed = JSON.parse(body) as ApiResponse;
  } catch {
    throw new Error(`JSON 이 아닌 응답입니다 — ${body.slice(0, 400)}`);
  }

  const header = parsed.response?.header;
  if (header?.resultCode && !/^0+$/.test(header.resultCode)) {
    throw new Error(`API 오류 ${header.resultCode} — ${header.resultMsg}`);
  }

  return {
    items: readItems(parsed.response?.body),
    totalCount: parsed.response?.body?.totalCount ?? 0,
  };
}

/** 간헐적인 502·타임아웃을 넘긴다. 인증키 오류처럼 고칠 수 없는 것도 여기서 재시도되지만,
 *  세 번 실패하면 그대로 던져 로그에 원문이 남는다. */
async function fetchPageWithRetry(serviceKey: string, pageNo: number) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetchPage(serviceKey, pageNo);
    } catch (error) {
      if (attempt >= MAX_RETRY) throw error;
      console.warn(
        `  · ${pageNo}쪽 실패(${attempt}/${MAX_RETRY}), 재시도합니다 — ${(error as Error).message}`,
      );
      await sleep(1000 * attempt);
    }
  }
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------

async function main() {
  const serviceKey = requireEnv("DATA_GO_KR_SERVICE_KEY");
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  console.log(
    REGION === null
      ? "전국 공중화장실을 전량 수집합니다."
      : `"${REGION}" 도로명주소를 가진 공중화장실을 수집합니다.`,
  );

  const rows = new Map<string, ToiletRow>();
  let received = 0;
  let skippedNoAddress = 0;
  let skippedClosed = 0;
  let skippedOtherRegion = 0;
  let duplicates = 0;
  let totalCount = 0;

  for (let pageNo = 1; ; pageNo += 1) {
    const page = await fetchPageWithRetry(serviceKey, pageNo);
    if (pageNo === 1) {
      totalCount = page.totalCount;
      const pages = Math.ceil(totalCount / PAGE_SIZE);
      console.log(`총 ${totalCount}건 · ${PAGE_SIZE}건씩 ${pages}쪽.`);
      if (totalCount === 0) break;
    }

    received += page.items.length;
    for (const item of page.items) {
      if (isOutsideRegion(item)) {
        skippedOtherRegion += 1;
        continue;
      }
      if (isClosedToPublic(item)) {
        skippedClosed += 1;
        continue;
      }
      const row = toRow(item);
      if (row === null) {
        skippedNoAddress += 1;
        continue;
      }
      if (rows.has(row.external_id)) duplicates += 1;
      rows.set(row.external_id, row);
    }

    // 전국은 536쪽이라 쪽마다 줄을 남기면 로그가 못 읽을 만큼 길어진다.
    // \r 로 한 줄을 덮어쓰고 쪽 번호를 같이 적어 어디까지 갔는지만 보인다.
    const percent = Math.floor((received / totalCount) * 100);
    process.stdout.write(
      `\r  받는 중… ${pageNo}쪽 · ${received}/${totalCount} (${percent}%)`,
    );

    if (page.items.length < PAGE_SIZE || received >= totalCount) break;
    await sleep(PAGE_DELAY_MS);
  }

  console.log(
    `\n받은 건수 ${received} · 넣을 건수 ${rows.size}` +
      ` · 미개방이라 건너뜀 ${skippedClosed}` +
      (REGION === null ? "" : ` · 다른 지역이라 건너뜀 ${skippedOtherRegion}`) +
      ` · 주소·이름 없어 건너뜀 ${skippedNoAddress}` +
      (duplicates > 0 ? ` · external_id 중복 ${duplicates}(뒤 값 유지)` : ""),
  );

  if (rows.size === 0) {
    console.log("넣을 것이 없습니다.");
    return;
  }

  // geocode_status·lat·lng 를 payload 에 넣지 않는다. 신규 행은 DB 기본값
  // 'pending' 으로 들어가고, 이미 'ok' 인 기존 행은 그 값을 유지한다.
  // (주소가 바뀐 행을 다시 지오코딩하는 것은 지금 다루지 않는다.)
  const all = [...rows.values()];
  let upserted = 0;

  for (let i = 0; i < all.length; i += UPSERT_CHUNK) {
    const chunk = all.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase
      .from("toilets")
      .upsert(chunk, { onConflict: "external_id" });

    if (error) {
      throw new Error(
        `${i + 1}~${i + chunk.length}번째 저장 실패 — ${error.message}`,
      );
    }
    upserted += chunk.length;
    process.stdout.write(`\r  저장 중… ${upserted}/${all.length}`);
  }

  console.log(`\n저장 완료 ${upserted}건.`);
  console.log("다음: node --env-file=.env.local scripts/geocode-toilets.ts");
}

main().catch((error: unknown) => {
  console.error(`\n실패: ${(error as Error).message}`);
  process.exit(1);
});
