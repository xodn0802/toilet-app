"use client";

import { useState } from "react";

import type { ReviewGate } from "@/lib/reviews/eligibility";
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
import { genderLabel, type MappableToilet } from "@/lib/toilets/types";

import CleanlinessMeter from "./CleanlinessMeter";
import Icon from "./Icons";
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
  /** 이 화장실의 리뷰. 아직 조회 중이면 undefined. */
  reviews: Review[] | undefined;
  /** 리뷰를 쓸 수 있는 상태인지. 판정은 lib/reviews/eligibility.ts 가 한다. */
  gate: ReviewGate;
  /** 이 브라우저의 별명. 아직 신원이 없으면 null. */
  nickname: string | null;
  onSubmitReview: (draft: ReviewDraft) => Promise<void>;
  onNavigate: () => void;
  /** 같은 좌표에 한 곳을 더 제보한다. 다른 층·다른 성별이 여기로 들어온다. */
  onAdd: () => void;
  onClose: () => void;
};

export default function ToiletDetailSheet({
  toilet,
  route,
  loading,
  canNavigate,
  distanceMeters,
  reviews,
  gate,
  nickname,
  onSubmitReview,
  onNavigate,
  onAdd,
  onClose,
}: Props) {
  // 접힌 상태에서는 지도가 계속 보인다. 급할 때는 여기까지만 보고 길찾기를 누른다.
  const [expanded, setExpanded] = useState(false);

  // 조회 중에는 "리뷰 없음"이라고 단정하지 않는다. 잠깐 그렇게 떴다가 숫자가
  // 바뀌면 어느 쪽이 맞는지 알 수 없다.
  const loaded = reviews ?? [];
  const average = averageCleanliness(loaded);

  // 값(별점)은 배지가, 개수는 이 줄이 맡는다. 한 줄에 섞여 있던 것을 나눴다.
  const reviewLabel =
    reviews === undefined
      ? "리뷰 불러오는 중…"
      : loaded.length === 0
        ? "리뷰 없음"
        : `리뷰 ${loaded.length}개`;

  // 건물·층·남녀. 사용자 등록분에만 있다(0004·0005 마이그레이션).
  const place =
    [toilet.building, toilet.floor, genderLabel(toilet.gender)]
      .filter(Boolean)
      .join(" · ") || null;

  // 길찾기를 하고 나면 실제 도보 거리를 알게 되므로 직선거리는 물러난다.
  const distanceLabel = route
    ? `${formatDistance(route.distanceMeters)} · ${formatDuration(route.durationSeconds)}`
    : distanceMeters !== null
      ? `직선 ${formatDistance(distanceMeters)}`
      : null;

  return (
    /*
      좁은 화면에서는 아래에서 올라오는 시트, 넓은 화면에서는 지도 위에 뜬 카드다.
      컴포넌트를 둘로 쪼개지 않고 반응형 클래스만 얹는다 — 두 벌로 만들면 한쪽만
      고쳐지는 날이 온다(`dark:` 를 금지한 이유와 같다). 내용·순서·문구는 같다.

      데스크톱에는 접기/펼치기가 없다. 세로가 충분해서 접을 이유가 없고, 지도는
      카드 옆으로 계속 보인다. 그래서 expanded 는 사실상 모바일 전용 state 다.
    */
    <div
      className={`absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-3xl bg-surface shadow-sheet transition-[max-height] duration-300 ease-out lg:inset-x-auto lg:top-20 lg:bottom-auto lg:left-4 lg:max-h-[calc(100%-7rem)] lg:w-[400px] lg:rounded-2xl lg:shadow-float ${
        expanded ? "max-h-[88%]" : "max-h-64"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={expanded ? "상세 접기" : "상세 펼치기"}
        className="shrink-0 pt-2.5 pb-1 lg:hidden"
      >
        <span className="mx-auto block h-1 w-10 rounded-full bg-line" />
      </button>

      {/* 핸들이 없는 데스크톱에서는 위 여백을 여기서 낸다. */}
      <div className="shrink-0 px-5 pb-4 lg:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl leading-tight font-semibold">
                {toilet.name}
              </h2>
              <span className="shrink-0 rounded-md bg-sunken px-1.5 py-0.5 text-xs text-muted">
                {toilet.source === "public" ? "공공" : "사용자"}
              </span>
            </div>

            {/*
              건물·층은 이름 바로 아래, 접힌 시트에서도 보이는 자리에 둔다.
              같은 좌표에 층별로 여러 행이 있을 때 이름이 전부 같으므로(목록
              시트에서 넘어온 경우) 여기가 "어느 것을 열었는지"를 말하는 유일한
              자리다. 공공데이터 행은 둘 다 null 이라 아무것도 안 그린다.
            */}
            {place && (
              <p className="mt-1 truncate text-sm font-medium text-brand">
                {place}
              </p>
            )}

            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
              <span>{reviewLabel}</span>
              {distanceLabel && (
                <>
                  <span aria-hidden>·</span>
                  <span>{distanceLabel}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {/*
              평균 별점을 회색 한 줄에서 빼내 배지로 세운다. 접힌 시트에서 이
              값이 "여기 들어갈지 말지"를 가르는 유일한 판단 재료다.
            */}
            {average !== null && (
              <span
                aria-label={`평균 청결도 5점 만점에 ${average.toFixed(1)}점`}
                className="flex items-center gap-0.5 rounded-lg bg-brand px-2 py-1 text-sm font-semibold text-brand-ink"
              >
                {average.toFixed(1)}
                <span aria-hidden>★</span>
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="상세 닫기"
              className="-mt-1 -mr-1 rounded-full p-2 text-muted hover:bg-sunken hover:text-ink"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink hover:bg-brand-strong disabled:bg-sunken disabled:text-muted"
            >
              {canNavigate && !loading && (
                <Icon name="directions" className="h-5 w-5" />
              )}
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
            className="shrink-0 rounded-xl border border-line px-4 py-3 text-sm font-medium text-muted hover:bg-sunken lg:hidden"
          >
            {expanded ? "접기" : "더보기"}
          </button>
        </div>
      </div>

      <div
        className={`min-h-0 flex-1 px-5 pb-8 lg:overflow-y-auto lg:overscroll-contain ${
          expanded ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
        }`}
      >
        <ToiletFacts toilet={toilet} reviews={loaded} />

        {/*
          목록 시트에도 같은 버튼이 있다. **양쪽에 있어야 하는 이유** — 한 좌표에
          한 곳뿐이면 목록을 건너뛰고 바로 이 시트가 뜬다. 캠퍼스에 첫 화장실이
          막 등록된 건물이 정확히 그 상태라, 목록에만 두면 "여자 화장실을 추가할
          입구"가 그 건물에서 사라진다.

          리뷰 아래가 아니라 시설 정보 바로 뒤인 이유 — 여기가 "이 자리에 무엇이
          있는지"를 말하는 자리고, 빠진 것을 알아채는 것도 이 대목이다.
        */}
        <section className="mt-6">
          <button
            type="button"
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-4 py-3 text-sm font-medium text-muted hover:border-brand hover:text-brand"
          >
            <Icon name="add" className="h-5 w-5" />이 위치에 화장실 추가
          </button>
          <p className="mt-1.5 text-center text-xs text-muted">
            같은 건물의 다른 층·다른 성별이 빠져 있다면 알려주세요
          </p>
        </section>

        <CleanlinessMeter reviews={reviews} />

        <ReviewForm gate={gate} nickname={nickname} onSubmit={onSubmitReview} />

        <section className="mt-6">
          <h3 className="text-label text-muted">리뷰 {loaded.length}</h3>
          <ReviewList reviews={loaded} />
        </section>
      </div>

      {/* 접힌 상태에서 잘린 내용이 그냥 끊긴 게 아니라 이어진다는 표시. */}
      {!expanded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface to-transparent lg:hidden" />
      )}
    </div>
  );
}
