"use client";

import type { RouteState } from "@/lib/route/state";
import { formatDistance, formatDuration } from "@/lib/route/types";
import { GUIDE_CANDIDATE_COUNT, type GuidePick } from "@/lib/toilets/pick-best";

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
  /**
   * 「바로 안내」가 고른 곳일 때만 온다. 사용자가 마커를 직접 누른 경우에는
   * 없다 — 자기가 고른 곳에 왜 그 곳인지를 설명할 이유가 없다.
   */
  reason?: GuidePick["reason"];
  onCancel: () => void;
};

const REASON_LABEL: Record<GuidePick["reason"], string> = {
  cleanest: `가까운 ${GUIDE_CANDIDATE_COUNT}곳 중 가장 깨끗한 곳`,
  nearest: "가장 가까운 곳",
};

function subtitle(state: Props["state"]): string {
  switch (state.status) {
    case "loading":
      return "경로를 찾는 중입니다…";
    /*
      "직선" 을 앞에 붙여 ready 의 "240m · 도보 4분" 과 한눈에 갈리게 한다.
      소요 시간은 적지 않는다 — 직선거리로 시간을 지어내면 실제로는 돌아가야
      하는 길을 짧게 말하게 된다.
    */
    case "straight":
      return `직선 ${formatDistance(state.distanceMeters)}`;
    case "ready":
      return `${formatDistance(state.route.distanceMeters)} · ${formatDuration(
        state.route.durationSeconds,
      )}`;
  }
}

export default function RouteBanner({
  state,
  originUncertain = false,
  reason,
  onCancel,
}: Props) {
  const isStraight = state.status === "straight";

  return (
    // 아이콘·버튼 배경은 bg-current/15 로 글자색에서 뜬다. 밝은 배너 위에서는
    // 밝게, 어두운 배너 위에서는 어둡게 잡혀 어느 쪽이든 대비가 남는다.
    <div className="flex items-center gap-3 rounded-2xl bg-brand px-4 py-3 text-brand-ink shadow-float">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-current/15 text-lg leading-none"
      >
        →
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{state.toilet.name}</p>
        <p className="truncate text-sm opacity-80">{subtitle(state)}</p>
        {/*
          왜 직선인지. 이 줄이 없으면 점선을 실제 경로로 읽고, 직선거리를
          걸어야 하는 거리로 읽는다. 둘 다 실제보다 짧다.
        */}
        {isStraight && (
          <p className="truncate text-xs opacity-80">
            도보 경로를 못 받아 방향만 표시합니다
          </p>
        )}
        {/* 왜 이 곳으로 보냈는지. 버튼이 대신 고른 것이므로 근거가 보여야 한다. */}
        {reason && (
          <p className="truncate text-xs opacity-80">{REASON_LABEL[reason]}</p>
        )}
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
