/** 지도에 그릴 도보 경로 한 건. TMAP 응답에서 화면에 필요한 것만 추린 형태다. */
export type WalkRoute = {
  /** 출발지에서 도착지까지 이어지는 경로 좌표. 카카오 Polyline 에 그대로 넣는다. */
  path: { lat: number; lng: number }[];
  /** 총 보행 거리(m). */
  distanceMeters: number;
  /** 총 예상 소요 시간(초). */
  durationSeconds: number;
};

/** API Route 가 받는 요청 본문. */
export type WalkRouteRequest = {
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  /** TMAP 이 요구하는 출발·도착 이름. 안내 문구에만 쓰인다. */
  endName: string;
};

/** "279m" · "1.2km" 로 표기한다. 1km 미만은 m 단위가 더 가깝게 읽힌다. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** "도보 4분". 1분 미만도 올림해서 0분이 나오지 않게 한다. */
export function formatDuration(seconds: number): string {
  return `도보 ${Math.max(1, Math.ceil(seconds / 60))}분`;
}
