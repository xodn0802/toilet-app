"use client";

import type { RouteState } from "@/lib/route/state";
import { formatDistance, formatDuration } from "@/lib/route/types";

type Props = {
  /** idle 이 아닌 상태만 받는다. 배너는 길찾기가 시작된 뒤에만 뜬다. */
  state: Exclude<RouteState, { status: "idle" }>;
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

export default function RouteBanner({ state, onCancel }: Props) {
  const isError = state.status === "error";

  return (
    <div
      className={`m-3 flex items-center gap-3 rounded-xl px-4 py-3 text-white shadow-lg ${
        isError ? "bg-red-600" : "bg-blue-600"
      }`}
    >
      <span aria-hidden className="text-xl leading-none">
        {isError ? "!" : "→"}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{state.toilet.name}</p>
        <p className="truncate text-sm text-white/80">{subtitle(state)}</p>
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30"
      >
        취소
      </button>
    </div>
  );
}
