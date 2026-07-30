/**
 * 카카오맵 JS SDK 타입 선언.
 *
 * SDK 는 <script> 로 불러오므로 npm 타입 패키지가 없다. 전체를 선언하지 않고
 * 실제로 쓰는 API 만 최소한으로 적는다. 새 API 를 쓸 때 여기에 추가할 것.
 * 문서: https://apis.map.kakao.com/web/documentation/
 */

declare namespace kakao.maps {
  /** autoload=false 로 불러왔을 때 SDK 초기화를 끝낸 뒤 콜백을 실행한다. */
  function load(callback: () => void): void;

  class LatLng {
    constructor(lat: number, lng: number);
  }

  interface MapOptions {
    center: LatLng;
    /** 확대 레벨. 숫자가 작을수록 확대된다. */
    level?: number;
  }

  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    setCenter(latlng: LatLng): void;
    relayout(): void;
  }

  interface MarkerOptions {
    position: LatLng;
    title?: string;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
  }

  interface CustomOverlayOptions {
    position: LatLng;
    content: string | HTMLElement;
    yAnchor?: number;
    zIndex?: number;
  }

  class CustomOverlay {
    constructor(options: CustomOverlayOptions);
    setMap(map: Map | null): void;
  }

  namespace event {
    function addListener(
      target: object,
      type: string,
      handler: () => void,
    ): void;
  }
}

interface Window {
  kakao: typeof kakao;
}
