import type { MetadataRoute } from "next";

/**
 * 홈 화면에 추가했을 때의 모습.
 *
 * 급할 때 여는 앱이라 주소창을 거쳐 들어오는 단계가 하나라도 적은 편이 낫다.
 * `standalone` 이면 홈 화면 아이콘에서 바로 지도가 뜬다.
 *
 * 아이콘은 `app/icon.tsx` 가 만든 것을 그대로 가리킨다. 같은 그림을 파일로 한 번
 * 더 두면 둘이 서서히 어긋난다.
 *
 * 색은 `app/layout.tsx` 의 `viewport.themeColor` 라이트 값과 같아야 한다 —
 * 둘 다 globals.css 의 `--paper` 라이트 값이다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "뿡 — 가까운 화장실 찾기",
    short_name: "뿡",
    description:
      "낯선 곳에서 가까운 화장실을 찾고, 청결도·편의시설·이용조건까지 확인하세요.",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f5f3",
    theme_color: "#f2f5f3",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
