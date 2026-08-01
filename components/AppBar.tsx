"use client";

import type { AuthStatus } from "@/lib/auth/use-auth";

type Props = {
  /**
   * 화장실이 몇 곳인지 알리는 문구. 아직 못 불러왔으면 null.
   *
   * 문구를 여기서 조립하지 않는 이유: 기준점이 있느냐 없느냐에 따라 말이
   * 달라지는데, 그 판단은 위치 상태를 아는 쪽(ToiletMap)에 있어야 한다.
   * 조립은 lib/toilets/nearby.ts 의 nearbyLabel 이 한다.
   */
  label: string | null;
  /**
   * 불리언 대신 세 값을 받는 이유는 "아직 모름"이 있기 때문이다. 저장된 세션을
   * 읽는 건 비동기라, 모름을 로그아웃으로 치면 로그인 버튼이 떴다가 사라진다.
   */
  auth: AuthStatus;
  /** 카카오 닉네임. 동의를 거부했을 수 있어 로그인 상태여도 null 일 수 있다. */
  nickname: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
};

export default function AppBar({
  label,
  auth,
  nickname,
  onSignIn,
  onSignOut,
}: Props) {
  return (
    <header className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-surface/95 py-2 pr-2 pl-4 shadow-[0_2px_16px_rgba(20,35,31,0.16)] backdrop-blur-sm">
      <p className="flex min-w-0 items-baseline gap-2">
        <span className="font-wordmark text-2xl leading-none text-brand">
          뿡
        </span>
        {/* 앱 이름 옆은 설명을 적기 좋은 자리지만, 셀 수 있는 것을 적으면 더 쓸모 있다. */}
        <span className="truncate text-sm text-muted">
          {label ?? "불러오는 중…"}
        </span>
      </p>

      {auth === "loading" ? (
        // 자리만 잡아 둔다. 비워 두면 버튼이 나타날 때 앱바 높이가 튄다.
        <span aria-hidden className="ml-auto h-9 w-9 shrink-0" />
      ) : auth === "in" ? (
        <button
          type="button"
          onClick={onSignOut}
          aria-label={`${nickname ?? "내 계정"} · 로그아웃`}
          className="ml-auto flex min-w-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 hover:bg-sunken"
        >
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink"
          >
            {nickname?.[0] ?? "나"}
          </span>
          {/* 닉네임을 보여야 "내 계정으로 들어왔다"를 눈으로 확인할 수 있다. */}
          {nickname && (
            <span className="max-w-20 truncate text-sm">{nickname}</span>
          )}
          <span className="shrink-0 text-sm text-muted">로그아웃</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onSignIn}
          className="ml-auto shrink-0 rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-sunken"
        >
          로그인
        </button>
      )}
    </header>
  );
}
