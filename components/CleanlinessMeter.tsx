"use client";

import { averageCleanliness, type Review } from "@/lib/reviews/types";

/**
 * 평균 청결도를 5칸 막대와 한마디로 보여준다.
 *
 * 숫자만으로는 4.0 이 좋다는 뜻인지 알기 어렵다. 별점 배지가 헤더에서 값을
 * 말하고, 여기서는 그 값이 무슨 뜻인지를 말한다.
 *
 * 리뷰가 0건인 지금은 이게 거의 모든 화장실의 기본 화면이다. 그래서 빈 상태를
 * "없음"으로 끝내지 않고 5칸을 회색으로 그려 둔다 — 채워질 자리가 보이면
 * 비어 있다는 사실이 고장이 아니라 초대로 읽힌다.
 */

/** 반올림한 점수(1~5)에 대응한다. */
const LABELS = ["나쁨", "아쉬움", "보통", "깨끗", "아주 깨끗"];

const SEGMENTS = 5;

export default function CleanlinessMeter({
  reviews,
}: {
  /** 아직 조회 중이면 undefined. []("진짜 없음")와 구분해야 한다. */
  reviews: Review[] | undefined;
}) {
  const average = reviews ? averageCleanliness(reviews) : null;
  const filled = average === null ? 0 : Math.round(average);

  const note =
    reviews === undefined
      ? "불러오는 중…"
      : average === null
        ? "아직 평가 없음"
        : LABELS[filled - 1];

  return (
    <section className="mt-6">
      <h3 className="text-label text-muted">청결도</h3>

      <div className="mt-2 flex items-center gap-3">
        <div
          className="flex flex-1 gap-1"
          role="img"
          aria-label={
            average === null
              ? note
              : `5점 만점에 ${average.toFixed(1)}점 · ${note}`
          }
        >
          {Array.from({ length: SEGMENTS }, (_, index) => (
            <span
              key={index}
              className={`h-2 flex-1 rounded-full ${
                index < filled ? "bg-brand" : "bg-line"
              }`}
            />
          ))}
        </div>

        <span
          className={`shrink-0 text-sm ${
            average === null ? "text-muted" : "font-medium"
          }`}
        >
          {note}
        </span>
      </div>
    </section>
  );
}
