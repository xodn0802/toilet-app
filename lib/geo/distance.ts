/**
 * 두 좌표 사이의 직선거리(m). 하버사인 공식.
 *
 * 길찾기를 누르기 전에도 "현재 위치에서 60m" 를 보여주려고 둔 것이다.
 * 실제 걸어야 하는 거리는 건물·횡단보도를 돌아가므로 이 값보다 길다.
 * 정확한 도보 거리는 TMAP 경로(WalkRoute.distanceMeters)가 알려준다.
 */

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function straightLineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
