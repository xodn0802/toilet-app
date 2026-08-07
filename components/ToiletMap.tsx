"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useIdentity } from "@/lib/auth/use-identity";
import { boundsAround, sameBounds, type Bounds } from "@/lib/geo/bounds";
import { straightLineDistance } from "@/lib/geo/distance";
import {
  MARKER_Z,
  toiletMarkerImage,
  type MarkerState,
} from "@/lib/map/toilet-marker";
import { reviewGate } from "@/lib/reviews/eligibility";
import { fetchReviews } from "@/lib/reviews/fetch-reviews";
import { submitReview } from "@/lib/reviews/submit-review";
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

import AddToilet from "./AddToilet";
import AppBar from "./AppBar";
import Icon from "./Icons";
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
  busy = false,
  children,
}: {
  tone?: "muted" | "signal" | "error";
  /**
   * 기다리는 중이라는 표시. 위치 확인은 몇 초씩 걸리는데 글자만 있으면 앱이
   * 멈춘 것과 구분되지 않는다. 도는 것이 하나 있으면 "진행 중"으로 읽힌다.
   */
  busy?: boolean;
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
      className={`flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs shadow-chip backdrop-blur-sm ${style}`}
    >
      {busy && (
        // currentColor 라 tone 을 그대로 따라간다. 글자가 이미 상태를 말하므로
        // 스크린리더에는 숨긴다.
        <span
          aria-hidden
          className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
        />
      )}
      <span className="truncate">{children}</span>
    </p>
  );
}

type Props = {
  /** 주소가 `?add=1` 이면 화장실 등록 모드로 연다. 사이드바 메뉴가 붙인다. */
  initialAdd?: boolean;
};

