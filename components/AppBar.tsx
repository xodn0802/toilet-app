"use client";

type Props = {
  /** 지도에 올라간 화장실 수. 아직 못 불러왔으면 null. */
  toiletCount: number | null;
  signedIn: boolean;
  onToggleSignIn: () => void;
};

export default function AppBar({
  toiletCount,
  signedIn,
  onToggleSignIn,
}: Props) {
  return (
    <header className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-surface/95 py-2 pr-2 pl-4 shadow-[0_2px_16px_rgba(20,35,31,0.16)] backdrop-blur-sm">
      <p className="flex min-w-0 items-baseline gap-2">
        <span className="font-wordmark text-2xl leading-none text-brand">
          뿡
        </span>
        {/* 앱 이름 옆은 설명을 적기 좋은 자리지만, 셀 수 있는 것을 적으면 더 쓸모 있다. */}
        <span className="truncate text-sm text-muted">
          {toiletCount === null ? "불러오는 중…" : `주변 ${toiletCount}곳`}
        </span>
      </p>

      {signedIn ? (
        <button
          type="button"
          onClick={onToggleSignIn}
          className="ml-auto flex shrink-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 hover:bg-sunken"
        >
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink"
          >
            나
          </span>
          <span className="text-sm text-muted">로그아웃</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggleSignIn}
          className="ml-auto shrink-0 rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-sunken"
        >
          로그인
        </button>
      )}
    </header>
  );
}
