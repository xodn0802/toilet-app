import { wordmarkSquare } from "@/lib/og/brand";

/**
 * iOS 에서 홈 화면에 추가했을 때 쓰는 아이콘. 이것이 없으면 사파리가 화면을
 * 찍어서 아이콘 자리에 넣는다.
 *
 * 애플이 모서리를 알아서 깎으므로 여백 없이 꽉 채워 그린다. 180 은 애플이 요구
 * 하는 크기다 — `app/icon.tsx` 의 512 를 그대로 쓰면 안 된다.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return wordmarkSquare(size.width);
}
