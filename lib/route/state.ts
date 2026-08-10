import type { MappableToilet } from "@/lib/toilets/types";

import type { WalkRoute } from "./types";

/**
 * 길찾기 진행 상태. 대상 화장실을 상태 안에 같이 담아두면
 * "어느 화장실로 가는 경로인지"를 따로 들고 다니지 않아도 된다.
 */
export type RouteState =
  | { status: "idle" }
  | { status: "loading"; toilet: MappableToilet }
  | { status: "ready"; toilet: MappableToilet; route: WalkRoute }
  /**
   * 도보 경로를 못 받아 직선으로 대신 안내하는 상태.
   *
   * TMAP 은 하루 1,000건이 무료다. 그 한도를 넘기거나 TMAP 이 잠깐 죽으면
   * 예전에는 오류 문구만 남고 화면에 아무것도 안 그려졌다 — **급한 사람이
   * 방향조차 모르게 된다.** 직선거리는 이쪽에서 계산하는 값이라 남의 서비스가
   * 어떻든 항상 나오므로, 못 받았을 때는 여기로 떨어진다.
   *
   * 그래서 실패 상태가 따로 없다. 오류 문구는 대신 이 상태의 안내 문구가 된다.
   *
   * 소요 시간은 담지 않는다. 직선거리로 시간을 지어내면 실제 걸어야 하는 길이
   * 돌아갈 때 없는 정밀도를 말하게 된다.
   */
  | {
      status: "straight";
      toilet: MappableToilet;
      /** 계산에 쓴 출발지. 지도를 옮겨도 그린 선과 숫자가 어긋나지 않는다. */
      origin: { lat: number; lng: number };
      distanceMeters: number;
    };
