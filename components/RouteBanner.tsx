"use client";

import type { RouteState } from "@/lib/route/state";
import { formatDistance, formatDuration } from "@/lib/route/types";

type Props = {
  /** idle 이 아닌 상태만 받는다. 배너는 길찾기가 시작된 뒤에만 뜬다. */
  state: Exclude<RouteState, { status: "idle" }>;
  /**
   * 현재 위치의 오차가 커서 경로의 출발지를 믿을 수 없는 상태.
   *
   * 거리·소요시간은 그 출발지에서 계산된 값이라 같이 틀린다. 길찾기 자체를
   * 막지는 않지만 숫자를 그대로 두면 사용자가 맞는 줄 안다.
   */
  originUncertain?: boolean;
  onCancel: () => void;
};

function subtitle(state: Props["state"]): string {
  switch (state.status) {
    case "loading":
      return "경로를 찾는 중입니다…";
    case "error":
      return state.message;
    case "ready":
      return `${formatDistance(state.route.distanceMeters)} · ${formatDuration(
        state.route.durationSeconds,
      )}`;
  }
}

export default function RouteBanner({
  state,
  originUncertain = false,
  onCancel,
}: Props) {
  const isError = state.status === "error";

  // 아이콘·버튼 배경은 bg-current/15 로 글자색에서 뜬다. 밝은 배너 위에서는
  // 밝게, 어두운 배너 위에서는 어둡게 잡혀 어느 쪽이든 대비가 남는다.
  const tone = isError ? "bg-signal text-white" : "bg-brand text-brand-ink";

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-float ${tone}`}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-current/15 text-lg leading-none"
      >
        {isError ? "!" : "→"}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{state.toilet.name}</p>
        <p className="truncate text-sm opacity-80">{subtitle(state)}</p>
        {originUncertain && (
          <p className="truncate text-xs opacity-80">
            현재 위치가 부정확해 출발지가 다를 수 있습니다
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded-lg bg-current/15 px-3 py-1.5 text-sm hover:bg-current/25"
      >
        취소
      </button>
    </div>
  );
}
