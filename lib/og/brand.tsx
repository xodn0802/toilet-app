import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * OG 이미지와 아이콘이 함께 쓰는 것들.
 *
 * 색은 **리터럴로 적는다.** 이 그림들은 브라우저가 아니라 빌드 때 satori 가
 * 그리는 것이라 globals.css 의 CSS 변수가 여기서는 풀리지 않는다. 카카오 SDK 에
 * 넘기는 색(`ToiletMap` 의 `ROUTE_COLOR`, `lib/map/toilet-marker.ts` 의 `BODY`)과
 * 같은 예외이고, `--brand` 를 바꾸면 여기도 같이 고쳐야 한다.
 *
 * 라이트 모드 값을 쓴다. 링크 미리보기와 앱 아이콘에는 다크 모드가 없다.
 */
export const OG_BRAND = "#2e7d6b";
export const OG_BRAND_INK = "#ffffff";

/** 워드마크 아래 붙는 설명 줄. 흰색을 옅게 깐 것이라 배경색이 비쳐 보인다. */
export const OG_BRAND_INK_SOFT = "rgba(255, 255, 255, 0.82)";

/**
 * 워드마크 서체. **여기 쓰는 글자만 들어 있는 서브셋이다.**
 *
 * Black Han Sans 전체는 4MB 가 넘어 저장소에 둘 것이 못 된다. 구글 폰트에
 * `text=` 로 요청하면 그 글자만 든 truetype 을 주므로 그것을 받아 넣었다
 * (`assets/`, OFL 라이선스를 옆에 함께 둔다).
 *
 * → **문구를 고치면 폰트를 다시 받아야 한다.** 없는 글자는 에러 없이 빈칸으로
 *   나오므로 렌더해 보기 전에는 모른다. 받는 법:
 *
 *   curl "https://fonts.googleapis.com/css2?family=Black+Han+Sans&text=<쓸 글자 전부>"
 *   → 응답 안 url(...) 을 받아 assets/black-han-sans-subset.ttf 로 저장
 *
 * 화면에서 쓰는 워드마크는 `next/font` 가 따로 받는다(`app/layout.tsx`). 그쪽은
 * 브라우저가 unicode-range 를 보고 필요한 조각만 내려받으므로 서로 무관하다.
 */
export async function wordmarkFont() {
  const data = await readFile(
    join(process.cwd(), "assets/black-han-sans-subset.ttf"),
  );
  return [
    {
      name: "Black Han Sans",
      data,
      style: "normal" as const,
      weight: 400 as const,
    },
  ];
}

/**
 * 브랜드 색 정사각형에 워드마크만 얹은 그림. 아이콘 두 개(`app/icon.tsx`,
 * `app/apple-icon.tsx`)가 크기만 달리해 같은 것을 쓴다.
 */
export async function wordmarkSquare(edge: number) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: OG_BRAND,
        color: OG_BRAND_INK,
        fontFamily: "Black Han Sans",
        // 글자로 면을 꽉 채운다. 작게 줄었을 때 남는 여백은 곧 안 보이는 아이콘이다.
        fontSize: Math.round(edge * 0.74),
        lineHeight: 1,
      }}
    >
      뿡
    </div>,
    { width: edge, height: edge, fonts: await wordmarkFont() },
  );
}
