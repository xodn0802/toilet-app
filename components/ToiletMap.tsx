"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/lib/auth/use-auth";
import { boundsAround, sameBounds, type Bounds } from "@/lib/geo/bounds";
import { straightLineDistance } from "@/lib/geo/distance";
import {
  MARKER_Z,
  toiletMarkerImage,
  type MarkerState,
} from "@/lib/map/toilet-marker";
import type { Review, ReviewDraft } from "@/lib/reviews/types";
import { fetchWalkRoute } from "@/lib/route/fetch-walk-route";
import type { RouteState } from "@/lib/route/state";
import { formatDistance } from "@/lib/route/types";
import { fetchToilets } from "@/lib/toilets/fetch-toilets";
import {
  NEARBY_RADIUS_M,
  nearbyLabel,
  summarizeNearby,
} from "@/lib/toilets/nearby";
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

/** 오차 반경 원. 위와 같은 이유로 리터럴이고, --signal 의 라이트 모드 값이다. */
const ACCURACY_COLOR = "#E2622C";

/**
 * 이 값을 넘는 오차 반경은 현재 위치를 점 하나로 단정하지 않는다.
 *
 * GPS 는 보통 10-50m, WiFi 는 수백 m 다. 데스크톱처럼 둘 다 없어 IP 로 추정하면
 * ISP 기지국 위치가 수 km 오차로 들어온다 — 그걸 파란 점으로 찍으면 사용자는
 * 엉뚱한 곳을 자기 위치로 믿는다.
 */
const ACCURACY_LIMIT_M = 1000;

/** 오차 원을 화면에 맞출 때의 여백(px). 위는 앱바·안내 문구를 피해 넓게 준다. */
const ACCURACY_FIT_PADDING = [170, 40, 40, 40] as const;

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

