"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  MAX_COMMENT_LENGTH,
  MAX_PHOTOS,
  REVIEW_TAGS,
  type ReviewDraft,
  type ReviewTag,
} from "@/lib/reviews/types";

import StarRating from "./StarRating";

type Props = {
  signedIn: boolean;
  onSignIn: () => void;
  onSubmit: (draft: ReviewDraft) => void;
};

export default function ReviewForm({ signedIn, onSignIn, onSubmit }: Props) {
  const [cleanliness, setCleanliness] = useState(0);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [comment, setComment] = useState("");
  /** 미리보기용 objectURL. 등록하면 리뷰 쪽으로 소유권이 넘어간다. */
  const [photos, setPhotos] = useState<string[]>([]);

  // objectURL 은 해제하지 않으면 탭을 닫을 때까지 메모리에 남는다. 등록하지
  // 않고 시트를 닫은 경우에만 남아 있으므로, 사라질 때 그것만 정리한다.
  const pendingPhotos = useRef<string[]>([]);
  useEffect(() => {
    pendingPhotos.current = photos;
  }, [photos]);
  useEffect(() => () => pendingPhotos.current.forEach(URL.revokeObjectURL), []);

  function toggleTag(tag: ReviewTag) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((it) => it !== tag) : [...prev, tag],
    );
  }

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const room = MAX_PHOTOS - photos.length;
    setPhotos((prev) => [
      ...prev,
      ...files.slice(0, room).map((file) => URL.createObjectURL(file)),
    ]);
    // 같은 파일을 지웠다가 다시 고를 수 있게 입력값을 비운다.
    event.target.value = "";
  }

  function removePhoto(url: string) {
    URL.revokeObjectURL(url);
    setPhotos((prev) => prev.filter((it) => it !== url));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (cleanliness === 0) return;

    onSubmit({
      cleanliness,
      tags,
      comment: comment.trim() || null,
      photos,
    });

    setCleanliness(0);
    setTags([]);
    setComment("");
    // 여기서 revoke 하지 않는다. 방금 등록한 리뷰가 같은 URL 을 쓰고 있다.
    setPhotos([]);
  }

  const fields = (
    <>
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

      <p className="mt-3 text-sm font-medium">
        사진 <span className="text-muted">(선택, 최대 {MAX_PHOTOS}장)</span>
      </p>
      <ul className="mt-1.5 flex gap-2">
        {photos.map((photo) => (
          <li key={photo} className="relative">
            {/* blob: URL 이라 next/image 최적화를 태울 수 없다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt=""
              className="h-20 w-20 rounded-xl object-cover"
            />
            <button
              type="button"
              onClick={() => removePhoto(photo)}
              aria-label="사진 빼기"
              className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-ink/80 text-sm leading-none text-surface"
            >
              ×
            </button>
          </li>
        ))}

        {photos.length < MAX_PHOTOS && (
          <li>
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-line text-2xl text-muted hover:border-brand hover:text-brand">
              +<span className="sr-only">사진 추가</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={addPhotos}
                className="sr-only"
              />
            </label>
          </li>
        )}
      </ul>

      <button
        type="submit"
        disabled={cleanliness === 0}
        className="mt-4 w-full rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink hover:bg-brand-strong disabled:bg-sunken disabled:text-muted"
      >
        {cleanliness === 0 ? "청결도를 골라주세요" : "리뷰 등록하기"}
      </button>
    </>
  );

  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold">리뷰 쓰기</h3>

      {signedIn ? (
        <form onSubmit={handleSubmit} className="mt-2">
          {fields}
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-2 w-full rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink hover:bg-brand-strong"
          >
            로그인하고 리뷰 남기기
          </button>
          <p className="mt-2 text-xs text-muted">
            읽는 데는 로그인이 필요 없어요. 남길 때만 필요합니다.
          </p>

          {/* 무엇을 쓰게 되는지 미리 보여준다. 손은 닿지 않는다. */}
          <div
            inert
            aria-hidden
            className="mt-3 select-none opacity-40 blur-[1.5px]"
          >
            {fields}
          </div>
        </>
      )}
    </section>
  );
}
