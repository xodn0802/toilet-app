/**
 * seed-campus.ts — 캠퍼스 화장실 시드
 *
 * 공공데이터에는 **캠퍼스 실내 화장실이 없다.** 인하대 좌표에 잡히는 것은
 * `인하대학교`·`인하공업전문대학`·`정석항공과학고등학교` 세 줄뿐이고, 이름이
 * 부지 단위라 어느 건물인지도 알 수 없다. 홍보 대상이 인하대생인데 정작 캠퍼스가
 * 비어 있다.
 *
 * 제보 폼으로 한 건씩 넣는 것은 비현실적이라(건물 수십 개 × 층) 표를 읽어
 * 한꺼번에 넣는다.
 *
 * 실행:
 *   npm run seed:campus                       # scripts/data/inha-toilets.csv
 *   npm run seed:campus -- 다른표.csv
 *
 * 필요한 환경변수 (.env.local):
 *   KAKAO_REST_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * ---------------------------------------------------------------------------
 * 좌표는 **건물당 하나**다
 *
 * 층은 좌표로 구분되지 않는다. 그래서 같은 건물의 층들은 지도에서 한 점에
 * 겹치는데, **그것이 설계된 동작이다** — 겹친 것을 목록으로 펼치는 UI 가 이미
 * 있어서(lib/toilets/cluster.ts) 그 목록이 그대로 층 목록이 된다.
 *
 * 좌표는 카카오 키워드 검색으로 `인하대학교 {건물}` 을 찾아 쓴다. 표에 좌표를
 * 적게 하면 사람이 위경도를 뒤집어 적는 사고가 난다.
 *
 * **캠퍼스 밖 결과는 거부한다.** 이름을 조금만 다르게 적어도 카카오가 엉뚱한
 * 곳(인하공업전문대학·타 대학 같은 이름 건물)을 첫 결과로 준다. 조용히 들어가면
 * 지도에는 멀쩡해 보이는데 길찾기가 다른 학교로 안내한다.
 *
 * ---------------------------------------------------------------------------
 * 여러 번 돌려도 안전하다
 *
 * `external_id` 를 `inha-{건물}-{층}-{성별}` 로 만들어 그 값으로 upsert 한다.
 * 0001_init.sql 은 이 칸을 "공공데이터 관리번호, 사용자 등록 건은 NULL" 로
 * 적어 뒀는데, **시드는 사람이 손으로 넣는 것이 아니라 스크립트가 다시 넣을 수
 * 있어야 하는 것**이라 여기서는 채운다. 접두사 `inha-` 가 공공데이터 번호와
 * 겹칠 일을 막는다.
 *
 * **성별이 키에 들어가는 이유** — 캠퍼스 실내 화장실은 같은 층에 남/여가 나란히
 * 있는 것이 기본이라, `inha-{건물}-{층}` 까지만 쓰면 두 줄이 한 행을 두고 싸워
 * 뒤엣것이 앞엣것을 조용히 덮어쓴다(0005_gender.sql).
 */

import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const KAKAO_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

const DEFAULT_CSV = "scripts/data/inha-toilets.csv";

/** 캠퍼스 중심. 검색 결과가 여기서 멀면 다른 곳을 찾은 것이다. */
const CAMPUS = { lat: 37.4506, lng: 126.6536 };

/** 캠퍼스로 인정할 반경(m). 인하대 부지는 대각선이 약 900m 다. */
const CAMPUS_RADIUS_M = 1200;

/** 주소를 못 받았을 때 쓸 값. toilets_has_address 가 NULL 둘을 막는다. */
const CAMPUS_ADDRESS = "인천광역시 미추홀구 인하로 100";

const HEADER = [
  "building",
  "floor",
  "gender",
  "diaper",
  "disabled",
  "access",
  "open_hours",
] as const;

const ACCESS_VALUES = new Set(["free", "open", "purchase", "paid"]);

/**
 * 0005_gender.sql 의 check · lib/toilets/types.ts 의 `Gender` 와 같은 값이다.
 * 스크립트는 `@/` 별칭을 안 쓰므로(다른 수집 스크립트도 그렇다) 여기서 다시 적는다.
 */
const GENDER_LABELS = {
  male: "남자",
  female: "여자",
  all: "남녀공용",
} as const;

type Gender = keyof typeof GENDER_LABELS;