/** 지도가 지금 보고 있는 영역. */
function readBounds(map: kakao.maps.Map): Bounds {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return {
    minLat: sw.getLat(),
    maxLat: ne.getLat(),
    minLng: sw.getLng(),
    maxLng: ne.getLng(),
  };
}

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
  const accuracyCircleRef = useRef<kakao.maps.Circle | null>(null);

  const [sdkReady, setSdkReady] = useState(false);
  const [sdkFailed, setSdkFailed] = useState(false);
  /** null 은 "아직 안 불러옴". 0곳과 구분해야 앱바에 로딩을 표시할 수 있다. */
  const [toilets, setToilets] = useState<MappableToilet[] | null>(null);
  const [selected, setSelected] = useState<MappableToilet | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("pending");
  const [center, setCenter] = useState(INHA_UNIV);
  /** 브라우저가 알려준 오차 반경(m). 위치를 못 받았으면 null. */
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });
  const [toiletsError, setToiletsError] = useState<string | null>(null);
  /** 지도가 보고 있는 영역. 지도가 생기기 전에는 null 이라 조회를 미룬다. */
  const [viewport, setViewport] = useState<Bounds | null>(null);
  /** 조회 상한에 걸려 일부만 왔는지. 확대를 권해야 한다. */
  const [truncated, setTruncated] = useState(false);

  const auth = useAuth();
  const signedIn = auth.status === "in";

  // 리뷰는 아직 어디에도 저장되지 않는다. 지금은 로그인이 막혀 폼이 잠겨 있어
  // 늘 비어 있고, 로그인이 열리면 작성한 것이 이 state 에만 남아 새로고침하면
  // 사라진다. reviews 테이블 조회·저장(P0 5번)이 그 자리를 대신한다.
  const [reviewsByToilet, setReviewsByToilet] = useState<
    Record<string, Review[]>
  >({});

  const handleSdkReady = useCallback(() => {
    // autoload=false 로 불러왔으므로 직접 초기화해야 한다.
    window.kakao.maps.load(() => setSdkReady(true));
  }, []);

  /** 좌표는 받았지만 믿고 쓰기엔 오차가 큰 상태. */
  const locationCoarse = accuracy !== null && accuracy > ACCURACY_LIMIT_M;

  /**
   * 현재 위치를 거리의 기준점으로 써도 되는 상태.
   *
   * 앱바의 "1km 이내"와 상세 시트의 직선거리가 같은 조건을 봐야 한다. 한쪽만
   * 감추면 "거리는 못 알려주면서 1km 이내라고는 하는" 화면이 된다.
   */
  const anchored = locationState === "granted" && !locationCoarse;

  // 반경 안이 몇 곳인지. 문구(summary)와 마커(nearIds)가 같은 계산을 나눠 쓴다.
  const { summary, nearIds } = useMemo(
    () => summarizeNearby(toilets ?? [], anchored ? center : null),
    [toilets, center, anchored],
  );

  /**
   * 반경 판정에 쓰는 영역. 조회에서 이 안이 빠지면 앱바의 "1km 이내"가 틀린다.
   * 기준점을 못 믿는 동안에는 null 이라 지도가 보는 곳만 조회한다.
   */
  const anchorBounds = useMemo(
    () => (anchored ? boundsAround(center, NEARBY_RADIUS_M) : null),
    [anchored, center],
  );

  // 화장실 목록. Supabase 의 toilets 에서 좌표가 확보된 행만 가져온다.
  useEffect(() => {
    if (!viewport) return;

    let cancelled = false;
    fetchToilets(viewport, anchorBounds)
      .then((page) => {
        if (cancelled) return;
        setToilets(page.toilets.filter(isMappable));
        setTruncated(page.truncated);
        // 다시 성공했으면 지난 실패 안내는 치운다. 조회가 반복되기 때문에
        // 남겨 두면 이미 해결된 오류를 계속 보여주게 된다.
        setToiletsError(null);
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
  }, [viewport, anchorBounds]);

  // 현재 위치. 거부·실패해도 기본 중심으로 지도는 그대로 뜬다.
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setAccuracy(position.coords.accuracy);
        setLocationState("granted");
      },
      () => setLocationState("denied"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // 지도 생성. mapRef 가 채워져 있으면 다시 만들지 않는다.
  useEffect(() => {
    if (!sdkReady || !containerRef.current || mapRef.current) return;
    const map = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: DEFAULT_LEVEL,
    });
    mapRef.current = map;

    // 보고 있는 영역이 바뀌면 그 영역의 화장실을 다시 조회한다. idle 은 이동·
    // 확대가 **끝난 뒤에만** 오므로 드래그하는 내내 조회가 연타되지 않는다.
    // 같은 영역이면 이전 객체를 그대로 둬서 조회까지 가지 않게 한다.
    const syncViewport = () =>
      setViewport((prev) => {
        const next = readBounds(map);
        return sameBounds(prev, next) ? prev : next;
      });

    syncViewport();
    kakao.maps.event.addListener(map, "idle", syncViewport);
  }, [sdkReady, center]);

  // 위치를 나중에 받아왔을 때 중심을 옮긴다.
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;
    mapRef.current.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
  }, [center, sdkReady]);

  // 현재 위치 표시. 권한을 받은 경우에만 그린다.
  //
  // 오차가 크면 점 대신 오차 반경 원을 그린다. 점은 "여기 있다"는 뜻이라
  // 수 km 를 벗어난 좌표에 찍으면 거짓말이 된다. 원은 "이 안 어딘가"라고
  // 말하므로 브라우저가 실제로 준 정보와 어긋나지 않는다.
  useEffect(() => {
    const map = mapRef.current;
    if (!sdkReady || !map || locationState !== "granted") return;

    const position = new kakao.maps.LatLng(center.lat, center.lng);

    if (locationCoarse && accuracy !== null) {
      const circle = new kakao.maps.Circle({
        center: position,
        radius: accuracy,
        strokeWeight: 2,
        strokeColor: ACCURACY_COLOR,
        strokeOpacity: 0.7,
        strokeStyle: "dash",
        fillColor: ACCURACY_COLOR,
        fillOpacity: 0.12,
      });
      circle.setMap(map);
      accuracyCircleRef.current = circle;

      // 반경이 화면보다 크면 지도 전체가 주황으로 덮여 고장난 것처럼 보인다.
      // 원이 다 들어오게 축척을 맞춰 "이만큼 불확실하다"를 눈에 보이게 한다.
      map.setBounds(circle.getBounds(), ...ACCURACY_FIT_PADDING);

      return () => {
        circle.setMap(null);
        accuracyCircleRef.current = null;
      };
    }

    const overlay = new kakao.maps.CustomOverlay({
      position,
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
  }, [center, accuracy, locationCoarse, locationState, sdkReady]);

  // 화장실 마커.
  useEffect(() => {
    const map = mapRef.current;
    if (!sdkReady || !map || !toilets) return;

    const created = toilets.map((toilet) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(toilet.lat, toilet.lng),
        title: toilet.name,
        // 진하기는 바로 아래 effect 가 반경을 보고 다시 정한다.
        image: toiletMarkerImage("normal"),
        zIndex: MARKER_Z.normal,
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
      return { id: toilet.id, marker };
    });
    markersRef.current = created;

    return () => {
      created.forEach(({ marker }) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [toilets, sdkReady]);

  // 선택된 핀은 키우고, 반경 밖 핀은 흐리게 한다. 마커를 다시 만들면 깜빡이므로
  // 이미지만 갈아 끼운다. nearIds 가 null 이면 기준점이 없다는 뜻이라 전부 진하다.
  useEffect(() => {
    markersRef.current.forEach(({ id, marker }) => {
      const state: MarkerState =
        id === selected?.id
          ? "selected"
          : nearIds && !nearIds.has(id)
            ? "far"
            : "normal";
      marker.setImage(toiletMarkerImage(state));
      marker.setZIndex(MARKER_Z[state]);
    });
  }, [selected, toilets, sdkReady, nearIds]);

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

    // 오차 원이 떠 있으면 그 영역에 맞춘다. DEFAULT_LEVEL 로 당기면 원이
    // 화면을 통째로 덮어 어디가 불확실한 건지 보이지 않는다.
    const circle = accuracyCircleRef.current;
    if (circle) {
      map.setBounds(circle.getBounds(), ...ACCURACY_FIT_PADDING);
      return;
    }
    map.setLevel(DEFAULT_LEVEL);
  }, [center]);

  // 오차가 크면 그 사실이 "위치를 확인했다"보다 먼저다. 숫자까지 같이 보여야
  // 사용자가 지도 위의 원과 문구를 연결해 읽을 수 있다.
  const locationMessage =
    locationCoarse && accuracy !== null
      ? `현재 위치가 부정확합니다 · 오차 반경 약 ${formatDistance(accuracy)}`
      : LOCATION_MESSAGE[locationState];

  // 상세 시트에는 지금 열려 있는 화장실의 경로만 넘긴다.
  const selectedRoute =
    routeState.status === "ready" && routeState.toilet.id === selected?.id
      ? routeState.route
      : null;
  const selectedLoading =
    routeState.status === "loading" && routeState.toilet.id === selected?.id;

  // 길찾기를 누르기 전에도 대강의 거리를 보여준다. 위치를 못 받았으면 기본
  // 중심(인하대)이 들어 있어 거리가 의미 없으므로 표시하지 않는다.
  //
  // 오차가 클 때도 같은 이유로 감춘다. 출발지가 수 km 불확실한데 "555m" 라고
  // 세 자리로 적으면 없는 정밀도를 있는 것처럼 말하게 된다.
  const selectedDistance =
    selected && anchored ? straightLineDistance(center, selected) : null;

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
            label={toilets === null ? null : nearbyLabel(summary)}
            auth={auth.status}
            nickname={auth.nickname}
            onSignIn={auth.signIn}
            onSignOut={auth.signOut}
          />

          {routeState.status !== "idle" && (
            <div className="pointer-events-auto w-full">
              <RouteBanner
                state={routeState}
                originUncertain={locationCoarse}
                onCancel={() => setRouteState({ status: "idle" })}
              />
            </div>
          )}

          {truncated && (
            <Notice tone="signal">
              이 범위에는 화장실이 너무 많습니다 · 확대해서 보세요
            </Notice>
          )}

          {toiletsError && <Notice tone="error">{toiletsError}</Notice>}
          {auth.error && <Notice tone="error">{auth.error}</Notice>}
          {locationMessage && (
            <Notice tone={locationCoarse ? "signal" : "muted"}>
              {locationMessage}
            </Notice>
          )}
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
            onSignIn={auth.signIn}
            onSubmitReview={handleSubmitReview}
            onNavigate={handleNavigate}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </>
  );
}
