"use client";

import { MenuButton } from "./SideNav";

type Props = {
  /**
   * 화장실이 몇 곳인지 알리는 문구. 아직 못 불러왔으면 null.
   *
   * 문구를 여기서 조립하지 않는 이유: 기준점이 있느냐 없느냐에 따라 말이
   * 달라지는데, 그 판단은 위치 상태를 아는 쪽(ToiletMap)에 있어야 한다.
   * 조립은 lib/toilets/nearby.ts 의 nearbyLabel 이 한다.
   */
  label: string | null;
  /** 이 브라우저의 별명. 리뷰를 한 번도 안 썼으면 null(= 아직 신원이 없다). */
  nickname: string | null;
};

/**
 * 로그인 버튼이 없다. 신원은 리뷰를 등록하는 순간 조용히 만들어지므로
 * (lib/auth/use-identity.ts) 로그인할 자리 자체가 없다.
 *
 * 대신 신원이 생기면 별명을 여기에 띄운다. 내 글이 어떤 이름으로 남는지는
 * 알아야 하고, 리뷰를 쓰는 순간 칩이 생기는 것 자체가 "지금 신원이 만들어졌다"를
 * 말해 준다.
 */
export default function AppBar({ label, nickname }: Props) {
  return (
    <header className="pointer-events-auto flex w-full items-center gap-2 rounded-2xl bg-surface/95 px-4 py-2.5 shadow-float backdrop-blur-sm">
      {/* 데스크톱에서는 사이드바가 이미 보이므로 이 버튼도 워드마크도 필요 없다. */}
      <MenuButton />

      <p className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="font-wordmark text-2xl leading-none text-brand lg:hidden">
          뿡
        </span>
        {/* 앱 이름 옆은 설명을 적기 좋은 자리지만, 셀 수 있는 것을 적으면 더 쓸모 있다. */}
        <span className="truncate text-sm text-muted">
          {label ?? "불러오는 중…"}
        </span>
      </p>

      {/*
        별명이 길면 문구 쪽을 줄이는 게 아니라 별명을 줄인다 — 문구는 이미 truncate 다.
        데스크톱에서는 사이드바가 같은 별명을 계속 보여주므로 여기서는 감춘다.
      */}
      {nickname && (
        <span className="max-w-28 shrink-0 truncate rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-soft-ink lg:hidden">
          {nickname}
        </span>
      )}
    </header>
  );
}
