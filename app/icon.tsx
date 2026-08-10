import { wordmarkSquare } from "@/lib/og/brand";

/**
 * 탭·북마크 아이콘. 기본 `favicon.ico` 는 Next.js 가 넣어 준 것이라 다른 앱과
 * 구분되지 않았다 — 지웠고 이 파일이 그 자리를 대신한다.
 *
 * 512 로 만드는 이유는 `app/manifest.ts` 가 이 그림을 홈 화면 아이콘으로 함께
 * 쓰기 때문이다. 단색 두 개짜리라 크기를 키워도 몇 KB 다.
 */
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return wordmarkSquare(size.width);
}
