"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useIdentity } from "@/lib/auth/use-identity";

import Icon, { type IconName } from "./Icons";
import ThemeToggle from "./ThemeToggle";

/**
 * 앱 전체의 왼쪽 메뉴.
 *
 * 데스크톱(lg 이상)에서는 화면 왼쪽에 항상 붙어 있고, 모바일에서는 앱바의
 * 메뉴 버튼으로 여는 드로어가 된다. **컴포넌트는 하나다** — 둘로 쪼개면 두 벌이
 * 서서히 어긋난다(globals.css 가 `dark:` 를 금지한 이유와 같다).
 *
 * 화면 높이는 fixed 로 잡는다. body 에 세로 flex 사슬을 새로 만들면 지도까지
 * 이어지는 h-full 이 무너져 흰 화면이 된다(CLAUDE.md "지도 레이아웃 주의").
 */

type SideNavApi = {
  open: boolean;
  setOpen: (next: boolean) => void;
};

const SideNavContext = createContext<SideNavApi | null>(null);

/** 여는 쪽(앱바의 메뉴 버튼)과 열리는 쪽(사이드바)이 떨어져 있어 문맥으로 잇는다. */
export function SideNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <SideNavContext.Provider value={value}>{children}</SideNavContext.Provider>
  );
}

function useSideNav(): SideNavApi {
  const api = useContext(SideNavContext);
  if (!api) throw new Error("SideNavProvider 안에서만 쓸 수 있습니다.");
  return api;
}

/** 모바일에서 드로어를 여는 버튼. 데스크톱에는 사이드바가 이미 보이므로 감춘다. */
export function MenuButton({ className = "" }: { className?: string }) {
  const { open, setOpen } = useSideNav();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="메뉴 열기"
      aria-expanded={open}
      aria-controls="sidenav"
      className={`-ml-1 shrink-0 rounded-full p-1.5 text-muted hover:bg-sunken hover:text-ink lg:hidden ${className}`}
    >
      <Icon name="menu" className="h-5 w-5" />
    </button>
  );
}

type Item = {
  href: string;
  label: string;
  icon: IconName;
  /** 이 경로에 있을 때 켜진 것으로 표시한다. 동작(등록)은 켜질 자리가 없어 null. */
  activePath: string | null;
};

/**
 * 있는 기능만 넣는다. Stitch 초안에는 Saved·Report Issue·Settings 도 있지만
 * 즐겨찾기(P1)와 신고(P0 6번과 함께)는 아직 없어서 누르면 아무 일도 안 난다.
 *
 * "화장실 등록"이 별도 라우트가 아닌 이유 — 지도를 다른 페이지로 옮기면 지도가
 * 다시 만들어져 보던 위치·축척을 잃는다. 등록은 지도 위에 얹는 모드다.
 */
const ITEMS: Item[] = [
  { href: "/", label: "지도", icon: "map", activePath: "/" },
  {
    href: "/?add=1",
    label: "화장실 등록",
    icon: "addLocation",
    activePath: null,
  },
  { href: "/about", label: "소개", icon: "info", activePath: "/about" },
];

export default function SideNav() {
  const { open, setOpen } = useSideNav();
  const pathname = usePathname();
  const identity = useIdentity();

  // 드로어가 열려 있을 때만 듣는다. 데스크톱에서는 open 이 계속 false 라
  // (사이드바가 상태와 무관하게 보인다) 리스너가 붙지 않는다.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="메뉴 닫기"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <nav
        id="sidenav"
        aria-label="주요 메뉴"
        /*
          닫혀 있을 때 invisible 을 함께 주는 이유: 화면 밖으로 밀어내기만 하면
          링크가 그대로 탭 순서에 남아 보이지 않는 곳으로 포커스가 들어간다.
          visibility 는 전환이 끝난 뒤에 감춰지므로 슬라이드는 그대로 보인다.
        */
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-surface transition-[transform,visibility] duration-200 ease-out lg:z-40 lg:w-64 lg:visible lg:translate-x-0 ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex items-start gap-2 border-b border-line px-5 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-2">
              <span className="font-wordmark text-2xl leading-none text-brand">
                뿡
              </span>
              <span className="truncate text-sm text-muted">
                가까운 화장실 찾기
              </span>
            </p>

            {/*
              프로필이 없는 앱이다. 신원은 리뷰를 등록하는 순간 조용히 생기므로
              (lib/auth/use-identity.ts) 여기 이름이 나타나는 것 자체가 "지금
              신원이 만들어졌다"를 말해 준다. 그 전에는 무엇이 생길지 알린다.
            */}
            <p className="mt-2 truncate text-xs">
              {identity.who ? (
                <span className="rounded-full bg-brand-soft px-2.5 py-1 font-medium text-brand-soft-ink">
                  {identity.who.nickname}
                </span>
              ) : (
                <span className="text-muted">리뷰를 남기면 별명이 생겨요</span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
            className="-mt-1 -mr-2 rounded-full p-2 text-muted hover:bg-sunken hover:text-ink lg:hidden"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <ul className="mt-2">
          {ITEMS.map((item) => {
            const active =
              item.activePath !== null && pathname === item.activePath;
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 border-r-4 px-5 py-3 text-sm transition-colors ${
                    active
                      ? "border-brand bg-brand-soft font-bold text-brand-soft-ink"
                      : "border-transparent text-muted hover:bg-sunken hover:text-ink"
                  }`}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Stitch 초안의 Settings 자리. 지금 여기서 고를 것은 테마 하나다. */}
        <div className="mt-auto">
          <ThemeToggle />
        </div>
      </nav>
    </>
  );
}
