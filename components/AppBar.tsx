"use client";

type Props = {
  /**
   * 화장실이 몇 곳인지 알리는 문구. 아직 못 불러왔으면 null.
   *
   * 문구를 여기서 조립하지 않는 이유: 기준점이 있느냐 없느냐에 따라 말이
   * 달라지는데, 그 판단은 위치 상태를 아는 쪽(ToiletMap)에 있어야 한다.
   * 조립은 lib/toilets/nearby.ts 의 nearbyLabel 이 한다.
   */
  label: string | null;
  signedIn: boolean;
  onToggleSignIn: () => void;
};

export default function AppBar({ label, signedIn, onToggleSignIn }: Props) {
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
