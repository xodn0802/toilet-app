"use client";

import { useCallback, useEffect, useState } from "react";

import { straightLineDistance } from "@/lib/geo/distance";
import {
  reverseGeocode,
  type ReverseGeocodeResult,
} from "@/lib/map/reverse-geocode";
import { MARKER_Z, toiletMarkerImage } from "@/lib/map/toilet-marker";
import { submitToilet } from "@/lib/toilets/submit-toilet";
import type { MappableToilet } from "@/lib/toilets/types";

import AddToiletForm from "./AddToiletForm";
import LocationPickPanel from "./LocationPickPanel";

/**
 * 이 거리 안에 이미 등록된 곳이 있으면 알려준다(m).
 *
 * 막지는 않는다 — 건물이 같아도 층이 다르면 다른 화장실이다. 개발자가 검토할
 * 중복 제보를 줄이려는 안내일 뿐이다.
 */
const DUPLICATE_RADIUS_M = 50;

type Position = { lat: number; lng: number };

type Step =
  /** 지도를 움직여 화면 중앙 핀을 화장실에 맞추는 중. */
  | { kind: "pick" }
  /**
   * 위치를 확정하고 정보를 적는 중.
   *
   * `building` 은 폼의 건물칸 초기값이다. 넘겨받은 좌표로 바로 열었을 때만 값이
   * 있고, 지도에서 직접 고른 위치는 항상 null 이다 — 핀을 옮겼는데 앞 건물
   * 이름이 그대로 남아 있으면 다른 건물을 그 이름으로 제보하게 된다.
   */
  | {
      kind: "form";
      position: Position;
      address: ReverseGeocodeResult;
      building: string | null;
    };

/**
 * 이미 등록된 화장실에서 「이 위치에 화장실 추가」로 들어올 때 넘어오는 값.
 *
 * **역지오코딩을 하지 않는다** — 좌표가 같으면 주소도 같으므로 그 행이 이미
 * 들고 있는 주소를 그대로 쓴다. 호출도, 기다림도 없다.
 */
export type AddSeed = {
  lat: number;
  lng: number;
  address: ReverseGeocodeResult;
  /** 폼의 건물칸 초기값. 행에 building 이 없으면 null 이다. */
  building: string | null;
};

type Props = {
  map: kakao.maps.Map;
  /** 중복 안내용. 지금 화면에 있는 것만 보므로 완벽하지 않다. */
  toilets: MappableToilet[];
  /**
   * 좌표를 이미 아는 채로 열렸는지. 있으면 **핀 맞추기를 건너뛰고 폼부터** 연다.
   *
   * 목록이나 상세에서 들어온 학생은 그 건물 좌표를 이미 보고 있다. 거기서 다시
   * 지도를 끌어 핀을 맞추게 하면 처음부터 다시 하는 셈이고, 그 마찰이 제보를
   * 그만두게 만든다.
   */
  seed?: AddSeed | null;
  onClose: () => void;
};

