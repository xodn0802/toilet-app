"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchWalkRoute } from "@/lib/route/fetch-walk-route";
import type { RouteState } from "@/lib/route/state";
import { fetchToilets } from "@/lib/toilets/fetch-toilets";
import { isMappable, type MappableToilet } from "@/lib/toilets/types";

import RouteBanner from "./RouteBanner";
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
  const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });
  const [toiletsError, setToiletsError] = useState<string | null>(null);

  const handleSdkReady = useCallback(() => {
    // autoload=false 로 불러왔으므로 직접 초기화해야 한다.
    window.kakao.maps.load(() => setSdkReady(true));
  }, []);

  // 화장실 목록. Supabase 의 toilets 에서 좌표가 확보된 행만 가져온다.
  useEffect(() => {
    let cancelled = false;
    fetchToilets()
      .then((rows) => {
        if (!cancelled) setToilets(rows.filter(isMappable));
      })
      // 실패를 삼키면 지도가 아무 설명 없이 텅 빈 상태가 돼 원인을 찾기 어렵다.
      .catch((error: unknown) => {
        if (cancelled) return;
        setToiletsError(
          error instanceof Error
            ? error.message
            : "화장실 목록을 불러오지 못했습니다.",
        );
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
      kakao.maps.event.addListener(marker, "click", () => {
        setSelected(toilet);
        // 다른 화장실을 고르면 앞서 그린 경로는 더 이상 맞지 않으므로 지운다.
        setRouteState((prev) =>
          prev.status !== "idle" && prev.toilet.id !== toilet.id
            ? { status: "idle" }
            : prev,
        );
      });
      return marker;
    });
    markersRef.current = markers;

    return () => {
      markers.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [toilets, sdkReady]);

  // 경로 폴리라인. 상태가 ready 일 때만 그리고, 바뀌면 지웠다 다시 그린다.
  useEffect(() => {
    const map = mapRef.current;
    if (!sdkReady || !map || routeState.status !== "ready") return;

    const path = routeState.route.path.map(
      (point) => new kakao.maps.LatLng(point.lat, point.lng),
    );

    const polyline = new kakao.maps.Polyline({
      path,
      strokeWeight: 6,
      strokeColor: "#3b82f6",
      strokeOpacity: 0.9,
      strokeStyle: "solid",
    });
    polyline.setMap(map);

    // 경로 전체가 보이도록 맞추되, 위 배너와 아래 상세 시트에 가리지 않게 여백을 준다.
    const bounds = new kakao.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    map.setBounds(bounds, 110, 40, 260, 40);

    return () => polyline.setMap(null);
  }, [routeState, sdkReady]);

  const handleNavigate = useCallback(async () => {
    const toilet = selected;
    if (!toilet || locationState !== "granted") return;

    setRouteState({ status: "loading", toilet });

    // 요청 중에 다른 화장실로 옮겨갔다면 늦게 온 응답은 버린다.
    const applyIfCurrent = (next: RouteState) =>
      setRouteState((prev) =>
        prev.status === "loading" && prev.toilet.id === toilet.id ? next : prev,
      );

    try {
      const route = await fetchWalkRoute({
        start: center,
        end: { lat: toilet.lat, lng: toilet.lng },
        endName: toilet.name,
      });
      applyIfCurrent({ status: "ready", toilet, route });
    } catch (error) {
      applyIfCurrent({
        status: "error",
        toilet,
        message:
          error instanceof Error
            ? error.message
            : "경로를 불러오지 못했습니다.",
      });
    }
  }, [selected, center, locationState]);

  const locationMessage = LOCATION_MESSAGE[locationState];

  // 상세 시트에는 지금 열려 있는 화장실의 경로만 넘긴다.
  const selectedRoute =
    routeState.status === "ready" && routeState.toilet.id === selected?.id
      ? routeState.route
      : null;
  const selectedLoading =
    routeState.status === "loading" && routeState.toilet.id === selected?.id;

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

        {/*
          지도 위에 얹는 것들은 z-10 이상이어야 한다. 카카오 내부 레이어가
          z-index 1·2 를 쓰므로 auto 면 덮인다. 위에서부터 차례로 쌓기 위해
          하나의 컨테이너에 모으고, 클릭이 필요한 배너에만 pointer-events 를 준다.
        */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
          {/* 실제 화장실 정보가 아님을 밝힌다. 3·4단계로 실제 데이터가 들어오면 지운다. */}
          <p className="bg-amber-100/95 px-3 py-2 text-center text-xs text-amber-900">
            임시 표본 데이터입니다. 실제 화장실 정보가 아닙니다.
          </p>

          {toiletsError && (
            <p className="bg-red-600 px-3 py-2 text-center text-xs text-white">
              {toiletsError}
            </p>
          )}

          {locationMessage && (
            <p className="bg-zinc-900/80 px-3 py-2 text-center text-xs text-white">
              {locationMessage}
            </p>
          )}

          {routeState.status !== "idle" && (
            <div className="pointer-events-auto">
              <RouteBanner
                state={routeState}
                onCancel={() => setRouteState({ status: "idle" })}
              />
            </div>
          )}
        </div>

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
            route={selectedRoute}
            loading={selectedLoading}
            canNavigate={locationState === "granted"}
            onNavigate={handleNavigate}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </>
  );
}
