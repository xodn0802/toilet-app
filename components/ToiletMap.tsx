"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { straightLineDistance } from "@/lib/geo/distance";
import { MARKER_Z, toiletMarkerImage } from "@/lib/map/toilet-marker";
import { mockReviewsFor } from "@/lib/reviews/mock-reviews";
import type { Review, ReviewDraft } from "@/lib/reviews/types";
import { fetchWalkRoute } from "@/lib/route/fetch-walk-route";
import type { RouteState } from "@/lib/route/state";
import { fetchToilets } from "@/lib/toilets/fetch-toilets";
import { isMappable, type MappableToilet } from "@/lib/toilets/types";

import AppBar from "./AppBar";
import RouteBanner from "./RouteBanner";
import ToiletDetailSheet from "./ToiletDetailSheet";

/** 인하대학교. 위치 권한을 못 받았을 때의 기본 중심. */
const INHA_UNIV = { lat: 37.4503, lng: 126.6532 };

/** 확대 레벨. 4면 도보 반경 정도가 한 화면에 들어온다. */
const DEFAULT_LEVEL = 4;

const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

/** 경로선. 지도에 넘기는 값이라 CSS 변수를 못 쓴다. --brand 와 같은 색. */
const ROUTE_COLOR = "#2E7D6B";

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
  denied: "위치를 못 받아 인하대학교 기준으로 보여줍니다",
};

/** 지도 위에 얹는 작은 안내. 배경이 지도라 항상 면을 깔고 그 위에 글씨를 둔다. */
function Notice({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "signal" | "error";
  children: React.ReactNode;
}) {
  const style =
    tone === "error"
      ? "bg-signal text-white"
      : tone === "signal"
        ? "bg-surface/95 text-signal"
        : "bg-surface/95 text-muted";

  return (
    <p
      className={`max-w-full truncate rounded-full px-3 py-1.5 text-xs shadow-[0_1px_8px_rgba(20,35,31,0.12)] backdrop-blur-sm ${style}`}
    >
      {children}
    </p>
  );
}

