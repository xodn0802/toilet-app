/**
 * 개발용 가짜 리뷰.
 *
 * ⚠️ 실제 리뷰가 아닙니다. 백엔드(P0 5·7번)를 붙일 때 이 파일을 지우고
 * Supabase 의 reviews 조회로 바꾼다.
 *
 * 화장실 id 는 gen_random_uuid() 가 만들어서 미리 알 수 없다. 그래서 고정
 * 목록을 두지 않고 id 를 시드로 삼아 생성한다 — 같은 화장실이면 새로고침해도
 * 같은 리뷰가 나오고, 실제 데이터가 들어와 id 가 바뀌어도 그대로 동작한다.
 */

import { REVIEW_TAGS, type Review } from "./types";

const NICKNAMES = ["민수", "지연", "태우", "하영", "준호", "소라", "동현"];

const COMMENTS = [
  "휴지 있고 깨끗해요. 급할 때 추천합니다.",
  "문이 잠겨 있을 때가 있어요. 관리실에 물어봐야 합니다.",
  "칸이 두 개뿐이라 대기가 좀 있었어요.",
  "생각보다 관리가 잘 되어 있습니다.",
  "비누가 비어 있었어요. 물티슈 챙기세요.",
  "밤에는 조명이 어둡습니다.",
  "넓고 환기가 잘 돼요.",
];

/** FNV-1a. 문자열을 32비트 정수로 접어 난수 시드로 쓴다. */
function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32. Math.random 과 달리 시드가 같으면 같은 수열이 나온다. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(items: T[], random: () => number): T =>
  items[Math.floor(random() * items.length)];

export function mockReviewsFor(toiletId: string): Review[] {
  const random = makeRandom(seedFrom(toiletId));

  // 0건도 나오게 둔다. 리뷰가 없는 화장실의 빈 화면도 확인해야 한다.
  const count = Math.floor(random() * 5);

  return Array.from({ length: count }, (_, index) => {
    const daysAgo = 1 + Math.floor(random() * 40);

    return {
      id: `mock-${toiletId}-${index}`,
      toilet_id: toiletId,
      nickname: pick(NICKNAMES, random),
      cleanliness: 2 + Math.floor(random() * 4),
      tags: REVIEW_TAGS.filter(() => random() < 0.45).map((tag) => tag.value),
      comment: random() < 0.8 ? pick(COMMENTS, random) : null,
      photos: [],
      created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    };
  });
}
