"use client";

import { useState } from "react";

import {
  formatDistance,
  formatDuration,
  type WalkRoute,
} from "@/lib/route/types";
import {
  averageCleanliness,
  type Review,
  type ReviewDraft,
} from "@/lib/reviews/types";
import type { MappableToilet } from "@/lib/toilets/types";

import ReviewForm from "./ReviewForm";
import ReviewList from "./ReviewList";
import ToiletFacts from "./ToiletFacts";

type Props = {
  toilet: MappableToilet;
  /** 이 화장실까지의 도보 경로. 아직 길찾기를 안 했으면 null. */
  route: WalkRoute | null;
  loading: boolean;
  /** 현재 위치를 못 받았으면 출발지가 없어 길찾기를 할 수 없다. */
  canNavigate: boolean;
  /** 현재 위치에서의 직선거리(m). 위치를 못 받았으면 null. */
  distanceMeters: number | null;
  reviews: Review[];
  signedIn: boolean;
  onSignIn: () => void;
  onSubmitReview: (draft: ReviewDraft) => void;
  onNavigate: () => void;
  onClose: () => void;
};

export default function ToiletDetailSheet({
  toilet,
  route,
  loading,
  canNavigate,
  distanceMeters,
  reviews,
  signedIn,
  onSignIn,
  onSubmitReview,
  onNavigate,
  onClose,
}: Props) {
  // 접힌 상태에서는 지도가 계속 보인다. 급할 때는 여기까지만 보고 길찾기를 누른다.
  const [expanded, setExpanded] = useState(false);

  const average = averageCleanliness(reviews);

  // 길찾기를 하고 나면 실제 도보 거리를 알게 되므로 직선거리는 물러난다.
  const distanceLabel = route
    ? `${formatDistance(route.distanceMeters)} · ${formatDuration(route.durationSeconds)}`
    : distanceMeters !== null
      ? `직선 ${formatDistance(distanceMeters)}`
      : null;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-3xl bg-surface shadow-[0_-4px_24px_rgba(20,35,31,0.16)] transition-[max-height] duration-300 ease-out ${
        expanded ? "max-h-[88%]" : "max-h-56"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={expanded ? "상세 접기" : "상세 펼치기"}
        className="shrink-0 pt-2.5 pb-1"
      >
        <span className="mx-auto block h-1 w-10 rounded-full bg-line" />
      </button>

      <div className="shrink-0 px-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{toilet.name}</h2>
              <span className="shrink-0 rounded-md bg-sunken px-1.5 py-0.5 text-xs text-muted">
                {toilet.source === "public" ? "공공" : "사용자"}
              </span>
            </div>

            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
              {average === null ? (
                <span>리뷰 없음</span>
              ) : (
                <>
                  <span aria-hidden className="text-star">
                    ★
                  </span>
                  <span className="font-medium text-ink">
                    {average.toFixed(1)}
                  </span>
                  <span>({reviews.length})</span>
                </>
              )}
              {distanceLabel && (
                <>
                  <span aria-hidden>·</span>
                  <span>{distanceLabel}</span>
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="상세 닫기"
            className="-mt-1 -mr-1 shrink-0 rounded-full p-2 text-2xl leading-none text-muted hover:bg-sunken hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          {/* 경로가 이미 지도에 그려져 있으면 다시 부를 이유가 없다. */}
          {route ? (
            <p className="flex-1 rounded-xl bg-brand-soft px-4 py-3 text-center text-sm font-medium text-brand-soft-ink">
              지도에 경로를 그렸어요
            </p>
          ) : (
            <button
              type="button"
              onClick={onNavigate}
              disabled={loading || !canNavigate}
              className="flex-1 rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink hover:bg-brand-strong disabled:bg-sunken disabled:text-muted"
            >
              {loading
                ? "경로를 찾는 중…"
                : canNavigate
                  ? "길찾기"
                  : "현재 위치를 알 수 없어요"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="shrink-0 rounded-xl border border-line px-4 py-3 text-sm font-medium text-muted hover:bg-sunken"
          >
            {expanded ? "접기" : "더보기"}
          </button>
        </div>
      </div>

      <div
        className={`min-h-0 flex-1 px-5 pb-8 ${
          expanded ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
        }`}
      >
        <ToiletFacts toilet={toilet} reviews={reviews} />

        <ReviewForm
          signedIn={signedIn}
          onSignIn={onSignIn}
          onSubmit={onSubmitReview}
        />

        <section className="mt-6">
          <h3 className="text-sm font-semibold">리뷰 {reviews.length}</h3>
          <ReviewList reviews={reviews} />
        </section>
      </div>

      {/* 접힌 상태에서 잘린 내용이 그냥 끊긴 게 아니라 이어진다는 표시. */}
      {!expanded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface to-transparent" />
      )}
    </div>
  );
}