export default function ToiletMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<{ id: string; marker: kakao.maps.Marker }[]>([]);
  const myLocationRef = useRef<kakao.maps.CustomOverlay | null>(null);

  const [sdkReady, setSdkReady] = useState(false);
  const [sdkFailed, setSdkFailed] = useState(false);
  /** null 은 "아직 안 불러옴". 0곳과 구분해야 앱바에 로딩을 표시할 수 있다. */
  const [toilets, setToilets] = useState<MappableToilet[] | null>(null);
  const [selected, setSelected] = useState<MappableToilet | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("pending");
  const [center, setCenter] = useState(INHA_UNIV);
  const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });
  const [toiletsError, setToiletsError] = useState<string | null>(null);

  // 아래 둘은 백엔드가 붙기 전까지 쓰는 목업이다.
  // signedIn 은 P0 7번(Supabase Auth) 세션으로, reviewsByToilet 은 reviews
  // 테이블 조회로 바뀐다. 지금은 새로고침하면 작성한 리뷰가 사라진다.
  const [signedIn, setSignedIn] = useState(false);
  const [reviewsByToilet, setReviewsByToilet] = useState<
    Record<string, Review[]>
  >({});

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
        setToilets([]);
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
        '<div style="width:14px;height:14px;border-radius:9999px;background:#2E7D6B;border:2px solid #fff;box-shadow:0 0 0 5px rgba(46,125,107,0.22)"></div>',
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
    if (!sdkReady || !map || !toilets) return;

    const created = toilets.map((toilet) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(toilet.lat, toilet.lng),
        title: toilet.name,
        image: toiletMarkerImage(false),
        zIndex: MARKER_Z.normal,
      });
      marker.setMap(map);
      kakao.maps.event.addListener(marker, "click", () => {
        setSelected(toilet);
        // 목업 리뷰는 처음 열 때 한 번만 만든다. 다시 열어도 같은 목록이 보이고,
        // 그 사이 작성한 리뷰가 지워지지 않게 이미 있는 것은 덮어쓰지 않는다.
        setReviewsByToilet((prev) =>
          toilet.id in prev
            ? prev
            : { ...prev, [toilet.id]: mockReviewsFor(toilet.id) },
        );
        // 다른 화장실을 고르면 앞서 그린 경로는 더 이상 맞지 않으므로 지운다.
        setRouteState((prev) =>
          prev.status !== "idle" && prev.toilet.id !== toilet.id
            ? { status: "idle" }
            : prev,
        );
      });
      return { id: toilet.id, marker };
    });
    markersRef.current = created;

    return () => {
      created.forEach(({ marker }) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [toilets, sdkReady]);

  // 선택된 핀만 키운다. 마커를 다시 만들면 깜빡이므로 이미지만 갈아 끼운다.
  useEffect(() => {
    markersRef.current.forEach(({ id, marker }) => {
      const on = id === selected?.id;
      marker.setImage(toiletMarkerImage(on));
      marker.setZIndex(on ? MARKER_Z.selected : MARKER_Z.normal);
    });
  }, [selected, toilets, sdkReady]);

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
      strokeColor: ROUTE_COLOR,
      strokeOpacity: 0.9,
      strokeStyle: "solid",
    });
    polyline.setMap(map);

    // 경로 전체가 보이도록 맞추되, 위 배너와 아래 상세 시트에 가리지 않게 여백을 준다.
    const bounds = new kakao.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    map.setBounds(bounds, 170, 40, 260, 40);

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

  const handleSubmitReview = useCallback(
    (draft: ReviewDraft) => {
      const toilet = selected;
      if (!toilet) return;

      const review: Review = {
        id: `local-${Date.now()}`,
        toilet_id: toilet.id,
        nickname: "나",
        created_at: new Date().toISOString(),
        ...draft,
      };

      setReviewsByToilet((prev) => ({
        ...prev,
        [toilet.id]: [review, ...(prev[toilet.id] ?? [])],
      }));
    },
    [selected],
  );

  // 지도를 끌고 다닌 뒤 돌아오는 길. center 는 그대로라 위의 effect 로는 안 되고,
  // 누를 때마다 직접 옮겨야 한다.
  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
    map.setLevel(DEFAULT_LEVEL);
  }, [center]);

  const locationMessage = LOCATION_MESSAGE[locationState];

  // 상세 시트에는 지금 열려 있는 화장실의 경로만 넘긴다.
  const selectedRoute =
    routeState.status === "ready" && routeState.toilet.id === selected?.id
      ? routeState.route
      : null;
  const selectedLoading =
    routeState.status === "loading" && routeState.toilet.id === selected?.id;

  // 길찾기를 누르기 전에도 대강의 거리를 보여준다. 위치를 못 받았으면 기본
  // 중심(인하대)이 들어 있어 거리가 의미 없으므로 표시하지 않는다.
  const selectedDistance =
    selected && locationState === "granted"
      ? straightLineDistance(center, selected)
      : null;

  if (!KAKAO_APP_KEY) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-sm text-signal">
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

        같은 이유로 앱바도 지도의 형제가 아니라 지도 위에 얹는다. 지도 앱들이
        대개 이 형태이기도 하다 — 지도가 화면을 다 쓰고 UI 는 그 위에 뜬다.
      */}
      <div className="relative h-full">
        <div ref={containerRef} className="h-full w-full bg-paper" />

        {!sdkReady && !sdkFailed && (
          <div className="absolute inset-0 grid place-items-center bg-paper">
            <p className="flex items-center gap-2.5 text-sm text-muted">
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand"
              />
              지도를 불러오는 중입니다…
            </p>
          </div>
        )}

        {sdkFailed && (
          <div className="absolute inset-0 grid place-items-center bg-paper p-8">
            <p className="max-w-xs text-center text-sm text-signal">
              지도를 불러오지 못했습니다. 카카오 개발자 사이트에 이 도메인이
              등록되어 있는지 확인해 주세요.
            </p>
          </div>
        )}

        {/*
          지도 위에 얹는 것들은 z-10 이상이어야 한다. 카카오 내부 레이어가
          z-index 1·2 를 쓰므로 auto 면 덮인다. 위에서부터 차례로 쌓기 위해
          하나의 컨테이너에 모으고, 눌러야 하는 것에만 pointer-events 를 준다.
        */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-2 p-3">
          <AppBar
            toiletCount={toilets?.length ?? null}
            signedIn={signedIn}
            onToggleSignIn={() => setSignedIn((prev) => !prev)}
          />

          {routeState.status !== "idle" && (
            <div className="pointer-events-auto w-full">
              <RouteBanner
                state={routeState}
                onCancel={() => setRouteState({ status: "idle" })}
              />
            </div>
          )}

          {/* 실제 정보가 아님을 밝힌다. 화장실은 3·4단계, 리뷰는 P0 5번에서 실제로 바뀐다. */}
          <Notice tone="signal">표본 데이터 · 실제 정보가 아닙니다</Notice>

          {toiletsError && <Notice tone="error">{toiletsError}</Notice>}
          {locationMessage && <Notice>{locationMessage}</Notice>}
        </div>

        {/* 지도를 끌고 다니다 돌아올 길. 시트가 열리면 그 위로 비켜선다. */}
        <button
          type="button"
          onClick={handleRecenter}
          disabled={!sdkReady || locationState !== "granted"}
          aria-label="현재 위치로 이동"
          className={`absolute right-4 z-10 grid h-12 w-12 place-items-center rounded-full bg-surface text-brand shadow-[0_2px_12px_rgba(20,35,31,0.18)] transition-[bottom] duration-300 ease-out hover:bg-sunken disabled:text-muted ${
            selected ? "bottom-60" : "bottom-6"
          }`}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-[22px] w-[22px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        </button>

        {selected && (
          // key 를 주면 다른 화장실을 고를 때 시트가 새로 마운트된다.
          // 펼침 상태와 쓰다 만 리뷰가 앞 화장실에서 넘어오지 않게 하려는 것.
          <ToiletDetailSheet
            key={selected.id}
            toilet={selected}
            route={selectedRoute}
            loading={selectedLoading}
            canNavigate={locationState === "granted"}
            distanceMeters={selectedDistance}
            reviews={reviewsByToilet[selected.id] ?? []}
            signedIn={signedIn}
            onSignIn={() => setSignedIn(true)}
            onSubmitReview={handleSubmitReview}
            onNavigate={handleNavigate}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </>
  );
}
