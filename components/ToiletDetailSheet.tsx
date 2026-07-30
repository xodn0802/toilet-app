"use client";

import {
  formatDistance,
  formatDuration,
  type WalkRoute,
} from "@/lib/route/types";
import type { MappableToilet } from "@/lib/toilets/types";

type Props = {
  toilet: MappableToilet;
  /** 이 화장실까지의 도보 경로. 아직 길찾기를 안 했으면 null. */
  route: WalkRoute | null;
  loading: boolean;
  /** 현재 위치를 못 받았으면 출발지가 없어 길찾기를 할 수 없다. */
  canNavigate: boolean;
  onNavigate: () => void;
  onClose: () => void;
};

/** 값이 없는 필드는 빈칸으로 두지 않고 "정보 없음"으로 표시한다. */
const UNKNOWN = "정보 없음";

function formatUnisex(unisex: boolean | null): string {
  if (unisex === null) return UNKNOWN;
  return unisex ? "남녀공용" : "남녀분리";
}

/** 변기 수를 "남 대변기 3 · 소변기 5 / 여 대변기 5" 형태로 한 줄에 담는다. */
function formatToiletCounts(toilet: MappableToilet): string {
  const male: string[] = [];
  if (toilet.male_toilet_count !== null) {
    male.push(`대변기 ${toilet.male_toilet_count}`);
  }
  if (toilet.male_urinal_count !== null) {
    male.push(`소변기 ${toilet.male_urinal_count}`);
  }

  const parts: string[] = [];
  if (male.length > 0) parts.push(`남 ${male.join(" · ")}`);
  if (toilet.female_toilet_count !== null) {
    parts.push(`여 대변기 ${toilet.female_toilet_count}`);
  }

  return parts.length > 0 ? parts.join(" / ") : UNKNOWN;
}

export default function ToiletDetailSheet({
  toilet,
  route,
  loading,
  canNavigate,
  onNavigate,
  onClose,
}: Props) {
  const rows: { label: string; value: string }[] = [
    {
      label: "주소",
      value: toilet.road_address ?? toilet.jibun_address ?? UNKNOWN,
    },
    { label: "남녀공용", value: formatUnisex(toilet.unisex) },
    { label: "개방시간", value: toilet.open_hours ?? UNKNOWN },
    { label: "변기 수", value: formatToiletCounts(toilet) },
    {
      label: "좌표",
      value: `${toilet.lat.toFixed(5)}, ${toilet.lng.toFixed(5)}`,
    },
  ];

  // 경로를 받아온 뒤에만 거리·소요시간을 알 수 있다.
  if (route) {
    rows.splice(1, 0, {
      label: "거리",
      value: `${formatDistance(route.distanceMeters)} · ${formatDuration(
        route.durationSeconds,
      )}`,
    });
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border-t border-zinc-200 bg-white p-5 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">{toilet.name}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="상세 닫기"
          className="-mt-1 -mr-1 shrink-0 rounded-full p-2 text-2xl leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
        >
          ×
        </button>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex gap-3">
            <dt className="w-20 shrink-0 text-zinc-500">{label}</dt>
            <dd className="flex-1">{value}</dd>
          </div>
        ))}
      </dl>

      {/* 경로가 이미 지도에 그려져 있으면 다시 부를 이유가 없어 버튼을 감춘다. */}
      {!route && (
        <button
          type="button"
          onClick={onNavigate}
          disabled={loading || !canNavigate}
          className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {loading
            ? "경로를 찾는 중…"
            : canNavigate
              ? "길찾기"
              : "현재 위치를 알 수 없어 길찾기를 할 수 없습니다"}
        </button>
      )}
    </div>
  );
}
