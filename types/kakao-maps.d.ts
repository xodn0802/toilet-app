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
    getLat(): number;
    getLng(): number;
  }

  interface MapOptions {
    center: LatLng;
    /** 확대 레벨. 숫자가 작을수록 확대된다. */
    level?: number;
  }

  class LatLngBounds {
    constructor();
    /** 주어진 좌표를 포함하도록 영역을 넓힌다. */
    extend(latlng: LatLng): void;
    /** 남서쪽 모서리 = (최소 위도, 최소 경도). */
    getSouthWest(): LatLng;
    /** 북동쪽 모서리 = (최대 위도, 최대 경도). */
    getNorthEast(): LatLng;
  }

  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    setCenter(latlng: LatLng): void;
    /** 지금 화면에 보이는 영역. bbox 조회의 기준이다. */
    getBounds(): LatLngBounds;
    setLevel(level: number): void;
    /** 영역이 화면에 들어오도록 중심·확대를 맞춘다. 여백은 px 단위. */
    setBounds(
      bounds: LatLngBounds,
      paddingTop?: number,
      paddingRight?: number,
      paddingBottom?: number,
      paddingLeft?: number,
    ): void;
    relayout(): void;
  }

  /** 마커 이미지의 크기·기준점을 재는 단위. px. */
  class Size {
    constructor(width: number, height: number);
  }

  class Point {
    constructor(x: number, y: number);
  }

  interface MarkerImageOptions {
    /** 이미지 안에서 좌표에 맞출 지점. 핀은 뾰족한 끝이라 (가로중앙, 높이). */
    offset?: Point;
  }

  class MarkerImage {
    constructor(src: string, size: Size, options?: MarkerImageOptions);
  }

  interface MarkerOptions {
    position: LatLng;
    title?: string;
    image?: MarkerImage;
    zIndex?: number;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    setImage(image: MarkerImage): void;
    setZIndex(zIndex: number): void;
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

  interface PolylineOptions {
    path: LatLng[];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: "solid" | "shortdash" | "dash" | "dot";
  }

  class Polyline {
    constructor(options: PolylineOptions);
    setMap(map: Map | null): void;
  }

  interface CircleOptions {
    center: LatLng;
    /** 반지름. m 단위. */
    radius: number;
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: "solid" | "shortdash" | "dash" | "dot";
    fillColor?: string;
    fillOpacity?: number;
  }

  class Circle {
    constructor(options: CircleOptions);
    setMap(map: Map | null): void;
    /** 원에 외접하는 사각 영역. setBounds 로 화면을 맞출 때 쓴다. */
    getBounds(): LatLngBounds;
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
