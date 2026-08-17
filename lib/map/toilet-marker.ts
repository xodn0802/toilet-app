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
 *
 * 색을 인자로 받는 이유 — 검토 중 핀은 속이 비어 있어(흰 바닥) 흰 픽토그램이
 * 안 보인다. 거기서는 청록으로 그린다.
 */
function pictogram(fill: string): string {
  return `
  <g transform="translate(0 1.5)" fill="${fill}">
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
}

/** 핀 몸통. 머리 원 + 아래로 뻗은 꼭짓점. */
const BODY_PATH =
  "M18 44.5C18 44.5 33 28.5 33 17A15 15 0 1 0 3 17C3 28.5 18 44.5 18 44.5Z";

/**
 * 같은 좌표에 여러 곳이 있을 때 붙이는 개수 배지.
 *
 * 이름 라벨은 달지 않는다 — 한 점에 31곳까지 쌓이는 데다 이름이 전부 부지 단위라
 * ("인하대학교"가 세 번) 화면만 무너지고 구분도 안 된다. 숫자 하나면 "여기는
 * 눌러야 할 것이 더 있다"는 사실만 전한다. 무엇이 있는지는 목록 시트가 말한다.
 *
 * 캔버스를 넓히지 않고 핀 머리 오른쪽 위에 겹쳐 둔다. 넓히면 마커 기준점
 * (가로 중앙·세로 맨 아래)이 함께 밀려 핀 끝이 좌표를 안 가리킨다.
 */
function badgeSvg(count: number): string {
  // 세 자리가 넘으면 칸을 아무리 넓혀도 이 크기에서 못 읽는다.
  const label = count > 99 ? "99+" : String(count);
  const w = 10 + label.length * 6;
  const x = WIDTH - w;

  return `
    <g>
      <rect x="${x}" y="0" width="${w}" height="16" rx="8"
            fill="${EDGE}" stroke="${BODY}" stroke-width="2" />
      <text x="${x + w / 2}" y="11.5" text-anchor="middle"
            font-family="sans-serif" font-size="10" font-weight="700"
            fill="${BODY}">${label}</text>
    </g>
  `;
}

function pinSvg(opacity: number, count: number): string {
  // 투명도는 <g> 에 한 번만 건다. 핀 몸통과 픽토그램에 따로 걸면 겹치는 부분이
  // 두 번 곱해져 테두리만 진하게 남는다.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <g opacity="${opacity}">
      <path
        d="${BODY_PATH}"
        fill="${BODY}" stroke="${EDGE}" stroke-width="2.5" stroke-linejoin="round"
      />
      ${pictogram(GLYPH)}
      ${count > 1 ? badgeSvg(count) : ""}
    </g>
  </svg>`;
}

/**
 * 검토 중인 내 제보.
 *
 * **속이 비어 있고 테두리가 점선이다.** 진짜 마커와 한눈에 갈려야 한다 — 색만
 * 다르게 하면 "다른 종류의 화장실"로 읽히지 "아직 지도에 없는 곳"으로는 안
 * 읽힌다. 점선은 앱 안에서 이미 같은 말을 하고 있다: 「이 위치에 화장실 추가」
 * 버튼과 시설 칩의 "정보 없음"이 같은 점선이다.
 *
 * 흰 바닥은 지도 타일 위에서 핀 모양을 지키기 위한 것이다. 완전히 투명하게
 * 두면 도로·건물 위에서 실루엣이 무너진다.
 *
 * 개수 배지는 없다. 검토 큐는 좌표로 묶지 않고 보낸 순서 그대로 하나씩 그린다.
 */
function pendingPinSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <path
      d="${BODY_PATH}"
      fill="${EDGE}" fill-opacity="0.92"
      stroke="${BODY}" stroke-width="2.5" stroke-dasharray="5 3.5"
      stroke-linejoin="round"
    />
    ${pictogram(BODY)}
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
function createImage(svg: string, scale: number): kakao.maps.MarkerImage {
  const width = Math.round(WIDTH * scale);
  const height = Math.round(HEIGHT * scale);
  return new kakao.maps.MarkerImage(
    toDataUri(svg),
    new kakao.maps.Size(width, height),
    // 핀은 뾰족한 끝이 좌표를 가리킨다. 기준점을 가로 중앙·세로 맨 아래로.
    { offset: new kakao.maps.Point(width / 2, height) },
  );
}

/**
 * 핀의 네 가지 모습.
 *
 * `far` 는 반경 밖이다. 선택은 반경보다 우선한다 — 먼 화장실을 골랐는데 핀이
 * 흐린 채로 있으면 무엇을 골랐는지 안 보인다.
 *
 * `pending` 은 **DB 에 없는 핀**이다. 다른 셋은 조회해 온 행을 그리지만 이건
 * 내 브라우저가 기억하는 제보다(lib/toilets/my-submissions.ts).
 */
export type MarkerState = "normal" | "far" | "selected" | "pending";

/**
 * 개수까지 키에 넣는다. 상태 3가지 × 실제로 쓰이는 개수만큼만 만들어지고,
 * 대부분의 좌표는 1곳이라 캐시는 사실상 예전과 같은 크기로 유지된다.
 */
const cache = new Map<string, kakao.maps.MarkerImage>();

/**
 * SDK 가 준비된 뒤에만 부를 것. kakao.maps.Size 등이 필요하다.
 *
 * `count` 는 이 좌표에 겹친 화장실 수다. 1이면 배지가 안 붙어 기존 핀과 같다.
 */
export function toiletMarkerImage(
  state: MarkerState,
  count = 1,
): kakao.maps.MarkerImage {
  const key = `${state}:${count}`;
  let image = cache.get(key);
  if (!image) {
    image =
      state === "pending"
        ? createImage(pendingPinSvg(), 1)
        : state === "selected"
          ? createImage(pinSvg(1, count), SELECTED_SCALE)
          : createImage(pinSvg(state === "far" ? FAR_OPACITY : 1, count), 1);
    cache.set(key, image);
  }
  return image;
}

/**
 * 겹칠 때의 순서. 선택 > 반경 안 > 반경 밖.
 * 흐린 핀이 가까운 핀을 가리면 진하게 만든 의미가 없다.
 *
 * `pending` 이 `normal` 과 같은 높이인 것은 의도다. 내가 보낸 제보라고 해서
 * 남들이 실제로 갈 수 있는 화장실을 가릴 이유가 없다.
 */
export const MARKER_Z = { far: 1, normal: 2, pending: 2, selected: 3 } as const;
