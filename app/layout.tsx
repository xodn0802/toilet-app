import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Black_Han_Sans } from "next/font/google";

import SideNav, { SideNavProvider } from "@/components/SideNav";

import "./globals.css";

/*
  워드마크 "뿡" 한 글자에만 쓴다. 본문까지 한글 웹폰트로 바꾸면 첫 화면이 느려지고,
  급할 때 여는 앱에서는 그게 손해다.

  subsets 를 지정하지 않는 이유: next/font 의 폰트 목록에 이 서체는 latin 만
  올라와 있어 subsets:["latin"] 로 받으면 한글 글리프가 빠진다. 비워두면 구글이
  쪼개 둔 88 개 조각을 전부 받아 self-host 하고, 브라우저는 unicode-range 를 보고
  "뿡"이 든 조각 하나만 내려받는다. 대신 preload 는 끄라고 요구한다.
*/
const wordmark = Black_Han_Sans({
  weight: "400",
  preload: false,
  display: "swap",
  variable: "--font-black-han-sans",
});

const TITLE = "뿡 — 가까운 화장실 찾기";
const DESCRIPTION =
  "낯선 곳에서 가까운 화장실을 찾고, 청결도·편의시설·이용조건까지 확인하세요.";

export const metadata: Metadata = {
  /*
    OG 태그의 이미지 주소는 절대 경로여야 한다. 이 값이 없으면 상대 경로로 나가고,
    링크를 긁는 쪽은 그것을 못 읽어 미리보기가 통째로 빈다.

    프로덕션 주소를 박아 둔다 — 배포별 URL 로 미리보기가 뜨면 그 주소는 다음
    배포에 사라지고, 카카오 지도도 그 도메인에서는 안 뜬다(CLAUDE.md 참고).
  */
  metadataBase: new URL("https://toilet-app-azure.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "뿡",
  appleWebApp: { capable: true, title: "뿡", statusBarStyle: "default" },
  // 그림은 app/opengraph-image.tsx 가 만든다. 여기서 다시 가리키지 않아도
  // Next 가 og:image 를 채운다.
  openGraph: {
    type: "website",
    siteName: "뿡",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "ko_KR",
  },
  // 큰 카드로 보여 달라는 뜻. 이 줄이 없으면 일부 서비스가 작은 썸네일로 만다.
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  // 지도를 두 손가락으로 확대할 때 페이지까지 같이 확대되면 UI 가 어긋난다.
  maximumScale: 1,
  // 주소창 뒤까지 배경을 채워 앱처럼 보이게 한다.
  // 여기는 OS 설정으로만 갈린다 — 앱 안에서 테마를 직접 고르면 주소창 색은
  // 안 따라온다. 화면 안은 data-theme 로 맞으므로 그대로 둔다.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f5f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1412" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`h-full antialiased ${wordmark.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          첫 페인트 전에 저장해 둔 테마를 붙인다. useEffect 로 미루면 라이트로
          한 번 칠해진 뒤 다크로 바뀌어 흰 화면이 번쩍인다.

          속성을 안 붙이는 경우가 "시스템"이다 — globals.css 의 color-scheme 이
          `light dark` 라 그때 OS 설정을 따라간다. 그래서 여기서도 저장값이
          있을 때만 붙이고, 없으면 아무것도 하지 않는다.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      {/*
        body 에 세로 flex 를 두지 않는다. 사이드바는 fixed 라 자리를 차지하지
        않고, 본문은 lg:ml-64 로 비켜설 뿐이다. flex 사슬을 만들면 지도까지
        이어지는 h-full 이 무너져 흰 화면이 된다(CLAUDE.md "지도 레이아웃 주의").
      */}
      <body className="h-full overscroll-none">
        <SideNavProvider>
          <SideNav />
          <div className="h-full lg:ml-64">{children}</div>
        </SideNavProvider>
        {/*
          방문 통계. 하루에 몇 명이 오는지, 어디서 들어왔는지(referrer)를 보려는
          것이다 — 에브리타임 홍보가 실제로 사람을 데려오는지 이걸로만 알 수 있다.

          쿠키를 쓰지 않고 개인을 식별하지 않는다. 그래서 동의 배너가 없다.
          Vercel 대시보드에서 Web Analytics 를 켜야 실제로 쌓인다. 로컬·프리뷰
          에서는 스크립트가 요청을 보내지 않으므로 개발 중에는 아무 일도 안 한다.
        */}
        <Analytics />
      </body>
    </html>
  );
}
