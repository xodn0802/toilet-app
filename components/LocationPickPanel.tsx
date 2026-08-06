"use client";

import type { ReverseGeocodeResult } from "@/lib/map/reverse-geocode";

type Props = {
  /** 주소를 읽는 중. 지도를 움직일 때마다 다시 읽는다. */
  loading: boolean;
  /** 못 읽었으면 road·jibun 이 둘 다 null 이다. */
  address: ReverseGeocodeResult | null;
  /** 50m 안에 이미 등록된 화장실이 있으면 그 이름. 막지는 않는다. */
  duplicateName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function LocationPickPanel({
  loading,
  address,
  duplicateName,
  onConfirm,
  onCancel,
}: Props) {
  const found = address && (address.road || address.jibun);

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-surface px-5 pt-4 pb-6 shadow-sheet">
      <p className="text-sm font-semibold">화장실 위치를 맞춰주세요</p>
      <p className="mt-0.5 text-xs text-muted">
        지도를 움직여 핀을 화장실 위에 두세요
      </p>

      <div className="mt-3 min-h-14 rounded-xl bg-sunken px-3.5 py-2.5">
        {loading ? (
          <p className="text-sm text-muted">주소를 읽는 중…</p>
        ) : found ? (
          <>
            <p className="text-sm font-medium">
              {address.road ?? address.jibun}
            </p>
            {/* 도로명이 있으면 지번을 아래에 같이 둔다. 상가는 지번으로 아는 곳이 많다. */}
            {address.road && address.jibun && (
              <p className="mt-0.5 text-xs text-muted">{address.jibun}</p>
            )}
          </>
        ) : (
          // 주소를 못 읽어도 막지 않는다. 좌표만으로도 검토는 할 수 있고,
          // 여기서 되돌리면 건물 없는 공원 화장실을 아예 못 올린다.
          <p className="text-sm text-muted">
            주소를 못 읽었어요 · 좌표로 접수됩니다
          </p>
        )}
      </div>

      {duplicateName && (
        <p className="mt-2 text-xs text-signal">
          이미 등록된 곳일 수 있어요 · {duplicateName}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-xl border border-line px-4 py-3 text-sm font-medium text-muted hover:bg-sunken"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink hover:bg-brand-strong"
        >
          이 위치로
        </button>
      </div>
    </div>
  );
}
