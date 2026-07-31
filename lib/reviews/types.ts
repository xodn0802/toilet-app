/**
 * 리뷰 타입과 표시용 유틸.
 *
 * reviews 테이블(supabase/migrations/0001_init.sql)에 필드명을 맞춰 두었다.
 * 다만 nickname·photos 는 아직 그 테이블에 없다 — 백엔드를 붙일 때 각각
 * 작성자 프로필 조인과 review_photos 조회로 채운다.
 */

export type ReviewTag =
  "tissue" | "soap" | "bidet" | "hot_water" | "accessible";

/**
 * 폼의 칩 순서이자 집계 표시 순서.
 *
 * DB 의 tags 는 text[] 라서 값 검증을 하지 않는다(스키마 주석 참고).
 * 그래서 이 배열이 유효한 태그의 유일한 정의다.
 */
export const REVIEW_TAGS: { value: ReviewTag; label: string; emoji: string }[] =
  [
    { value: "tissue", label: "휴지", emoji: "🧻" },
    { value: "soap", label: "비누", emoji: "🧼" },
    { value: "bidet", label: "비데", emoji: "💦" },
    { value: "hot_water", label: "온수", emoji: "♨️" },
    { value: "accessible", label: "장애인", emoji: "♿" },
  ];

export type Review = {
  id: string;
  toilet_id: string;
  nickname: string;
  /** 1~5. */
  cleanliness: number;
  tags: ReviewTag[];
  comment: string | null;
  /** 화면에 바로 넣을 수 있는 이미지 URL. */
  photos: string[];
  created_at: string;
};

/** 폼이 만들어 넘기는 값. id·작성자·시각은 저장하는 쪽이 채운다. */
export type ReviewDraft = Pick<
  Review,
  "cleanliness" | "tags" | "comment" | "photos"
>;

export const MAX_COMMENT_LENGTH = 500;

/** README P0-6 은 5장이지만, 급할 때 올리는 사진이라 3장이면 충분하다. */
export const MAX_PHOTOS = 3;

/** 리뷰가 없으면 평균이 정의되지 않는다. 0.0 으로 보여주면 "더럽다"로 읽힌다. */
export function averageCleanliness(reviews: Review[]): number | null {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, review) => sum + review.cleanliness, 0);
  return total / reviews.length;
}

/** 그 태그를 남긴 사람 수. "12명 중 9명이 휴지가 있다고 함"의 9. */
export function countTag(reviews: Review[], tag: ReviewTag): number {
  return reviews.filter((review) => review.tags.includes(tag)).length;
}

/**
 * "3일 전". idea.md 의 신선도 관리 — 오래된 리뷰일수록 덜 믿게 만드는 표시다.
 * 그래서 절대 시각이 아니라 경과 시간으로 쓴다.
 */
export function formatRelativeTime(
  iso: string,
  now: number = Date.now(),
): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);

  if (days < 1) return "오늘";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}
