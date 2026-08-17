"use client";

import { useMemo } from "react";

import {
  sortByRating,
  toiletSubtitle,
  type ToiletGroup,
} from "@/lib/toilets/cluster";
import type { MappableToilet } from "@/lib/toilets/types";

import Icon from "./Icons";

/**
 * 한 좌표에 겹친 화장실 목록.
 *
 * 겹침을 좌표 보정으로 풀 수는 없다 — 원 데이터의 주소가 부지 단위라 실제로 같은
 * 지점이 맞다(lib/toilets/cluster.ts). 그래서 마커를 하나로 줄이고, 누르면 그
 * 안에 무엇이 있는지 여기서 보여준다.
 *
 * 캠퍼스 시드에서는 이 목록이 그대로 **층 목록**이 된다. 건물 좌표 하나에 층별
 * 행이 붙기 때문이다.
 *
 * 배치 규칙은 ToiletDetailSheet 과 같다 — 모바일은 하단 시트, lg 부터는 왼쪽
 * 400px 카드. 같은 자리에서 상세로 바뀌므로 두 컴포넌트의 기하가 어긋나면
 * 화면이 튄다.
 */

type Props = {
  group: ToiletGroup;
  /** 화장실별 평균 청결도. 리뷰가 없는 곳은 아예 들어 있지 않다. */
  ratings: Map<string, number>;
  onSelect: (toilet: MappableToilet) => void;
  /** 같은 좌표에 한 곳을 더 제보한다. 다른 층·다른 성별이 여기로 들어온다. */
  onAdd: () => void;
  onClose: () => void;
};

export default function ToiletListSheet({
  group,
  ratings,
  onSelect,
  onAdd,
  onClose,
}: Props) {
  // 별점은 목록이 열린 뒤에 도착하므로 한 번 다시 정렬된다. 로딩 표시를 두지
  // 않는 이유는 sortByRating 주석에 있다.
  const sorted = useMemo(
    () => sortByRating(group.toilets, ratings),
    [group, ratings],
  );

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[70%] flex-col overflow-hidden rounded-t-3xl bg-surface shadow-sheet lg:inset-x-auto lg:top-20 lg:bottom-auto lg:left-4 lg:max-h-[calc(100%-7rem)] lg:w-[400px] lg:rounded-2xl lg:shadow-float">
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h2 className="text-xl leading-tight font-semibold">
            이 위치에 {group.toilets.length}곳
          </h2>
          {/*
            같은 좌표라 주소는 전부 같다. 한 번만 적고 목록에서는 뺀다 —
            줄마다 같은 주소가 반복되면 정작 다른 값(건물·층)이 안 보인다.
          */}
          <p className="mt-1 truncate text-sm text-muted">
            {group.toilets[0].road_address ??
              group.toilets[0].jibun_address ??
              "주소 정보 없음"}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="목록 닫기"
          className="-mt-1 -mr-1 shrink-0 rounded-full p-2 text-muted hover:bg-sunken hover:text-ink"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
        {sorted.map((toilet) => {
          const average = ratings.get(toilet.id);
          // 건물·층이 있으면 그것, 없으면 주소. 위 헤더가 이미 주소를 말했으므로
          // 여기서 주소가 또 나오면 중복이지만, 그때는 이 화장실을 구분할 다른
          // 단서가 없다 — 공공데이터 행들이 여기 해당한다.
          const subtitle =
            toilet.building || toilet.floor ? toiletSubtitle(toilet) : null;

          return (
            <li key={toilet.id}>
              <button
                type="button"
                onClick={() => onSelect(toilet)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-sunken"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {toilet.name}
                  </span>
                  {subtitle && (
                    <span className="mt-0.5 block truncate text-sm text-muted">
                      {subtitle}
                    </span>
                  )}
                </span>

                {/*
                  리뷰가 없으면 아무것도 안 그린다. 0.0 이나 "-" 를 두면 "아직
                  평가가 없는 곳"이 "나쁘게 평가된 곳"으로 읽힌다.
                */}
                {average !== undefined && (
                  <span
                    aria-label={`평균 청결도 5점 만점에 ${average.toFixed(1)}점`}
                    className="flex shrink-0 items-center gap-0.5 rounded-lg bg-brand px-2 py-1 text-sm font-semibold text-brand-ink"
                  >
                    {average.toFixed(1)}
                    <span aria-hidden>★</span>
                  </span>
                )}

                <Icon
                  name="chevronRight"
                  className="h-5 w-5 shrink-0 text-muted"
                />
              </button>
            </li>
          );
        })}
      </ul>

      {/*
        목록 아래가 아니라 **고정된 발판**에 둔다. 71곳이 쌓인 좌표에서는 끝까지
        스크롤해야 보이는 버튼이 없는 것과 같고, 빠진 층을 발견하는 사람은 대개
        목록 위쪽을 훑다가 알아챈다.

        점선 테두리는 시설 칩과 같은 말을 한다 — "아직 채워지지 않은 칸".
      */}
      <div className="shrink-0 border-t border-line px-5 py-4">
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-4 py-3 text-sm font-medium text-muted hover:border-brand hover:text-brand"
        >
          <Icon name="add" className="h-5 w-5" />이 위치에 화장실 추가
        </button>
      </div>
    </div>
  );
}
