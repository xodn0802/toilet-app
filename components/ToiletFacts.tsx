"use client";

import { countTag, REVIEW_TAGS, type Review } from "@/lib/reviews/types";
import type { MappableToilet } from "@/lib/toilets/types";

/**
 * 화장실 정보를 출처별로 두 덩어리로 나눠 보여준다.
 *
 * 나누는 이유: 공공데이터는 장애인 화장실·기저귀 교환대·변기 수까지만 알려주고,
 * 휴지·비누·비데·온수는 아예 수집하지 않는다. 그건 다녀온 사람의 리뷰 태그로만
 * 알 수 있다. 한 칸에 섞어 놓으면 "기관이 보증한 값"과 "누가 그렇다고 한 값"이
 * 구분되지 않아, 헛걸음의 책임 소재가 사라진다.
 */

type Props = {
  toilet: MappableToilet;
  reviews: Review[];
};

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

/**
 * 있음 / 없음 / 정보 없음의 3상태.
 *
 * 공공데이터에는 빈 값이 흔하다. null 을 "없음"으로 표시하면 실제로는 있는
 * 장애인 화장실을 없다고 말하게 된다. 없는 것과 모르는 것은 구분한다.
 */
function FacilityCard({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: boolean | null;
}) {
  const tone =
    value === true
      ? "border-brand-soft-line bg-brand-soft text-brand-soft-ink"
      : "border-line bg-sunken text-muted";

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tone}`}>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <span aria-hidden>{emoji}</span>
        {label}
      </p>
      <p className="mt-0.5 text-xs">
        {value === null ? UNKNOWN : value ? "있음" : "없음"}
      </p>
    </div>
  );
}

export default function ToiletFacts({ toilet, reviews }: Props) {
  const rows = [
    { label: "남녀", value: formatUnisex(toilet.unisex) },
    { label: "변기", value: formatToiletCounts(toilet) },
    { label: "개방시간", value: toilet.open_hours ?? UNKNOWN },
    {
      label: "주소",
      value: toilet.road_address ?? toilet.jibun_address ?? UNKNOWN,
    },
  ];

  return (
    <>
      <section>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">시설 정보</h3>
          <span className="text-xs text-muted">공공데이터</span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <FacilityCard
            emoji="♿"
            label="장애인 화장실"
            value={toilet.has_disabled_toilet}
          />
          <FacilityCard
            emoji="🍼"
            label="기저귀 교환대"
            value={toilet.has_diaper_table}
          />
        </div>

        <dl className="mt-3 space-y-1.5 text-sm">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex gap-3">
              <dt className="w-16 shrink-0 text-muted">{label}</dt>
              <dd className="flex-1">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">이용자 확인</h3>
          <span className="text-xs text-muted">
            {reviews.length > 0 ? `리뷰 ${reviews.length}개 기준` : "리뷰 없음"}
          </span>
        </div>

        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            휴지·비누처럼 공공데이터에 없는 정보는 다녀온 사람이 남겨야
            채워집니다.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {REVIEW_TAGS.map((tag) => {
              const count = countTag(reviews, tag.value);
              return (
                <li
                  key={tag.value}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    count > 0
                      ? "border-brand-soft-line bg-brand-soft text-brand-soft-ink"
                      : "border-line bg-sunken text-muted"
                  }`}
                >
                  <span aria-hidden>{tag.emoji}</span> {tag.label}{" "}
                  <span className="font-semibold">{count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
