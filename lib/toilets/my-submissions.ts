/**
 * 내가 방금 보낸 제보를 **이 브라우저가** 기억한다.
 *
 * 제보는 `toilet_submissions` 검토 큐에 쌓이고 승인 전에는 지도에 안 뜬다. 보낸
 * 사람 눈에는 아무 일도 안 일어난 것과 같아서 두 번째 제보를 안 하게 된다.
 *
 * **RLS 로 풀지 않는다.** `toilet_submissions` 에는 SELECT 정책이 없고, 그게
 * 장난 제보가 검토 없이 남에게 보이는 걸 막는 장치다. 정책을 열면 내 것만
 * 골라 읽게 하려고 `user_id` 를 붙여야 하고, 제보에 신원을 요구하지 않기로 한
 * 결정(CLAUDE.md "사용자 화장실 추가 요청")이 뒤집힌다.
 *
 * 그럴 필요가 없다 — **내 브라우저가 방금 무엇을 보냈는지는 내 브라우저가 안다.**
 * 서버에 한 번도 묻지 않고, 다른 사람에게는 아무것도 안 보인다.
 *
 * TMAP 응답 24시간 보관 금지와는 무관하다. 남의 서비스 응답이 아니라 **내가 적어
 * 보낸 글의 사본**이다.
 */

const KEY = "bbung.my-submissions";

/**
 * 이만큼 지나면 지운다.
 *
 * 반려된 제보는 승인 행이 영영 안 생기므로 스스로는 안 사라진다. 점선 핀이
 * 몇 달째 남아 있으면 "보냈는데 아직도 안 올라갔다"는 오해가 된다.
 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 같은 좌표로 볼 오차(도). 약 1cm.
 *
 * 승인 SQL 이 `s.lat, s.lng` 를 그대로 복사하므로 값은 사실 정확히 같다.
 * 부동소수가 JSON 을 왕복하는 경로가 둘(localStorage · PostgREST)이라 여유만 둔다.
 */
const COORD_EPSILON = 1e-7;

export type MySubmission = {
  lat: number;
  lng: number;
  name: string;
  /** 보낸 시각(ms). TTL 계산에만 쓴다. */
  at: number;
};

/** 서버 렌더와 "없음"이 같은 객체를 쓰도록 고정해 둔다. */
const EMPTY: MySubmission[] = [];

/**
 * 마지막으로 읽은 값.
 *
 * `list()` 가 **매번 같은 배열 참조**를 돌려줘야 한다 — useSyncExternalStore 는
 * 스냅샷이 바뀌면 다시 렌더하므로, 호출마다 새 배열을 만들면 무한히 돈다.
 */
let cache: MySubmission[] | null = null;
const listeners = new Set<() => void>();

function isEntry(value: unknown): value is MySubmission {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.lat === "number" &&
    typeof item.lng === "number" &&
    typeof item.name === "string" &&
    typeof item.at === "number"
  );
}

/** localStorage 에서 읽고 만료된 것을 걸러낸다. 못 읽으면 빈 목록이다. */
function read(): MySubmission[] {
  if (typeof window === "undefined") return EMPTY;

  let parsed: unknown;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    parsed = JSON.parse(raw);
  } catch {
    // 손상됐거나 localStorage 를 못 쓰는 브라우저. 점선 핀이 안 뜰 뿐이다.
    return EMPTY;
  }
  if (!Array.isArray(parsed)) return EMPTY;

  const now = Date.now();
  const all = parsed.filter(isEntry);
  const alive = all.filter((entry) => now - entry.at < TTL_MS);

  // 만료분이 있었으면 저장본도 정리한다. **알림은 보내지 않는다** — 이 함수는
  // 렌더 중(list())에 불릴 수 있고, 거기서 알리면 렌더 도중 다시 렌더하게 된다.
  if (alive.length !== all.length) persist(alive);
  return alive.length === 0 ? EMPTY : alive;
}

function persist(next: MySubmission[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 용량 초과·사생활 보호 모드. 화면에는 반영되고 다음 방문에 잊힐 뿐이다.
  }
}

/** 값을 바꾸고 구독자에게 알린다. **바뀌었을 때만 부를 것.** */
function commit(next: MySubmission[]): void {
  cache = next;
  persist(next);
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 지금 검토 중인 내 제보. 참조가 안정적이라 그대로 렌더에 쓸 수 있다. */
export function list(): MySubmission[] {
  if (cache === null) cache = read();
  return cache;
}

/** 서버 렌더용. localStorage 가 없으므로 항상 빈 목록이다. */
export function listOnServer(): MySubmission[] {
  return EMPTY;
}

/** 제보를 보낸 직후에 부른다. */
export function remember(entry: Omit<MySubmission, "at">): void {
  commit([...list(), { ...entry, at: Date.now() }]);
}

/**
 * 지도에 실제로 올라온 것을 목록에서 뺀다.
 *
 * 승인 SQL 이 좌표와 이름을 그대로 복사하므로, **같은 좌표에 같은 이름의 행이
 * 조회되면 그게 승인된 내 제보다.** 승인 여부를 물을 API 가 따로 필요 없다.
 *
 * 넘어오는 것은 지금 화면 범위의 행뿐이라, 멀리서 보낸 제보는 그 자리로 가야
 * 정리된다. 그동안 점선 핀은 그 좌표에만 있으므로 눈에 걸리지 않고, 끝내
 * 안 가더라도 TTL 이 지운다.
 */
export function forgetApproved(
  rows: readonly { lat: number; lng: number; name: string }[],
): void {
  const mine = list();
  if (mine.length === 0 || rows.length === 0) return;

  const remaining = mine.filter(
    (entry) =>
      !rows.some(
        (row) =>
          row.name === entry.name &&
          Math.abs(row.lat - entry.lat) < COORD_EPSILON &&
          Math.abs(row.lng - entry.lng) < COORD_EPSILON,
      ),
  );

  // 안 바뀌었으면 그대로 둔다. 새 배열을 만들면 스냅샷이 달라져 헛렌더가 돈다.
  if (remaining.length !== mine.length) {
    commit(remaining.length === 0 ? EMPTY : remaining);
  }
}