export default function AddToilet({ map, toilets, seed, onClose }: Props) {
  const [step, setStep] = useState<Step>(() =>
    seed
      ? {
          kind: "form",
          position: { lat: seed.lat, lng: seed.lng },
          address: seed.address,
          building: seed.building,
        }
      : { kind: "pick" },
  );

  /** 지금 화면 한가운데. idle 마다 갱신한다. */
  const [center, setCenter] = useState<Position>(() => {
    const latlng = map.getCenter();
    return { lat: latlng.getLat(), lng: latlng.getLng() };
  });
  /**
   * 읽어 온 주소와 **그게 어느 좌표의 것인지**.
   *
   * 좌표를 같이 들고 있으면 "읽는 중"을 따로 저장할 필요가 없다. center 는
   * idle 마다 새 객체라, 아직 응답이 안 온 동안은 at 이 지금 center 와 달라
   * 그 자체로 로딩 표시가 된다. 앞 좌표의 주소를 새 위치에 붙여 보여주는
   * 실수도 구조적으로 막힌다.
   */
  const [address, setAddress] = useState<{
    at: Position;
    result: ReverseGeocodeResult;
  } | null>(null);

  const picking = step.kind === "pick";
  const addressLoading = address?.at !== center;
  const resolved = address?.at === center ? address.result : null;

  // 지도 중심 추적. **idle 에서만** 읽는다. 드래그하는 내내 읽으면 역지오코딩이
  // 초당 수십 번 나간다. 기존 viewport 갱신이 쓰는 것과 같은 이벤트다.
  useEffect(() => {
    if (!picking) return;

    const sync = () => {
      const latlng = map.getCenter();
      setCenter({ lat: latlng.getLat(), lng: latlng.getLng() });
    };

    sync();
    kakao.maps.event.addListener(map, "idle", sync);
    return () => kakao.maps.event.removeListener(map, "idle", sync);
  }, [map, picking]);

  // 주소 읽기. 지도를 계속 움직이면 앞선 요청이 늦게 도착할 수 있으므로,
  // 자리를 뜬 요청의 응답은 버린다.
  useEffect(() => {
    if (!picking) return;

    let cancelled = false;
    reverseGeocode(center.lat, center.lng).then((result) => {
      if (!cancelled) setAddress({ at: center, result });
    });
    return () => {
      cancelled = true;
    };
  }, [center, picking]);

  // 위치를 확정하면 그 자리에 핀을 세운다. 폼을 쓰는 동안 어디를 골랐는지
  // 계속 보여야 하고, 지도를 움직여 확인해도 핀은 그 좌표에 남는다.
  useEffect(() => {
    if (step.kind !== "form") return;

    const marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(step.position.lat, step.position.lng),
      image: toiletMarkerImage("selected"),
      zIndex: MARKER_Z.selected,
    });
    marker.setMap(map);
    return () => marker.setMap(null);
  }, [step, map]);

  const duplicate = picking
    ? (toilets.find(
        (toilet) => straightLineDistance(center, toilet) <= DUPLICATE_RADIUS_M,
      ) ?? null)
    : null;

  // 아직 읽는 중이어도 넘어갈 수 있다. 주소가 없으면 좌표만으로 접수되고,
  // 검토할 때 개발자가 채운다 — 여기서 기다리게 하면 응답이 늦을 때 갇힌다.
  const handleConfirm = useCallback(() => {
    setStep({
      kind: "form",
      position: center,
      address: resolved ?? { road: null, jibun: null },
      building: null,
    });
  }, [center, resolved]);

  /**
   * 폼에서 위치 고르기로 되돌아간다.
   *
   * 지도를 그 좌표로 옮기고 나서 돌아간다. 핀은 화면 중앙에 고정돼 있으므로,
   * 안 옮기면 **방금 고른 자리가 아닌 엉뚱한 곳에서 다시 시작한다** — 좌표를
   * 넘겨받아 폼부터 연 경우(seed)에는 지도가 애초에 그 자리에 있지도 않다.
   *
   * `panTo` 가 아니라 `setCenter` 인 이유 — 애니메이션이 끝나기 전에 pick 단계의
   * 첫 동기화가 돌면 핀이 지나가는 중간 좌표를 읽는다.
   */
  const handleBack = useCallback(() => {
    if (step.kind !== "form") return;
    map.setCenter(new kakao.maps.LatLng(step.position.lat, step.position.lng));
    setStep({ kind: "pick" });
  }, [map, step]);

  return (
    <>
      {/*
        위치 지정 핀은 지도 객체가 아니라 **CSS 로 화면 중앙에 고정**한다.
        마커로 만들면 지도를 움직일 때마다 좌표를 다시 세팅해야 해서 흔들린다.
        화면 중앙 = getCenter() 라 이 픽셀이 곧 그 좌표다.
      */}
      {picking && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-full"
        >
          <svg
            viewBox="0 0 36 46"
            className="h-[46px] w-9 drop-shadow-[0_2px_4px_rgba(20,35,31,0.35)]"
          >
            <path
              d="M18 44.5C18 44.5 33 28.5 33 17A15 15 0 1 0 3 17C3 28.5 18 44.5 18 44.5Z"
              fill="#E2622C"
              stroke="#FFFFFF"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            <circle cx="18" cy="17" r="5" fill="#FFFFFF" />
          </svg>
        </div>
      )}

      {picking ? (
        <LocationPickPanel
          loading={addressLoading}
          address={resolved}
          duplicateName={duplicate?.name ?? null}
          onConfirm={handleConfirm}
          onCancel={onClose}
        />
      ) : (
        <AddToiletForm
          position={step.position}
          address={step.address}
          initialBuilding={step.building}
          onSubmit={submitToilet}
          onBack={handleBack}
          onClose={onClose}
        />
      )}
    </>
  );
}
