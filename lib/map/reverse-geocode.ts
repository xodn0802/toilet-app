/**
 * 좌표 → 주소 (역지오코딩).
 *
 * 카카오 REST 대신 **지도 SDK 의 services 라이브러리**를 쓴다. REST 를 쓰면
 * KAKAO_REST_API_KEY 를 Vercel 에 올려야 하는데, JS SDK 는 이미 지도에 쓰고 있는
 * JS 키로 브라우저에서 그냥 된다(CLAUDE.md 환경변수 표 참고).
 *
 * 대신 SDK URL 에 `&libraries=services` 가 붙어 있어야 한다 — ToiletMap.tsx.
 */

export type ReverseGeocodeResult = {
  /** 도로명주소. **건물이 없는 곳은 null 이다** (공원 한가운데 등). */
  road: string | null;
  /** 지번주소. 보통 있지만 바다·해외에서는 없다. */
  jibun: string | null;
};

const NOT_FOUND: ReverseGeocodeResult = { road: null, jibun: null };

/** Geocoder 는 SDK 로드 후에만 만들 수 있어서 처음 쓸 때 만든다. */
let geocoder: kakao.maps.services.Geocoder | null = null;

function getGeocoder(): kakao.maps.services.Geocoder {
  geocoder ??= new window.kakao.maps.services.Geocoder();
  return geocoder;
}

/**
 * 좌표의 주소를 읽는다. **못 읽어도 던지지 않고 null 두 개를 돌려준다.**
 *
 * ZERO_RESULT(바다·해외)와 ERROR 를 구분하지 않는다. 화면이 할 일은 둘 다
 * "주소를 못 읽었어요 · 좌표로 접수됩니다"로 같기 때문이다.
 */
export function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  return new Promise((resolve) => {
    // 카카오는 경도를 먼저 받는다. lat/lng 순서로 넘기면 조용히 엉뚱한 곳이 나온다.
    getGeocoder().coord2Address(lng, lat, (result, status) => {
      if (status !== window.kakao.maps.services.Status.OK || !result[0]) {
        resolve(NOT_FOUND);
        return;
      }

      resolve({
        road: result[0].road_address?.address_name ?? null,
        jibun: result[0].address?.address_name ?? null,
      });
    });
  });
}