type Row = {
  building: string;
  floor: string;
  gender: Gender | null;
  diaper: boolean | null;
  disabled: boolean | null;
  access: string | null;
  open_hours: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} 가 필요합니다. .env.local 을 확인하세요.`);
  }
  return value;
}

/**
 * 빈칸은 `null`(모름)이다. `n` 을 기본값으로 삼으면 안 적은 건물이 전부
 * "장애인 화장실 없음"이 돼 있는 것을 없다고 말하게 된다.
 */
function parseTriState(value: string, line: number, column: string) {
  if (value === "") return null;
  if (value === "y") return true;
  if (value === "n") return false;
  throw new Error(`${line}행 ${column} — y·n·빈칸만 됩니다 ("${value}")`);
}

/** 빈칸은 "모름"(null)이지 "공용"이 아니다. parseTriState 와 같은 원칙이다. */
function parseGender(value: string, line: number): Gender | null {
  if (value === "") return null;
  if (value in GENDER_LABELS) return value as Gender;
  throw new Error(
    `${line}행 gender — ${Object.keys(GENDER_LABELS).join("·")} 또는 빈칸 ("${value}")`,
  );
}

/**
 * 표를 읽는다.
 *
 * 따옴표를 다루지 않는 대신 **칸 수가 안 맞으면 멈춘다.** 값에 쉼표를 넣으면
 * 조용히 밀려 들어가는 것이 표를 읽다 생기는 가장 흔한 사고다.
 */
function parseCsv(text: string): Row[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

  if (lines.length === 0) throw new Error("표가 비어 있습니다.");

  const header = lines[0].split(",").map((cell) => cell.trim());
  if (header.join(",") !== HEADER.join(",")) {
    throw new Error(`첫 줄은 ${HEADER.join(",")} 이어야 합니다.`);
  }

  return lines.slice(1).map((line, index) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const at = index + 2;
    if (cells.length !== HEADER.length) {
      throw new Error(
        `${at}행 — 칸이 ${cells.length}개입니다. ${HEADER.length}개여야 하고,` +
          ` 값에 쉼표를 넣을 수 없습니다.`,
      );
    }

    const [building, floor, gender, diaper, disabled, access, openHours] =
      cells;
    if (!building || !floor) {
      throw new Error(`${at}행 — building 과 floor 는 비울 수 없습니다.`);
    }
    if (access !== "" && !ACCESS_VALUES.has(access)) {
      throw new Error(
        `${at}행 access — ${[...ACCESS_VALUES].join("·")} 또는 빈칸 ("${access}")`,
      );
    }

    return {
      building,
      floor,
      gender: parseGender(gender, at),
      diaper: parseTriState(diaper, at, "diaper"),
      disabled: parseTriState(disabled, at, "disabled"),
      access: access || null,
      open_hours: openHours || null,
    };
  });
}

/** 두 좌표 사이 거리(m). 캠퍼스 안인지만 보면 되므로 하버사인이면 충분하다. */
function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

type Place = { lat: number; lng: number; address: string | null };

async function findBuilding(apiKey: string, building: string): Promise<Place> {
  const params = new URLSearchParams({
    query: `인하대학교 ${building}`,
    size: "5",
  });

  const response = await fetch(`${KAKAO_URL}?${params}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(
      `카카오 ${response.status} — ${(await response.text()).slice(0, 200)}`,
    );
  }

  const body = (await response.json()) as {
    documents?: {
      place_name?: string;
      x?: string;
      y?: string;
      road_address_name?: string;
    }[];
  };

  for (const doc of body.documents ?? []) {
    // x=경도, y=위도이고 둘 다 문자열이다. 뒤집어 쓰면 좌표가 바다로 간다.
    const lat = Number.parseFloat(doc.y ?? "");
    const lng = Number.parseFloat(doc.x ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (distanceMeters(CAMPUS, { lat, lng }) > CAMPUS_RADIUS_M) continue;
    return { lat, lng, address: doc.road_address_name || null };
  }

  throw new Error(
    `"${building}" 을 캠퍼스 안에서 못 찾았습니다.` +
      ` 카카오맵에 나오는 이름 그대로 적어 주세요.`,
  );
}

async function main() {
  const apiKey = requireEnv("KAKAO_REST_API_KEY");
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const path = process.argv[2] ?? DEFAULT_CSV;
  const rows = parseCsv(readFileSync(path, "utf8"));
  if (rows.length === 0) {
    console.log(`${path} 에 데이터 줄이 없습니다.`);
    return;
  }

  // 건물당 한 번만 찾는다. 같은 건물의 층이 서로 다른 좌표를 갖는 것도 막는다.
  const places = new Map<string, Place>();
  for (const building of new Set(rows.map((row) => row.building))) {
    const place = await findBuilding(apiKey, building);
    places.set(building, place);
    console.log(
      `  ${building} → ${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`,
    );
  }

  const payload = rows.map((row) => {
    const place = places.get(row.building)!;
    // 이름에도 성별을 넣는다. 같은 좌표의 층 목록에서 남/여가 나란히 뜨는데
    // 이름이 같으면 어느 쪽을 눌렀는지 알 수 없다.
    const suffix = row.gender === null ? "" : ` ${GENDER_LABELS[row.gender]}`;
    return {
      source: "user",
      external_id: `inha-${row.building}-${row.floor}-${row.gender ?? ""}`,
      name: `${row.building} ${row.floor}${suffix}`,
      building: row.building,
      floor: row.floor,
      gender: row.gender,
      road_address: place.address ?? CAMPUS_ADDRESS,
      lat: place.lat,
      lng: place.lng,
      // 좌표를 직접 넣었으므로 지오코딩 대상이 아니다. pending 으로 두면
      // npm run geocode 가 이 행의 좌표를 주소로 덮어쓴다.
      geocode_status: "ok",
      // gender 에서 만든다 — 둘을 따로 적으면 서로 다른 말을 하게 된다.
      unisex: row.gender === null ? null : row.gender === "all",
      has_diaper_table: row.diaper,
      has_disabled_toilet: row.disabled,
      access: row.access,
      open_hours: row.open_hours,
    };
  });

  const { error } = await supabase
    .from("toilets")
    .upsert(payload, { onConflict: "external_id" });

  if (error) throw new Error(`저장 실패 — ${error.message}`);

  console.log(`완료 ${payload.length}건 · 건물 ${places.size}개`);
}

main().catch((error: unknown) => {
  console.error(`\n실패: ${(error as Error).message}`);
  process.exit(1);
});