export default function ToiletMap({ initialAdd = false }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<{ id: string; marker: kakao.maps.Marker }[]>([]);
  const myLocationRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const accuracyCircleRef = useRef<kakao.maps.Circle | null>(null);

  const [sdkReady, setSdkReady] = useState(false);
  const [sdkFailed, setSdkFailed] = useState(false);
  /**
   * 지도 객체를 state 로도 들고 있는다.
   *
   * AddToilet 이 getCenter() 와 idle 리스너를 붙여야 하는데, ref 는 채워져도
   * 리렌더를 일으키지 않아 자식에게 전달되는 시점을 만들 수 없다.
   */
  const [mapInstance, setMapInstance] = useState<kakao.maps.Map | null>(null);
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
  /** 화장실 추가 모드. 켜져 있으면 지도를 위치 고르는 데 쓴다. */
  const [addOpen, setAddOpen] = useState(initialAdd);

  // 사이드바에서 눌러 들어오면 주소만 바뀌고 이 컴포넌트는 그대로 있다.
  // 그래서 처음 값(useState)만으로는 두 번째부터 안 열린다.
  useEffect(() => {
    if (initialAdd) setAddOpen(true);
  }, [initialAdd]);

  /**
   * 모드를 닫으면 주소에 남은 `?add=1` 도 지운다. 그대로 두면 새로고침할 때
   * 다시 열리고, 사이드바에서 같은 링크를 눌러도 주소가 안 바뀌어 아무 일도
   * 일어나지 않는다. history 를 직접 만지지 않고 router 로 바꿔야 Next 가 아는
   * 주소와 실제 주소가 어긋나지 않는다.
   */
  const closeAdd = useCallback(() => {
    setAddOpen(false);
    if (initialAdd) router.replace("/", { scroll: false });
  }, [initialAdd, router]);

  /**
   * 마커 클릭 리스너가 읽는 addOpen.
   *
   * 리스너는 마커를 만들 때 state 를 클로저에 가두므로 addOpen 을 직접 읽으면
   * 항상 처음 값(false)이다. 위치를 고르는 중에 마커를 눌러 상세 시트가 뜨면
   * 두 화면이 겹친다.
   */
  const addOpenRef = useRef(false);
  useEffect(() => {
    addOpenRef.current = addOpen;
  }, [addOpen]);

  const identity = useIdentity();

  /**
   * 화장실별 리뷰. 값이 **없는 것(undefined)이 "아직 조회 중"** 이고, 빈 배열이
   * "리뷰가 없음"이다. 둘을 같게 두면 시트가 열리자마자 "리뷰 없음"이라고
   * 단정했다가 곧 숫자가 바뀐다.
   *
   * 선택한 화장실 것만 채운다. 목록 전체를 미리 받아 봐야 마커에는 안 쓴다.
   */
  const [reviewsByToilet, setReviewsByToilet] = useState<
    Record<string, Review[] | undefined>
  >({});
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  /**
   * 조회 effect 가 읽는 reviewsByToilet.
   *
   * state 를 의존성에 넣으면 리뷰를 하나 등록할 때마다 effect 가 다시 돌아
   * 방금 얹은 리뷰를 조회 결과로 덮어쓴다. "이미 받아 왔는지"만 보면 되므로
   * ref 로 읽는다(addOpenRef 와 같은 이유).
   */
  const reviewsRef = useRef(reviewsByToilet);
  useEffect(() => {
    reviewsRef.current = reviewsByToilet;
  }, [reviewsByToilet]);

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

  // 선택한 화장실의 리뷰. 한 번 받아 오면 그대로 둔다 — 시트를 여닫을 때마다
  // 다시 부르면 "불러오는 중"이 반복해서 깜빡이고, 그동안 리뷰 폼이 잠긴다.
  const selectedId = selected?.id ?? null;
  useEffect(() => {
    if (!selectedId || reviewsRef.current[selectedId] !== undefined) return;

    let cancelled = false;
    fetchReviews(selectedId)
      .then((rows) => {
        if (cancelled) return;
        setReviewsByToilet((prev) => ({ ...prev, [selectedId]: rows }));
        setReviewsError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // 빈 배열로 두는 이유: undefined 로 남기면 화면이 영영 "불러오는 중"이고
        // 리뷰 폼도 계속 잠겨 있다. 실패는 안내로 말하고 화면은 풀어 준다.
        setReviewsByToilet((prev) => ({ ...prev, [selectedId]: [] }));
        setReviewsError(
          error instanceof Error
            ? error.message
            : "리뷰를 불러오지 못했습니다.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

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
    setMapInstance(map);

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

  /*
    컨테이너 폭이 바뀌면 카카오에 알려야 한다. 1024px 경계를 넘나들면 사이드바가
    생기고 사라져 지도 폭이 256px 달라지는데, relayout() 을 안 부르면 카카오는
    예전 크기를 기준으로 좌표를 계산해 타일과 마커가 어긋난다.

    조회 영역도 같이 갱신한다 — 넓어진 만큼 새로 보이는 곳의 화장실이 필요하고,
    relayout() 만으로는 idle 이 오지 않는다.
  */
  useEffect(() => {
    const map = mapInstance;
    const element = containerRef.current;
    if (!map || !element) return;

    const observer = new ResizeObserver(() => {
      map.relayout();
      setViewport((prev) => {
        const next = readBounds(map);
        return sameBounds(prev, next) ? prev : next;
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [mapInstance]);

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
        // 위치를 고르는 중에는 지도가 "어디에 둘지"를 묻는 화면이다. 여기서
        // 상세 시트가 뜨면 두 화면이 겹친다.
        if (addOpenRef.current) return;
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
    async (draft: ReviewDraft) => {
      const toilet = selected;
      if (!toilet) return;

      // 신원은 **여기서 처음** 만들어진다. 지도를 보기만 한 사람에게 계정을
      // 발급하지 않으려는 것이다.
      const who = await identity.ensure();

      const review = await submitReview({
        ...draft,
        toilet_id: toilet.id,
        user_id: who.userId,
        nickname: who.nickname,
      });

      // 돌려받은 행을 그대로 얹는다. 다시 조회하면 왕복이 한 번 더 생기는데,
      // 방금 쓴 사람에게는 바로 보이는 편이 낫다.
      setReviewsByToilet((prev) => ({
        ...prev,
        [toilet.id]: [review, ...(prev[toilet.id] ?? [])],
      }));
    },
    [selected, identity],
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

  // 리뷰를 쓸 수 있는 상태인지. 거리는 보지 않는다 — 같은 화장실에 두 번 쓰는
  // 것만 막는다(lib/reviews/eligibility.ts 참고).
  const selectedGate = selected
    ? reviewGate({
        reviews: reviewsByToilet[selected.id],
        userId: identity.who?.userId ?? null,
      })
    : ({ kind: "loading" } as const);

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
        // libraries=services 는 역지오코딩(Geocoder)용이다. 안 붙이면
        // kakao.maps.services 가 undefined 라 위치 지정 화면이 주소를 못 읽는다.
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&libraries=services&autoload=false`}
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
            nickname={identity.who?.nickname ?? null}
          />

          {/*
            데스크톱에서는 상세가 왼쪽 400px 카드로 뜬다. 앱바는 그 위(top-20
            보다 높은 자리)라 안 겹치지만 아래 줄들은 겹치므로 카드가 열려
            있는 동안만 비켜선다. 빈 채로 두면 gap 만 남으므로 empty:hidden.
          */}
          <div
            className={`flex w-full flex-col items-start gap-2 empty:hidden ${
              selected ? "lg:pl-[27rem]" : ""
            }`}
          >
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
            {reviewsError && <Notice tone="error">{reviewsError}</Notice>}
            {locationMessage && (
              <Notice
                tone={locationCoarse ? "signal" : "muted"}
                busy={locationState === "pending"}
              >
                {locationMessage}
              </Notice>
            )}
          </div>
        </div>

        {/*
          지도 위 버튼들. 시트가 열리면 그 위로 비켜선다 — 위치 계산이 하나면
          되도록 버튼마다 두지 않고 이 컨테이너에만 둔다.

          추가 모드에서는 통째로 감춘다. 그때 지도는 "어디에 둘지"를 묻는
          화면이라 여기서 할 수 있는 일이 없고, 아래 패널과 겹치기만 한다.
        */}
        {!addOpen && (
          <div
            className={`absolute right-4 z-10 flex flex-col gap-3 transition-[bottom] duration-300 ease-out ${
              // 데스크톱에서는 상세가 왼쪽 카드라 버튼이 비켜설 이유가 없다.
              selected ? "bottom-60 lg:bottom-6" : "bottom-6"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setAddOpen(true);
                // 상세 시트가 열린 채로 두면 아래에서 두 시트가 겹친다.
                setSelected(null);
              }}
              disabled={!sdkReady}
              aria-label="화장실 추가"
              className="grid h-12 w-12 place-items-center rounded-full bg-brand text-brand-ink shadow-float hover:bg-brand-strong disabled:bg-surface disabled:text-muted"
            >
              <Icon name="add" className="h-6 w-6" />
            </button>

            {/* 지도를 끌고 다니다 돌아올 길. */}
            <button
              type="button"
              onClick={handleRecenter}
              disabled={!sdkReady || locationState !== "granted"}
              aria-label="현재 위치로 이동"
              className="grid h-12 w-12 place-items-center rounded-full bg-surface text-brand shadow-float hover:bg-sunken disabled:text-muted"
            >
              <Icon name="myLocation" className="h-[22px] w-[22px]" />
            </button>
          </div>
        )}

        {addOpen && mapInstance && (
          <AddToilet
            map={mapInstance}
            toilets={toilets ?? []}
            onClose={closeAdd}
          />
        )}

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
            reviews={reviewsByToilet[selected.id]}
            gate={selectedGate}
            nickname={identity.who?.nickname ?? null}
            onSubmitReview={handleSubmitReview}
            onNavigate={handleNavigate}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </>
  );
}
