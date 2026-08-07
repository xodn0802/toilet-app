"use client";

import { useEffect, useState } from "react";

import Icon, { type IconName } from "./Icons";

/**
 * 화면 테마 3단. 지금까지는 OS 설정만 따라가서 앱 안에서 바꿀 방법이 없었다.
 *
 * **2단이 아니라 3단인 이유** — 라이트/다크 둘뿐이면 한 번 고른 뒤 "OS 를
 * 따라간다"는 원래 동작으로 돌아올 방법이 없다. 시스템은 값이 아니라
 * `data-theme` 속성이 없는 상태로 표현된다(globals.css 의 color-scheme 참고).
 */

const KEY = "theme";

type Choice = "light" | "dark" | "system";

const OPTIONS: { value: Choice; label: string; icon: IconName }[] = [
  { value: "light", label: "라이트", icon: "lightMode" },
  { value: "dark", label: "다크", icon: "darkMode" },
  { value: "system", label: "시스템", icon: "settings" },
];

function apply(choice: Choice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);

  // 사파리 비공개 모드처럼 저장이 막힌 곳에서도 이번 화면은 바뀌어야 한다.
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* 저장만 못 할 뿐이다 */
  }
}

export default function ThemeToggle() {
  /*
    서버는 저장값을 모른다. 마운트 전에는 아무것도 안 고른 얼굴로 그려야
    hydration 이 어긋나지 않는다. 색 자체는 layout.tsx 의 인라인 스크립트가
    첫 페인트 전에 이미 맞춰 두므로 화면이 번쩍이지는 않는다 — 잠깐 어긋나는
    것은 어느 칸이 켜져 보이느냐 뿐이다.
  */
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    // localStorage 가 아니라 DOM 을 읽는다. 인라인 스크립트가 이미 해석해
    // 놓았으므로 판단 기준을 두 곳에 두지 않는다.
    const applied = document.documentElement.getAttribute("data-theme");
    setChoice(applied === "light" || applied === "dark" ? applied : "system");
  }, []);

  return (
    <div className="border-t border-line px-5 pt-4 pb-5">
      <p id="theme-label" className="text-label text-muted">
        화면 테마
      </p>

      <div
        role="radiogroup"
        aria-labelledby="theme-label"
        className="mt-2 flex gap-1 rounded-xl bg-sunken p-1"
      >
        {OPTIONS.map((option) => {
          const on = choice === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                apply(option.value);
                setChoice(option.value);
              }}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs transition-colors ${
                on
                  ? "bg-surface font-bold text-brand shadow-chip"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Icon name={option.icon} className="h-[18px] w-[18px]" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
