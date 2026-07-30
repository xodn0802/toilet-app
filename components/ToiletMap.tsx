"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchToilets } from "@/lib/toilets/fetch-toilets";
import { isMappable, type MappableToilet } from "@/lib/toilets/types";

import ToiletDetailSheet from "./ToiletDetailSheet";

/** 인하대학교. 위치 권한을 못 받았을 때의 기본 중심. */
const INHA_UNIV = { lat: 37.4503, lng: 126.6532 };

/** 확대 레벨. 4면 도보 반경 정도가 한 화면에 들어온다. */
const DEFAULT_LEVEL = 4;

const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

/**
 * 위치 권한 상태.
 *
 * 권한 거부뿐 아니라 비보안 오리진(http)·시간 초과도 모두 에러 콜백으로 들어와
 * "denied"가 된다. 어느 쪽이든 기본 중심으로 지도는 정상 동작한다.
 */
type LocationState = "pending" | "granted" | "denied";

const LOCATION_MESSAGE: Record<LocationState, string | null> = {
  pending: "현재 위치를 확인하는 중입니다…",
  granted: null,
  denied: "현재 위치를 사용할 수 없어 인하대학교를 기준으로 표시합니다.",
};

export default function ToiletMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const myLocationRef = useRef<kakao.maps.CustomOverlay | null>(null);

  const [sdkReady, setSdkReady] = useState(false);
  const [sdkFailed, setSdkFailed] = useState(false);
  const [toilets, setToilets] = useState<MappableToilet[]>([]);
  const [selected, setSelected] = useState<MappableToilet | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("pending");
  const [center, setCenter] = useState(INHA_UNIV);

  const handleSdkReady = useCallback(() => {
    // autoload=false 로 불러왔으므로 직접 초기화해야 한다.
    window.kakao.maps.load(() => setSdkReady(true));
  }, []);

  // 화장실 목록. 지금은 임시 데이터, 나중에 Supabase 쿼리로 교체된다.
  useEffect(() => {
    let cancelled = false;
    fetchToilets().then((rows) => {
      if (!cancelled) setToilets(rows.filter(isMappable));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 현재 위치. 거부·실패해도 기본 중심으로 지도는 그대로 뜬다.
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationState("granted");
      },
      () => setLocationState("denied"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // 지도 생성. mapRef 가 채워져 있으면 다시 만들지 않는다.
  useEffect(() => {
    if (!sdkReady || !containerRef.current || mapRef.current) return;
    mapRef.current = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: DEFAULT_LEVEL,
    });
  }, [sdkReady, center]);

  // 위치를 나중에 받아왔을 때 중심을 옮긴다.
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;
    mapRef.current.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
  }, [center, sdkReady]);

  // 현재 위치 표시(파란 점). 권한을 받은 경우에만 그린다.
  useEffect(() => {
    const map = mapRef.current;
    if (!sdkReady || !map || locationState !== "granted") return;

    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(center.lat, center.lng),
      content:
        '<div style="width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 5px rgba(37,99,235,0.25)"></div>',
      zIndex: 1,
    });
    overlay.setMap(map);
    myLocationRef.current = overlay;

    return () => {
      overlay.setMap(null);
      myLocationRef.current = null;
    };
  }, [center, locationState, sdkReady]);

  // 화장실 마커.
  useEffect(() => {
    const map = mapRef.current;
    if (!sdkReady || !map) return;

    const markers = toilets.map((toilet) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(toilet.lat, toilet.lng),
        title: toilet.name,
      });
      marker.setMap(map);
      kakao.maps.event.addListener(marker, "click", () => setSelected(toilet));
      return marker;
    });
    markersRef.current = markers;

    return () => {
      markers.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [toilets, sdkReady]);

  const locationMessage = LOCATION_MESSAGE[locationState];

  if (!KAKAO_APP_KEY) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-red-600">
        NEXT_PUBLIC_KAKAO_MAP_KEY 가 설정되지 않았습니다.
        <br />
        .env.local 과 Vercel 환경변수를 확인해 주세요.
      </div>
    );
  }

  return (
    <>
      <Script
        id="kakao-maps-sdk"
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`}
        onReady={handleSdkReady}
        onError={() => setSdkFailed(true)}
      />

      {/*
        높이는 flex-1 이 아니라 h-full 로 잇는다. flex-1 은 flex-basis:0% 라서
        조상의 높이가 퍼센트 해석 기준으로 확정되지 않고, 그러면 지도 컨테이너의
        h-full 이 0 으로 무너져 지도가 흰 화면으로 보인다.
      */}
      <div className="relative h-full">
        <div ref={containerRef} className="h-full w-full bg-zinc-100" />

        {/* 실제 화장실 정보가 아님을 밝힌다. 3·4단계로 실제 데이터가 들어오면 지운다. */}
        <p className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-amber-100/95 px-3 py-2 text-center text-xs text-amber-900">
          임시 표본 데이터입니다. 실제 화장실 정보가 아닙니다.
        </p>

        {locationMessage && (
          <p className="pointer-events-none absolute inset-x-0 top-9 z-10 bg-zinc-900/80 px-3 py-2 text-center text-xs text-white">
            {locationMessage}
          </p>
        )}

        {!sdkReady && !sdkFailed && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
            지도를 불러오는 중입니다…
          </p>
        )}

        {sdkFailed && (
          <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-red-600">
            지도를 불러오지 못했습니다. 카카오 개발자 사이트에 이 도메인이
            등록되어 있는지 확인해 주세요.
          </p>
        )}

        {selected && (
          <ToiletDetailSheet
            toilet={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </>
  );
}
