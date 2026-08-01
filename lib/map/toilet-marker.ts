/**
 * 화장실 마커 핀.
 *
 * 카카오 기본 마커는 빨간 풍선이라 어느 지도 앱에서나 똑같이 생겼다. 지도 위에서
 * 가장 많이 반복되는 요소이므로 여기만 바꿔도 인상이 크게 달라진다.
 *
 * 색을 CSS 변수가 아니라 리터럴로 적는 이유: 이 문자열은 SDK 에 이미지 URL 로
 * 넘어가 <img> 로 그려진다. 문서 밖이라 var() 가 해석되지 않는다. 카카오 지도
 * 타일 자체가 항상 밝은 색이므로 다크 모드에서도 같은 색을 쓴다.
 */

const BODY = "#2E7D6B"; // --brand
const EDGE = "#FFFFFF";
const GLYPH = "#FFFFFF";

/** 좌표를 가리키는 뾰족한 끝이 아래에 오도록 세로로 길다. */
const WIDTH = 36;
const HEIGHT = 46;

/** 선택된 핀은 이만큼 키운다. 색을 바꾸는 것보다 눈이 먼저 잡는다. */
const SELECTED_SCALE = 1.3;

/**
 * 반경 밖 핀의 불투명도.
 *
 * 숨기지 않는 이유: 급한 사람에게 1.1km 화장실을 안 보여주는 것은 손해다.
 * 진하기만 낮춰 "있긴 한데 멀다"를 말한다.
 */
const FAR_OPACITY = 0.45;

/**
 * 공중화장실 표지판의 남녀 픽토그램.
 *
 * 핀 머리(중심 18,17 / 반지름 15) 안에 들어가도록 좌표를 잡았다. 두 사람을
 * 나란히 놓으면 이 크기에서 뭉개질 만큼 작지만, 실루엣만으로도 "화장실"로 읽힌다.
 */
const PICTOGRAM = `
  <g transform="translate(0 1.5)" fill="${GLYPH}">
    <circle cx="12.5" cy="9.4" r="2.2" />
    <rect x="10.3" y="12.4" width="4.4" height="6.2" rx="1.1" />
    <rect x="10.8" y="17.9" width="1.5" height="5.6" rx="0.6" />
    <rect x="12.7" y="17.9" width="1.5" height="5.6" rx="0.6" />
    <circle cx="23.5" cy="9.4" r="2.2" />
    <path d="M23.5 12.4 20.3 20.6h6.4z" />
    <rect x="21.9" y="20.2" width="1.4" height="3.3" rx="0.6" />
    <rect x="23.7" y="20.2" width="1.4" height="3.3" rx="0.6" />
  </g>
`;

function pinSvg(opacity: number): string {
  // 투명도는 <g> 에 한 번만 건다. 핀 몸통과 픽토그램에 따로 걸면 겹치는 부분이
  // 두 번 곱해져 테두리만 진하게 남는다.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <g opacity="${opacity}">
      <path
        d="M18 44.5C18 44.5 33 28.5 33 17A15 15 0 1 0 3 17C3 28.5 18 44.5 18 44.5Z"
        fill="${BODY}" stroke="${EDGE}" stroke-width="2.5" stroke-linejoin="round"
      />
      ${PICTOGRAM}
    </g>
  </svg>`;
}

/** btoa 는 한글에서 깨진다. 여기엔 ASCII 만 있지만 encodeURIComponent 가 더 안전하다. */
function toDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 마커 이미지를 만든다.
 *
 * MarkerImage 는 좌표당 하나씩 만들 필요가 없다. 화장실이 수천 개가 되면 같은
 * 객체를 돌려쓰는 편이 훨씬 가벼우므로 모듈 수준에서 한 번만 만들어 캐시한다.
 */
function createImage(scale: number, opacity: number): kakao.maps.MarkerImage {
  const width = Math.round(WIDTH * scale);
  const height = Math.round(HEIGHT * scale);
  return new kakao.maps.MarkerImage(
    toDataUri(pinSvg(opacity)),
    new kakao.maps.Size(width, height),
    // 핀은 뾰족한 끝이 좌표를 가리킨다. 기준점을 가로 중앙·세로 맨 아래로.
    { offset: new kakao.maps.Point(width / 2, height) },
  );
}

/**
 * 핀의 세 가지 모습.
 *
 * `far` 는 반경 밖이다. 선택은 반경보다 우선한다 — 먼 화장실을 골랐는데 핀이
 * 흐린 채로 있으면 무엇을 골랐는지 안 보인다.
 */
export type MarkerState = "normal" | "far" | "selected";

const cache: Partial<Record<MarkerState, kakao.maps.MarkerImage>> = {};

/** SDK 가 준비된 뒤에만 부를 것. kakao.maps.Size 등이 필요하다. */
export function toiletMarkerImage(state: MarkerState): kakao.maps.MarkerImage {
  return (cache[state] ??=
    state === "selected"
      ? createImage(SELECTED_SCALE, 1)
      : createImage(1, state === "far" ? FAR_OPACITY : 1));
}

/**
 * 겹칠 때의 순서. 선택 > 반경 안 > 반경 밖.
 * 흐린 핀이 가까운 핀을 가리면 진하게 만든 의미가 없다.
 */
export const MARKER_Z = { far: 1, normal: 2, selected: 3 } as const;
