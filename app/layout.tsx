import type { Metadata, Viewport } from "next";
import { Black_Han_Sans } from "next/font/google";
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
      <body className="flex h-full flex-col overscroll-none">{children}</body>
    </html>
  );
}
