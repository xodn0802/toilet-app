import type { WalkRoute, WalkRouteRequest } from "@/lib/route/types";

/**
 * 현재 위치에서 화장실까지의 도보 경로를 구한다.
 *
 * 브라우저에서 TMAP 을 직접 부르지 않고 이 Route Handler 를 거치는 이유는 두 가지다.
 * 1) appKey 가 클라이언트 번들에 들어가면 안 된다.
 * 2) apis.openapi.sk.com 은 CORS 를 열어주지 않는다.
 *
 * 카카오모빌리티 길찾기는 자동차 전용이라 도보 경로가 없고, 카카오맵 SDK 자체에는
 * 경로 탐색 기능이 없다. 그래서 좌표는 TMAP 에서 받고 그리기만 카카오로 한다.
 *
 * TMAP 약관상 응답을 24시간 이상 보관할 수 없으므로 결과를 저장하지 않는다.
 * POST 라 Next 도 기본적으로 캐시하지 않는다.
 */

const TMAP_ENDPOINT =
  "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json";

/** TMAP 응답 중 실제로 쓰는 부분만 좁혀 둔 형태. */
type TmapFeature = {
  geometry:
    | { type: "LineString"; coordinates: [number, number][] }
    | { type: "Point"; coordinates: [number, number] };
  properties: { totalDistance?: number; totalTime?: number };
};

export async function POST(request: Request) {
  const appKey = process.env.TMAP_APP_KEY;
  if (!appKey) {
    return Response.json(
      { error: "TMAP_APP_KEY 가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const { start, end, endName } = (await request.json()) as WalkRouteRequest;

  const tmapResponse = await fetch(TMAP_ENDPOINT, {
    method: "POST",
    headers: { appKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      // TMAP 은 X 가 경도, Y 가 위도다. 순서를 바꾸면 엉뚱한 곳의 경로가 나온다.
      startX: start.lng,
      startY: start.lat,
      endX: end.lng,
      endY: end.lat,
      reqCoordType: "WGS84GEO",
      // EPSG3857 로 받으면 카카오에 그리기 전에 좌표 변환이 필요하다. 그냥 위경도로 받는다.
      resCoordType: "WGS84GEO",
      // 한글 이름은 인코딩해서 보내야 하고, 너무 길면 요청이 거절된다.
      startName: encodeURIComponent("현재 위치"),
      endName: encodeURIComponent(endName.slice(0, 50)),
    }),
  });

  if (!tmapResponse.ok) {
    return Response.json(
      { error: `경로를 불러오지 못했습니다. (TMAP ${tmapResponse.status})` },
      { status: 502 },
    );
  }

  const { features } = (await tmapResponse.json()) as {
    features?: TmapFeature[];
  };

  if (!features?.length) {
    return Response.json(
      { error: "도보 경로를 찾지 못했습니다." },
      { status: 404 },
    );
  }

  // 총거리·총시간은 경로 전체를 대표하는 한 피처에만 들어 있다(보통 첫 Point).
  const summary = features.find(
    (feature) => feature.properties.totalDistance !== undefined,
  );

  // 경로는 LineString 여러 조각으로 쪼개져 오므로 순서대로 이어 붙인다.
  const path = features
    .filter((feature) => feature.geometry.type === "LineString")
    .flatMap((feature) => feature.geometry.coordinates as [number, number][])
    // TMAP 은 [경도, 위도] 순으로 준다. 카카오 LatLng 는 반대다.
    .map(([lng, lat]) => ({ lat, lng }));

  if (path.length === 0) {
    return Response.json(
      { error: "도보 경로를 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const route: WalkRoute = {
    path,
    distanceMeters: summary?.properties.totalDistance ?? 0,
    durationSeconds: summary?.properties.totalTime ?? 0,
  };

  return Response.json(route);
}
