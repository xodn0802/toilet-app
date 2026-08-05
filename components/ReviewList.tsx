"use client";

import {
  formatRelativeTime,
  REVIEW_TAGS,
  type Review,
  type ReviewTag,
} from "@/lib/reviews/types";

import StarRating from "./StarRating";

const TAG_LABEL = new Map<ReviewTag, string>(
  REVIEW_TAGS.map((tag) => [tag.value, `${tag.emoji} ${tag.label}`]),
);

export default function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <div className="py-10 text-center">
        <p aria-hidden className="text-3xl">
          💬
        </p>
        <p className="mt-2 text-sm font-medium">아직 리뷰가 없어요</p>
        <p className="mt-1 text-sm text-muted">
          다녀오셨다면 첫 번째 리뷰를 남겨주세요
        </p>
      </div>
    );
  }

  return (
    <ul>
      {reviews.map((review) => (
        <li
          key={review.id}
          className="border-t border-line py-4 first:border-t-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{review.nickname}</span>
            <StarRating value={review.cleanliness} />
            <span className="ml-auto text-xs text-muted">
              {formatRelativeTime(review.created_at)}
            </span>
          </div>

          {review.comment && (
            <p className="mt-1.5 text-sm leading-relaxed">{review.comment}</p>
          )}

          {review.tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {review.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-sunken px-2.5 py-1 text-xs text-muted"
                >
                  {TAG_LABEL.get(tag) ?? tag}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
