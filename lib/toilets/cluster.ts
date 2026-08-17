/**
 * 같은 좌표에 쌓인 화장실을 하나로 묶는다.
 *
 * 왜 필요한가 — 공공데이터의 주소가 **부지 단위**라 캠퍼스·공원에서는 여러
 * 화장실이 같은 주소를 갖고, 지오코딩하면 좌표까지 똑같아진다. 마커를 행마다
 * 하나씩 찍으면 완전히 포개져 **맨 위 하나만 눌린다.** 나머지는 지도에 있어도
 * 영영 열리지 않는다. **전국 실측 4,755그룹 13,773곳 — 전체의 26.9%다.**
 * 최다 71곳(충남대) · 54곳(스타필드하남) · 37곳(부경대).
 *
 * **좌표 완전 일치로만 묶는다.** 픽셀 거리 기반 클러스터링은 축척마다 다시
 * 계산해야 하는 데다, 카카오의 MarkerClusterer 는 좌표가 같으면 아무리 확대해도
 * 안 갈라져 이 문제를 못 푼다. 겹침의 원인이 "같은 주소 → 같은 지오코딩 결과"
 * 하나라서 동일 좌표가 실제 문제의 전부다.
 *
 * 캠퍼스 시드도 이 구조를 그대로 쓴다 — 건물 좌표 하나에 층별 행을 붙이면
 * 이 묶음이 그대로 **층 목록**이 된다(0004_building_floor.sql).
 */

import { genderLabel, type MappableToilet } from "./types";

export type ToiletGroup = {
  /** `${lat},${lng}`. React key 와 마커 식별에 쓴다. */
  key: string;
  lat: number;
  lng: number;
  /** 항상 1개 이상. 순서는 입력 순서를 유지한다. */
  toilets: MappableToilet[];
};

/**
 * 좌표가 같은 것끼리 묶는다.
 *
 * 키를 문자열로 만드는 이유: 부동소수를 그대로 비교하면 같은 값도 표현이 달라질
 * 수 있고, Map 의 키로 객체를 쓰면 참조 비교가 된다. DB 에서 온 double precision
 * 을 그대로 문자열화하면 같은 행에서 온 값끼리는 항상 같은 문자열이 된다.
 */
export function groupByCoords(toilets: MappableToilet[]): ToiletGroup[] {
  const groups = new Map<string, ToiletGroup>();

  for (const toilet of toilets) {
    const key = `${toilet.lat},${toilet.lng}`;
    const found = groups.get(key);
    if (found) {
      found.toilets.push(toilet);
    } else {
      groups.set(key, {
        key,
        lat: toilet.lat,
        lng: toilet.lng,
        toilets: [toilet],
      });
    }
  }

  return [...groups.values()];
}

/**
 * 묶음을 목록에 보일 때의 부제.
 *
 * 건물·층·남녀가 있으면 그것이 가장 쓸모 있는 구분이고(같은 좌표라 주소는 다
 * 같다), 없으면 주소로 떨어진다. 둘 다 없으면 null 이라 화면이 아무것도 안 그린다.
 *
 * 성별까지 잇는 이유 — 같은 건물 같은 층에 남/여가 나란히 있으면 앞의 둘로는
 * **두 줄이 완전히 같은 글자가 된다.**
 */
export function toiletSubtitle(toilet: MappableToilet): string | null {
  const place = [
    toilet.building,
    toilet.floor,
    genderLabel(toilet.gender),
  ].filter(Boolean);
  if (place.length > 0) return place.join(" · ");
  return toilet.road_address ?? toilet.jibun_address;
}

/**
 * 목록을 청결도 순으로 세운다. 원본은 안 건드린다.
 *
 * **평점이 있는 곳이 먼저**, 그 안에서 높은 순. 평점이 없는 곳은 **원래 순서
 * 그대로** 뒤에 붙는다(`Array.prototype.sort` 는 안정 정렬이다).
 *
 * 무평점을 `0` 으로 취급해 섞지 않는 이유 — 그러면 "아직 아무도 평가하지 않은
 * 곳"이 "나쁘다고 평가된 곳"과 같은 자리에 놓인다. ToiletListSheet 가 무평점에
 * 배지를 아예 안 그리는 것과 같은 판단이다.
 *
 * `ratings` 는 그룹이 열릴 때 받아 오므로 **몇백 ms 뒤에 채워진다.** 그동안은
 * 전부 무평점이라 입력 순서가 그대로 보이고, 값이 오면 한 번 다시 정렬된다.
 * 로딩 상태를 따로 만들지 않는다 — 캠퍼스 목록은 몇 줄이고 지금은 대부분
 * 평점이 없어 순서가 바뀌지 않는다.
 */
export function sortByRating(
  toilets: MappableToilet[],
  ratings: Map<string, number>,
): MappableToilet[] {
  return [...toilets].sort((a, b) => {
    const ratingA = ratings.get(a.id);
    const ratingB = ratings.get(b.id);
    if (ratingA === undefined && ratingB === undefined) return 0;
    if (ratingA === undefined) return 1;
    if (ratingB === undefined) return -1;
    return ratingB - ratingA;
  });
}
