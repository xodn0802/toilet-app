/**
 * 지도 영역(bbox). 조회 범위를 정하는 데 쓴다.
 *
 * 화장실이 수천 건이 되면서 전체를 받아올 수 없게 됐다. 지도가 보고 있는
 * 영역만 조회하는데, 그 영역을 지도(카카오 SDK)와 조회(Supabase)가 같은
 * 모양으로 주고받아야 해서 여기 한 곳에 둔다.
 */

/** 위도 1도의 거리(m). 어디서나 거의 같다. */
const METERS_PER_LAT_DEGREE = 111_320;

export type Bounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

/**
 * 한 점을 중심으로 반경 meters 를 감싸는 사각형.
 *
 * 원이 아니라 사각형이라 모서리 쪽은 반경보다 멀리까지 포함한다. 조회 범위를
 * 정하는 용도라 넓은 쪽으로 틀리는 것은 안전하다 — 반경 판정은 조회한 뒤
 * summarizeNearby 가 하버사인으로 다시 한다.
 */
export function boundsAround(
  center: { lat: number; lng: number },
  meters: number,
): Bounds {
  const dLat = meters / METERS_PER_LAT_DEGREE;
  // 경도 1도의 거리는 극에 가까울수록 짧아진다. 위도로 보정하지 않으면
  // 고위도에서 동서 방향이 좁게 잘린다.
  const dLng =
    meters / (METERS_PER_LAT_DEGREE * Math.cos((center.lat * Math.PI) / 180));

  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/** 둘 다 감싸는 최소 사각형. */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minLat: Math.min(a.minLat, b.minLat),
    maxLat: Math.max(a.maxLat, b.maxLat),
    minLng: Math.min(a.minLng, b.minLng),
    maxLng: Math.max(a.maxLng, b.maxLng),
  };
}

/**
 * 같은 영역인지. 지도 idle 은 실제로 안 움직여도 올 수 있어서, 이걸로 걸러
 * 불필요한 재조회를 막는다.
 *
 * 미터 단위 아래의 차이는 무시한다. 조회 범위에는 영향이 없고, 부동소수점
 * 끝자리가 흔들릴 때마다 다시 조회하면 그게 더 손해다.
 */
export function sameBounds(a: Bounds | null, b: Bounds | null): boolean {
  if (a === null || b === null) return a === b;
  const close = (x: number, y: number) => Math.abs(x - y) < 1e-6;
  return (
    close(a.minLat, b.minLat) &&
    close(a.maxLat, b.maxLat) &&
    close(a.minLng, b.minLng) &&
    close(a.maxLng, b.maxLng)
  );
}
