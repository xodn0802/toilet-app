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
  | { status: "error"; toilet: MappableToilet; message: string };
