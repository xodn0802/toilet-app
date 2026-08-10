import { ImageResponse } from "next/og";

import {
  OG_BRAND,
  OG_BRAND_INK,
  OG_BRAND_INK_SOFT,
  wordmarkFont,
} from "@/lib/og/brand";

/**
 * 링크를 붙였을 때 뜨는 카드 그림.
 *
 * 에브리타임에 주소만 올리면 지금은 밋밋한 링크 한 줄이다. 첫인상이 그것뿐이라
 * 눌러 볼 이유가 되지 않는다.
 *
 * 그림은 빌드 때 한 번 만들어져 정적으로 서빙된다 — 요청마다 그리지 않는다.
 */
export const alt = "뿡 — 가까운 화장실 찾기";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: OG_BRAND,
        color: OG_BRAND_INK,
        fontFamily: "Black Han Sans",
      }}
    >
      <div style={{ fontSize: 230, lineHeight: 1 }}>뿡</div>
      <div style={{ fontSize: 66, marginTop: 28 }}>가까운 화장실 찾기</div>
      <div style={{ fontSize: 32, marginTop: 30, color: OG_BRAND_INK_SOFT }}>
        전국 공중화장실 · 청결도 리뷰 · 도보 안내
      </div>
    </div>,
    { ...size, fonts: await wordmarkFont() },
  );
}
