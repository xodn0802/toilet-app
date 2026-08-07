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

export const metadata: Metadata = {
  title: "뿡 — 가까운 화장실 찾기",
  description:
    "낯선 곳에서 가까운 화장실을 찾고, 청결도·편의시설·이용조건까지 확인하세요.",
  applicationName: "뿡",
  appleWebApp: { capable: true, title: "뿡", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // 지도를 두 손가락으로 확대할 때 페이지까지 같이 확대되면 UI 가 어긋난다.
  maximumScale: 1,
  // 주소창 뒤까지 배경을 채워 앱처럼 보이게 한다.
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
    <html lang="ko" className={`h-full antialiased ${wordmark.variable}`}>
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
      </body>
    </html>
  );
}
