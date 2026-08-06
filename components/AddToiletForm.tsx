"use client";

import { useState, type FormEvent } from "react";

import type { ReverseGeocodeResult } from "@/lib/map/reverse-geocode";
import {
  ACCESS_OPTIONS,
  FACILITY_OPTIONS,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_OPEN_HOURS_LENGTH,
  type AccessType,
  type Facility,
  type SubmissionDraft,
} from "@/lib/toilets/submission";

import Icon from "./Icons";

type Props = {
  /** 앞 단계에서 고른 위치. 여기서는 안 바뀐다. */
  position: { lat: number; lng: number };
  address: ReverseGeocodeResult;
  /** 던지면 폼이 그대로 남고 에러만 뜬다. */
  onSubmit: (draft: SubmissionDraft) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
};

/** 칩 버튼. 리뷰 폼과 같은 모양이어야 같은 앱으로 읽힌다. */
function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        on
          ? "border-brand-soft-line bg-brand-soft font-medium text-brand-soft-ink"
          : "border-line text-muted hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}

const INPUT_CLASS =
  "mt-1.5 w-full rounded-xl border border-line bg-sunken px-3 py-2.5 text-sm placeholder:text-muted focus:border-brand focus:bg-surface focus:outline-none";

/** 남녀공용은 3단이다. 2단으로 만들면 안 고른 사람이 전부 "아니오"가 된다. */
const UNISEX_OPTIONS: { value: boolean | null; label: string }[] = [
  { value: true, label: "예" },
  { value: false, label: "아니오" },
  { value: null, label: "모름" },
];

export default function AddToiletForm({
  position,
  address,
  onSubmit,
  onBack,
  onClose,
}: Props) {
  const [name, setName] = useState("");
  const [access, setAccess] = useState<AccessType | null>(null);
  const [openHours, setOpenHours] = useState("");
  const [unisex, setUnisex] = useState<boolean | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [note, setNote] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggleFacility(value: Facility) {
    setFacilities((prev) =>
      prev.includes(value)
        ? prev.filter((it) => it !== value)
        : [...prev, value],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending || !name.trim()) return;

    setSending(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        lat: position.lat,
        lng: position.lng,
        road_address: address.road,
        jibun_address: address.jibun,
        access,
        open_hours: openHours.trim() || null,
        unisex,
        facilities,
        note: note.trim() || null,
      });
      setDone(true);
    } catch (err) {
      // 폼은 그대로 둔다. 적은 내용이 날아가면 다시 안 쓴다.
      setError(
        err instanceof Error ? err.message : "추가 요청을 보내지 못했습니다.",
      );
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-surface px-5 pt-8 pb-8 text-center shadow-sheet">
        <Icon name="check" className="h-9 w-9 text-brand" />
        <p className="mt-2 font-semibold">접수됐어요</p>
        {/* 지금 지도에 안 뜨는 이유가 여기서 설명돼야 한다. */}
        <p className="mt-1 text-sm text-muted">
          개발자가 검토한 뒤 지도에 추가하겠습니다
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink hover:bg-brand-strong"
        >
          지도로 돌아가기
        </button>
      </div>
    );
  }

  const addressLabel = address.road ?? address.jibun;

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[88%] flex-col overflow-hidden rounded-t-3xl bg-surface shadow-sheet">
      <div className="shrink-0 pt-2.5 pb-1">
        <span className="mx-auto block h-1 w-10 rounded-full bg-line" />
      </div>

      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">화장실 추가</h2>
          <p className="mt-0.5 truncate text-sm text-muted">
            {addressLabel ?? "주소를 못 읽은 위치 · 좌표로 접수됩니다"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="추가 닫기"
          className="-mt-1 -mr-1 shrink-0 rounded-full p-2 text-muted hover:bg-sunken hover:text-ink"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8"
      >
        <label htmlFor="add-name" className="block text-sm font-medium">
          이름
        </label>
        <input
          id="add-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="예) 스타벅스 인하대점 2층"
          className={INPUT_CLASS}
        />

        <p className="mt-4 text-sm font-medium">
          이용조건 <span className="text-muted">(선택)</span>
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-2">
          {ACCESS_OPTIONS.map((option) => (
            <li key={option.value}>
              {/* 한 번 더 누르면 해제된다. 잘못 고르고 되돌릴 방법이 있어야 한다. */}
              <Chip
                on={access === option.value}
                onClick={() =>
                  setAccess((prev) =>
                    prev === option.value ? null : option.value,
                  )
                }
              >
                {option.label}
              </Chip>
            </li>
          ))}
        </ul>

        <label htmlFor="add-hours" className="mt-4 block text-sm font-medium">
          개방시간 <span className="text-muted">(선택)</span>
        </label>
        <input
          id="add-hours"
          value={openHours}
          onChange={(event) => setOpenHours(event.target.value)}
          maxLength={MAX_OPEN_HOURS_LENGTH}
          placeholder="예) 09:00~22:00, 24시간"
          className={INPUT_CLASS}
        />

        <p className="mt-4 text-sm font-medium">
          남녀공용 <span className="text-muted">(선택)</span>
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-2">
          {UNISEX_OPTIONS.map((option) => (
            <li key={option.label}>
              <Chip
                on={unisex === option.value}
                onClick={() => setUnisex(option.value)}
              >
                {option.label}
              </Chip>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm font-medium">
          편의시설 <span className="text-muted">(선택)</span>
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-2">
          {FACILITY_OPTIONS.map((option) => (
            <li key={option.value}>
              <Chip
                on={facilities.includes(option.value)}
                onClick={() => toggleFacility(option.value)}
              >
                {option.label}
              </Chip>
            </li>
          ))}
        </ul>

        <label htmlFor="add-note" className="mt-4 block text-sm font-medium">
          한마디 <span className="text-muted">(선택)</span>
        </label>
        <textarea
          id="add-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={3}
          placeholder="찾아가는 방법이나 이용 조건을 적어주세요"
          className={`${INPUT_CLASS} resize-none`}
        />
        <p className="mt-1 text-right text-xs text-muted">
          {note.length}/{MAX_NOTE_LENGTH}
        </p>

        {error && (
          <p className="mt-3 rounded-xl bg-signal-soft px-3.5 py-2.5 text-sm text-signal-soft-ink">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={sending}
            className="shrink-0 rounded-xl border border-line px-4 py-3 text-sm font-medium text-muted hover:bg-sunken disabled:text-muted"
          >
            위치 다시
          </button>
          <button
            type="submit"
            disabled={sending || !name.trim()}
            className="flex-1 rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink hover:bg-brand-strong disabled:bg-sunken disabled:text-muted"
          >
            {sending
              ? "보내는 중…"
              : name.trim()
                ? "추가 요청하기"
                : "이름을 적어주세요"}
          </button>
        </div>

        <p className="mt-2 text-center text-xs text-muted">
          바로 지도에 뜨지 않아요. 개발자가 확인한 뒤 추가합니다.
        </p>
      </form>
    </div>
  );
}
