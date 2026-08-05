"use client";

import { useState, type FormEvent } from "react";

import { gateLabel, type ReviewGate } from "@/lib/reviews/eligibility";
import {
  MAX_COMMENT_LENGTH,
  REVIEW_TAGS,
  type ReviewDraft,
  type ReviewTag,
} from "@/lib/reviews/types";

import StarRating from "./StarRating";

type Props = {
  /** 쓸 수 있는 상태인지. 막혀 있으면 그 이유가 버튼에 그대로 나온다. */
  gate: ReviewGate;
  /** 저장에 실패하면 던진다. 폼이 그 메시지를 보여주고 내용은 그대로 둔다. */
  onSubmit: (draft: ReviewDraft) => Promise<void>;
};

/**
 * 로그인 절차가 없다. 신원은 등록을 누르는 순간 만들어지므로
 * (lib/auth/use-identity.ts) 폼이 잠겨 있을 이유가 없다.
 */
export default function ReviewForm({ gate, onSubmit }: Props) {
  const [cleanliness, setCleanliness] = useState(0);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(tag: ReviewTag) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((it) => it !== tag) : [...prev, tag],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (cleanliness === 0 || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ cleanliness, tags, comment: comment.trim() || null });

      // **성공했을 때만 비운다.** 실패했는데 적은 내용이 날아가면 다시 안 쓴다.
      setCleanliness(0);
      setTags([]);
      setComment("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "리뷰를 저장하지 못했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const blocked = gateLabel(gate);
  const disabled = blocked !== null || submitting || cleanliness === 0;

  const buttonLabel =
    blocked ??
    (submitting
      ? "등록하는 중…"
      : cleanliness === 0
        ? "청결도를 골라주세요"
        : "리뷰 등록하기");

  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold">리뷰 쓰기</h3>

      <form onSubmit={handleSubmit} className="mt-2">
        <p className="text-sm font-medium">청결도</p>
        <div className="mt-1.5">
          <StarRating
            value={cleanliness}
            onChange={setCleanliness}
            size="lg"
            label="청결도"
          />
        </div>

        <p className="mt-4 text-sm font-medium">
          본 것만 골라주세요 <span className="text-muted">(선택)</span>
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-2">
          {REVIEW_TAGS.map((tag) => {
            const on = tags.includes(tag.value);
            return (
              <li key={tag.value}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTag(tag.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    on
                      ? "border-brand-soft-line bg-brand-soft font-medium text-brand-soft-ink"
                      : "border-line text-muted hover:border-muted"
                  }`}
                >
                  <span aria-hidden>{tag.emoji}</span> {tag.label}
                </button>
              </li>
            );
          })}
        </ul>

        <label
          htmlFor="review-comment"
          className="mt-4 block text-sm font-medium"
        >
          한마디 <span className="text-muted">(선택)</span>
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          rows={3}
          placeholder="다음 사람이 알면 좋을 것을 남겨주세요"
          className="mt-1.5 w-full resize-none rounded-xl border border-line bg-sunken px-3 py-2.5 text-sm placeholder:text-muted focus:border-brand focus:bg-surface focus:outline-none"
        />
        <p className="mt-1 text-right text-xs text-muted">
          {comment.length}/{MAX_COMMENT_LENGTH}
        </p>

        {error && (
          <p className="mt-3 rounded-xl bg-signal-soft px-3 py-2.5 text-sm text-signal-soft-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={disabled}
          className="mt-4 w-full rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink hover:bg-brand-strong disabled:bg-sunken disabled:text-muted"
        >
          {buttonLabel}
        </button>

        {/* 익명이라는 사실은 숨기지 않는다. 이름이 남지 않는다고 알면 더 솔직해진다. */}
        <p className="mt-2 text-xs text-muted">
          로그인 없이 남길 수 있어요 · 이름 대신 별명으로 표시됩니다
        </p>
      </form>
    </section>
  );
}
