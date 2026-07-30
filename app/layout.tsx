import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "뿡 — 가까운 화장실 찾기",
  description:
    "낯선 곳에서 가까운 화장실을 찾고, 청결도·편의시설·이용조건까지 확인하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="h-full flex flex-col">{children}</body>
    </html>
  );
}
