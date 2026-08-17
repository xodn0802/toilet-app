"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useIdentity } from "@/lib/auth/use-identity";
import { boundsAround, sameBounds, type Bounds } from "@/lib/geo/bounds";
import { straightLineDistance } from "@/lib/geo/distance";
import type { MapFocus } from "@/lib/map/focus";
import {
  MARKER_Z,
  toiletMarkerImage,
  type MarkerState,
} from "@/lib/map/toilet-marker";
import { reviewGate } from "@/lib/reviews/eligibility";
import { fetchRatingsFor } from "@/lib/reviews/fetch-ratings";
import { fetchReviews } from "@/lib/reviews/fetch-reviews";
import { submitReview } from "@/lib/reviews/submit-review";
import type { Review, ReviewDraft } from "@/lib/reviews/types";
import { fetchWalkRoute } from "@/lib/route/fetch-walk-route";
import type { RouteState } from "@/lib/route/state";
import { formatDistance } from "@/lib/route/types";
import { groupByCoords, type ToiletGroup } from "@/lib/toilets/cluster";
import { fetchToilets } from "@/lib/toilets/fetch-toilets";
import {
  forgetApproved,
  list as listMySubmissions,
  listOnServer as listMySubmissionsOnServer,
  subscribe as subscribeMySubmissions,
} from "@/lib/toilets/my-submissions";
import {
  nearbyCandidates,
  pickBest,
  type GuidePick,
} from "@/lib/toilets/pick-best";
import {
  NEARBY_RADIUS_M,
  nearbyLabel,
  RADIUS_LABEL,
  summarizeNearby,
} from "@/lib/toilets/nearby";
import { isMappable, type MappableToilet } from "@/lib/toilets/types";

import AddToilet, { type AddSeed } from "./AddToilet";
import AppBar from "./AppBar";
import Icon from "./Icons";
import RouteBanner from "./RouteBanner";
import ToiletDetailSheet from "./ToiletDetailSheet";
import ToiletListSheet from "./ToiletListSheet";

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

/** 아직 별점을 못 받은 목록에 넘긴다. 매번 new Map() 을 만들면 목록이 다시 그려진다. */
const EMPTY_RATINGS = new Map<string, number>();

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
  /**
   * 주소에 좌표가 있으면(`?lat=&lng=&level=`) 거기서 연다. 없으면 null 이라
   * 지금까지처럼 내 위치를 따라간다.
   */
  focus?: MapFocus | null;
};

export default function ToiletMap({ initialAdd = false, focus = null }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  /**
   * 마커는 **좌표당 하나**다. 겹친 화장실을 행마다 찍으면 완전히 포개져 맨 위
   * 하나만 눌린다(lib/toilets/cluster.ts). 진하기·선택 판정에 그룹 안의 id 가
   * 전부 필요하므로 같이 들고 있는다.
   */
  const markersRef = useRef<
    { key: string; ids: string[]; count: number; marker: kakao.maps.Marker }[]
  >([]);
  const myLocationRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const accuracyCircleRef = useRef<kakao.maps.Circle | null>(null);
  /**
   * 딥링크로 연 곳을 붙잡고 있는 동안 참. 위치를 받아도 지도를 안 옮긴다.
   *
   * 사용자가 직접 위치를 요구하면(`requestLocation`) 풀린다 — 링크보다 그쪽이
   * 나중이자 명시적인 의사표시다.
   */
  const holdFocusRef = useRef(false);

  /*
    좌표를 객체가 아니라 값으로 푼다. `focus` 는 서버가 렌더할 때마다 새 객체라
    그대로 의존성에 넣으면 아무것도 안 바뀌었는데 지도가 다시 움직인다.
  */
  const focusLat = focus?.lat ?? null;
  const focusLng = focus?.lng ?? null;
  const focusLevel = focus?.level ?? null;

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
  /**
   * 좌표가 겹친 마커를 눌렀을 때 뜨는 목록. 1곳짜리 마커는 여기를 거치지 않고
   * 바로 상세로 간다 — 한 줄짜리 목록을 한 번 더 누르게 하는 것은 손해다.
   */
  const [group, setGroup] = useState<ToiletGroup | null>(null);
  /**
   * 열려 있는 목록의 평균 별점. 리뷰가 없는 곳은 들어 있지 않다.
   *
   * 어느 묶음의 것인지(`key`)를 같이 담는다. 안 담으면 다음 묶음을 여는 순간
   * 앞 묶음의 별점이 잠깐 붙는다 — 위치 지정 패널이 주소에 `at` 을 담는 것과
   * 같은 이유다.
   */
  const [groupRatings, setGroupRatings] = useState<{
    key: string;
    ratings: Map<string, number>;
  } | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("pending");
  const [center, setCenter] = useState(INHA_UNIV);
  /** 브라우저가 알려준 오차 반경(m). 위치를 못 받았으면 null. */
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });
  /**
   * 「바로 안내」가 고른 근거. **어느 화장실의 것인지를 같이 담는다** — 안 담으면
   * 그 뒤에 다른 마커를 직접 눌러 길찾기를 해도 앞의 근거 문구가 그대로 남아
   * 사용자가 고른 곳을 앱이 고른 것처럼 말하게 된다. groupRatings 가 key 를
   * 담는 것과 같은 이유다.
   */
  const [guide, setGuide] = useState<{
    toiletId: string;
    reason: GuidePick["reason"];
  } | null>(null);
  /** 후보의 별점을 받는 동안. 버튼이 반응 없이 멈춘 것처럼 보이지 않게 한다. */
  const [guideBusy, setGuideBusy] = useState(false);
  /** 반경 안에 아무것도 없었다. 다음 시도에서 지워진다. */
  const [guideEmpty, setGuideEmpty] = useState(false);
  const [toiletsError, setToiletsError] = useState<string | null>(null);
  /** 지도가 보고 있는 영역. 지도가 생기기 전에는 null 이라 조회를 미룬다. */
  const [viewport, setViewport] = useState<Bounds | null>(null);
  /** 조회 상한에 걸려 일부만 왔는지. 확대를 권해야 한다. */
  const [truncated, setTruncated] = useState(false);
  /** 화장실 추가 모드. 켜져 있으면 지도를 위치 고르는 데 쓴다. */
  const [addOpen, setAddOpen] = useState(initialAdd);
  /**
   * 좌표를 이미 아는 채로 추가 모드를 연 경우의 시작값. `+` 버튼으로 열면 null.
   *
   * 여기 담긴 좌표가 있으면 AddToilet 이 핀 맞추기를 건너뛰고 폼부터 연다.
   */
  const [addSeed, setAddSeed] = useState<AddSeed | null>(null);

  /**
   * 검토를 기다리는 **내** 제보. 서버에 묻지 않고 이 브라우저의 기록을 읽는다
   * (lib/toilets/my-submissions.ts).
   *
   * `useState` + `useEffect` 가 아니라 외부 저장소로 구독하는 이유 둘 —
   * 값을 바꾸는 곳이 `submitToilet` 안쪽(AddToiletForm → AddToilet 아래)이라
   * 콜백을 여기까지 끌어올리지 않아도 되고, effect 안에서 setState 하는 패턴을
   * 하나 더 늘리지 않는다.
   */
  const mySubmissions = useSyncExternalStore(
    subscribeMySubmissions,
    listMySubmissions,
    listMySubmissionsOnServer,
  );
  /** 점선 핀을 눌렀을 때 잠깐 뜨는 안내. 이름만 담는다. */
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

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
    setAddSeed(null);
    if (initialAdd) router.replace("/", { scroll: false });
  }, [initialAdd, router]);

  /**
   * 이미 등록된 화장실의 좌표에 한 곳을 더 추가한다.
   *
   * 같은 건물의 다른 층, 같은 층의 다른 성별이 여기 해당한다. 캠퍼스 실내
   * 화장실은 이런 식으로만 늘어나는데, 목록을 닫고 `+` 를 눌러 지도를 다시
   * 끌어야 한다면 그 마찰에서 대부분 그만둔다.
   *
   * **주소를 그 행에서 그대로 가져온다** — 좌표가 같으니 역지오코딩할 이유가 없다.
   */
  const openAddAt = useCallback((toilet: MappableToilet) => {
    setSelected(null);
    setGroup(null);
    setAddSeed({
      lat: toilet.lat,
      lng: toilet.lng,
      address: { road: toilet.road_address, jibun: toilet.jibun_address },
      // 이름에서 끌어오지 않는다. 공공데이터의 이름은 `인하대학교` 같은 부지
      // 단위라 건물칸에 박히면 틀린 값이 된다.
      building: toilet.building,
    });
    setAddOpen(true);
  }, []);

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
        const rows = page.toilets.filter(isMappable);
        setToilets(rows);
        setTruncated(page.truncated);
        // 검토를 통과해 지도에 올라온 제보는 점선 핀에서 뺀다. 승인 SQL 이
        // 좌표와 이름을 그대로 복사하므로 같은 자리에 같은 이름이 보이면 그게
        // 승인된 내 제보다. 승인 여부를 물을 API 가 따로 없다.
        forgetApproved(rows);
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

  /**
   * 현재 위치를 묻는다. 거부·실패해도 기본 중심으로 지도는 그대로 뜬다.
   *
   * state 는 브라우저 콜백 안에서만 건드린다. 여기서 바로 setLocationState 를
   * 부르면 아래 마운트 effect 가 "effect 안 동기 setState" 가 돼 버린다
   * (react-hooks/set-state-in-effect). 초기값이 이미 pending 이라 마운트
   * 때는 되돌릴 것도 없다.
   */
  const askLocation = useCallback(() => {
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

  useEffect(() => {
    askLocation();
  }, [askLocation]);

  /**
   * 「바로 안내」가 위치 없이 눌렸을 때 다시 묻는다. 한 번 거부한 사람이 마음을
   * 바꿀 자리가 그것뿐이다 — 브라우저가 다시 물을지는 브라우저가 정하지만,
   * 안 물으면 실패 콜백이 같은 안내를 다시 띄운다.
   */
  const requestLocation = useCallback(() => {
    // 딥링크 잠금을 여기서 푼다. 링크로 들어왔더라도 "내 위치로"를 직접 누른
    // 사람에게는 지도가 따라와야 한다.
    holdFocusRef.current = false;
    setLocationState("pending");
    askLocation();
  }, [askLocation]);

  // 지도 생성. mapRef 가 채워져 있으면 다시 만들지 않는다.
  useEffect(() => {
    if (!sdkReady || !containerRef.current || mapRef.current) return;
    const map = new kakao.maps.Map(containerRef.current, {
      // 딥링크가 있으면 그 좌표에서 만든다. 만든 뒤에 옮기면 첫 화면이 한 번
      // 튀고, 지나가는 영역의 화장실까지 헛으로 조회한다.
      center: new kakao.maps.LatLng(
        focusLat ?? center.lat,
        focusLng ?? center.lng,
      ),
      level: focusLevel ?? DEFAULT_LEVEL,
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
  }, [sdkReady, center, focusLat, focusLng, focusLevel]);

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

  /**
   * 주소에 좌표가 있으면 그 곳을 연다.
   *
   * 지도를 만들 때 이미 반영되는데도 이 effect 가 따로 있는 이유 — 지도를 보고
   * 있는 채로 사이드바의 「인하대 화장실」을 누르면 **주소만 바뀌고 이 컴포넌트는
   * 그대로 있다.** `?add=1` 에 마운트 effect 를 하나 더 둔 것과 같은 이유다.
   *
   * 아래 effect 보다 **먼저** 선언돼 있어야 한다. 같은 커밋에서 둘 다 돌 때
   * (SDK 준비 완료) 잠금이 먼저 걸려야 위치가 지도를 뺏어가지 않는다.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!sdkReady || !map || focusLat === null || focusLng === null) return;
    holdFocusRef.current = true;
    map.setCenter(new kakao.maps.LatLng(focusLat, focusLng));
    map.setLevel(focusLevel ?? DEFAULT_LEVEL);
  }, [focusLat, focusLng, focusLevel, sdkReady]);

  /**
   * 위치를 나중에 받아왔을 때 중심을 옮긴다.
   *
   * 딥링크로 들어왔으면 **옮기지 않는다.** 몇 초 뒤 지도가 내 위치로 튀면
   * 링크가 무효가 된다 — 인하대 화장실을 보라고 준 링크인데 내 방이 열린다.
   * 파란 점·반경 계산·조회는 그대로 돈다. 중심만 안 옮긴다.
   */
  useEffect(() => {
    if (!sdkReady || !mapRef.current || holdFocusRef.current) return;
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

  /**
   * 좌표가 같은 것끼리 묶은 마커 단위. 앱바의 "1km 이내 N곳"은 **묶음이 아니라
   * 화장실 곳 수**를 말해야 하므로 summarizeNearby 는 그대로 toilets 를 본다.
   */
  const groups = useMemo(() => groupByCoords(toilets ?? []), [toilets]);

  /** 다른 화장실을 고르면 앞서 그린 경로는 더 이상 맞지 않으므로 지운다. */
  const chooseToilet = useCallback((toilet: MappableToilet) => {
    setSelected(toilet);
    setGroup(null);
    setRouteState((prev) =>
      prev.status !== "idle" && prev.toilet.id !== toilet.id
        ? { status: "idle" }
        : prev,
    );
  }, []);

  // 화장실 마커.
  useEffect(() => {
    const map = mapRef.current;
    if (!sdkReady || !map) return;

    const created = groups.map((item) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(item.lat, item.lng),
        title:
          item.toilets.length > 1
            ? `${item.toilets[0].name} 외 ${item.toilets.length - 1}곳`
            : item.toilets[0].name,
        // 진하기는 바로 아래 effect 가 반경을 보고 다시 정한다.
        image: toiletMarkerImage("normal", item.toilets.length),
        zIndex: MARKER_Z.normal,
      });
      marker.setMap(map);
      kakao.maps.event.addListener(marker, "click", () => {
        // 위치를 고르는 중에는 지도가 "어디에 둘지"를 묻는 화면이다. 여기서
        // 상세 시트가 뜨면 두 화면이 겹친다.
        if (addOpenRef.current) return;
        if (item.toilets.length === 1) {
          chooseToilet(item.toilets[0]);
          return;
        }
        // 겹친 곳은 목록을 먼저 보인다. 무엇이 있는지 모르고 하나를 고를 수는 없다.
        setSelected(null);
        setGroup(item);
      });
      return {
        key: item.key,
        ids: item.toilets.map((toilet) => toilet.id),
        count: item.toilets.length,
        marker,
      };
    });
    markersRef.current = created;

    return () => {
      created.forEach(({ marker }) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [groups, sdkReady, chooseToilet]);

  // 선택된 핀은 키우고, 반경 밖 핀은 흐리게 한다. 마커를 다시 만들면 깜빡이므로
  // 이미지만 갈아 끼운다. nearIds 가 null 이면 기준점이 없다는 뜻이라 전부 진하다.
  //
  // 판정은 **묶음 단위**다. 겹친 것 중 하나라도 반경 안이면 진하게 둔다 — 그
  // 마커를 흐리게 하면 반경 안 화장실로 가는 유일한 입구가 안 보인다.
  useEffect(() => {
    markersRef.current.forEach(({ ids, count, marker }) => {
      const state: MarkerState = ids.includes(selected?.id ?? "")
        ? "selected"
        : nearIds && !ids.some((id) => nearIds.has(id))
          ? "far"
          : "normal";
      marker.setImage(toiletMarkerImage(state, count));
      marker.setZIndex(MARKER_Z[state]);
    });
  }, [selected, groups, sdkReady, nearIds]);

  /*
    검토 중인 내 제보의 점선 핀.

    위 마커들과 **다른 effect** 인 이유: 이건 DB 조회 결과가 아니라 이 브라우저의
    기록이라 갱신되는 시점이 다르다(제보 직후 · 승인 확인 시). 한 effect 로
    묶으면 화장실 목록이 바뀔 때마다 이쪽 핀까지 지웠다 다시 그린다.

    반경 판정도, 겹침 묶기도 하지 않는다. 승인 전까지는 남의 화장실과 같은 줄에
    설 물건이 아니고, 개수도 몇 개뿐이다.
  */
  useEffect(() => {
    const map = mapRef.current;
    if (!sdkReady || !map || mySubmissions.length === 0) return;

    const created = mySubmissions.map((entry) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(entry.lat, entry.lng),
        title: `${entry.name} (검토 중)`,
        image: toiletMarkerImage("pending"),
        zIndex: MARKER_Z.pending,
      });
      marker.setMap(map);
      kakao.maps.event.addListener(marker, "click", () => {
        // 위치를 고르는 중에는 지도가 "어디에 둘지"를 묻는 화면이다.
        if (addOpenRef.current) return;
        setPendingNotice(entry.name);
      });
      return marker;
    });

    return () => created.forEach((marker) => marker.setMap(null));
  }, [mySubmissions, sdkReady]);

  /*
    안내는 잠깐만 띄운다. 닫기 버튼을 붙일 만큼의 내용이 아니고, 남겨 두면 다른
    안내(경로·오차)를 계속 아래로 밀어낸다.

    타이머 콜백이라 effect 안에서 바로 setState 하는 것과 다르다.
  */
  useEffect(() => {
    if (!pendingNotice) return;
    const timer = setTimeout(() => setPendingNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [pendingNotice]);

  // 목록에 붙일 평균 별점. 목록이 열릴 때만 한 번 받는다.
  useEffect(() => {
    if (!group) return;

    const { key } = group;
    let cancelled = false;
    fetchRatingsFor(group.toilets.map((toilet) => toilet.id))
      .then((ratings) => {
        if (!cancelled) setGroupRatings({ key, ratings });
      })
      // 별점을 못 받아도 목록 자체는 쓸 수 있다. 배지만 안 붙는다.
      .catch(() => {
        if (!cancelled) setGroupRatings({ key, ratings: new Map() });
      });
    return () => {
      cancelled = true;
    };
  }, [group]);

  /*
    경로 폴리라인. 바뀌면 지웠다 다시 그린다.

    도보 경로를 못 받은 straight 일 때도 그린다 — 출발지와 도착지를 잇는 선
    하나다. 아무것도 안 그리면 화면에는 배너 글자만 남아 어느 쪽으로 가야 하는지
    모르게 된다. 대신 **점선**이라 "이 길로 가라"가 아니라 "저쪽 방향"으로 읽힌다.
  */
  useEffect(() => {
    const map = mapRef.current;
    if (!sdkReady || !map) return;
    if (routeState.status !== "ready" && routeState.status !== "straight")
      return;

    const points =
      routeState.status === "ready"
        ? routeState.route.path
        : [
            routeState.origin,
            { lat: routeState.toilet.lat, lng: routeState.toilet.lng },
          ];

    const path = points.map(
      (point) => new kakao.maps.LatLng(point.lat, point.lng),
    );

    const polyline = new kakao.maps.Polyline({
      path,
      strokeWeight: 6,
      strokeColor: ROUTE_COLOR,
      strokeOpacity: 0.9,
      strokeStyle: routeState.status === "ready" ? "solid" : "shortdash",
    });
    polyline.setMap(map);

    // 경로 전체가 보이도록 맞추되, 위 배너와 아래 상세 시트에 가리지 않게 여백을 준다.
    const bounds = new kakao.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    map.setBounds(bounds, 170, 40, 260, 40);

    return () => polyline.setMap(null);
  }, [routeState, sdkReady]);

  /**
   * 화장실을 인자로 받는다. selected 를 읽으면 「바로 안내」가 못 쓴다 —
   * setSelected 직후에는 아직 옛 값이라 엉뚱한 곳으로 경로를 그린다.
   */
  const navigateTo = useCallback(
    async (toilet: MappableToilet | null) => {
      if (!toilet || locationState !== "granted") return;

      setRouteState({ status: "loading", toilet });

      // 요청 중에 다른 화장실로 옮겨갔다면 늦게 온 응답은 버린다.
      const applyIfCurrent = (next: RouteState) =>
        setRouteState((prev) =>
          prev.status === "loading" && prev.toilet.id === toilet.id
            ? next
            : prev,
        );

      try {
        const route = await fetchWalkRoute({
          start: center,
          end: { lat: toilet.lat, lng: toilet.lng },
          endName: toilet.name,
        });
        applyIfCurrent({ status: "ready", toilet, route });
      } catch {
        /*
          도보 경로를 못 받았다. 오류를 띄우고 끝내면 화면에 아무것도 안 남아
          방향조차 모르게 된다. 직선거리는 여기서 계산하는 값이라 TMAP 이
          어떻든 항상 나오므로 그것으로 대신 안내한다.

          실패 이유를 가리지 않는 이유 — 한도 초과(502)든 네트워크든 사용자가
          할 수 있는 일은 같다. 이유를 나눠 봤자 문구만 늘어난다.
        */
        applyIfCurrent({
          status: "straight",
          toilet,
          origin: center,
          distanceMeters: straightLineDistance(center, toilet),
        });
      }
    },
    [center, locationState],
  );

  /**
   * 「바로 안내」 — 버튼 하나로 갈 곳을 정하고 경로까지 그린다.
   *
   * 위치 권한이 없으면 다시 요청한다. 버튼을 감추면 왜 없는지 알 수 없고,
   * 눌러도 아무 일이 없으면 고장으로 읽힌다.
   */
  const handleGuide = useCallback(async () => {
    if (locationState !== "granted") {
      requestLocation();
      return;
    }

    const candidates = nearbyCandidates(toilets ?? [], center);
    setGuideEmpty(candidates.length === 0);
    if (candidates.length === 0) return;

    setGuideBusy(true);
    // 별점을 못 받아도 안내는 한다. 그러면 pickBest 가 nearest 로 떨어질 뿐이라
    // 리뷰가 아직 없는 지역과 같은 결과가 된다 — 급한 사람을 빈손으로 두지 않는다.
    const ratings = await fetchRatingsFor(
      candidates.map((it) => it.toilet.id),
    ).catch(() => EMPTY_RATINGS);
    setGuideBusy(false);

    const pick = pickBest(candidates, ratings);
    if (!pick) return;

    setGuide({ toiletId: pick.toilet.id, reason: pick.reason });
    chooseToilet(pick.toilet);
    navigateTo(pick.toilet);
  }, [
    locationState,
    requestLocation,
    toilets,
    center,
    chooseToilet,
    navigateTo,
  ]);

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
    // 아직 위치가 없으면 옮길 곳이 없다. 다시 묻고, 받으면 center 가 바뀌어
    // 위의 effect 가 지도를 옮긴다. 예전에는 이 경우 버튼이 disabled 라서
    // **눌러도 아무 일이 없고 위치를 다시 받을 길도 없었다.**
    if (locationState !== "granted") {
      requestLocation();
      return;
    }

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
  }, [center, locationState, requestLocation]);

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
              selected || group ? "lg:pl-[27rem]" : ""
            }`}
          >
            {routeState.status !== "idle" && (
              <div className="pointer-events-auto w-full">
                <RouteBanner
                  state={routeState}
                  originUncertain={locationCoarse}
                  reason={
                    guide?.toiletId === routeState.toilet.id
                      ? guide.reason
                      : undefined
                  }
                  onCancel={() => setRouteState({ status: "idle" })}
                />
              </div>
            )}

            {pendingNotice && (
              <Notice tone="signal">
                {pendingNotice} · 검토 중이에요 · 승인되면 지도에 올라갑니다
              </Notice>
            )}

            {guideEmpty && (
              <Notice tone="signal">
                {RADIUS_LABEL} 이내에 화장실이 없어요 · 지도를 옮겨 찾아보세요
              </Notice>
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
              selected || group ? "bottom-60 lg:bottom-6" : "bottom-6"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setAddOpen(true);
                // 지도에서 직접 고르는 흐름이다. 앞서 목록에서 열어 둔 좌표가
                // 남아 있으면 핀 맞추기를 건너뛰어 버린다.
                setAddSeed(null);
                // 시트가 열린 채로 두면 아래에서 두 시트가 겹친다.
                setSelected(null);
                setGroup(null);
              }}
              disabled={!sdkReady}
              aria-label="화장실 추가"
              className="grid h-12 w-12 place-items-center rounded-full bg-brand text-brand-ink shadow-float hover:bg-brand-strong disabled:bg-surface disabled:text-muted"
            >
              <Icon name="add" className="h-6 w-6" />
            </button>

            {/*
              지도를 끌고 다니다 돌아올 길. 위치를 아직 못 받았어도 누를 수
              있다 — 그때는 위치를 다시 묻는다. 묻는 중에만 잠근다(연타 방지).
            */}
            <button
              type="button"
              onClick={handleRecenter}
              disabled={!sdkReady || locationState === "pending"}
              aria-label="현재 위치로 이동"
              className="grid h-12 w-12 place-items-center rounded-full bg-surface text-brand shadow-float hover:bg-sunken disabled:text-muted"
            >
              <Icon name="myLocation" className="h-[22px] w-[22px]" />
            </button>
          </div>
        )}

        {/*
          「바로 안내」 — 들어가자마자 누르는 버튼이라 오른쪽 아래 FAB 스택이
          아니라 하단 중앙에 둔다. 상세·목록이 열렸으면 그 안에 이미 길찾기
          버튼이 있고, 추가 모드에서는 지도가 "어디에 둘지"를 묻는 화면이다.

          감싸는 줄이 `pointer-events-none` 인 이유 — inset-x-0 이라 화면 전폭을
          차지해 같은 bottom-6 에 있는 FAB 스택을 덮는다. 둘 다 z-10 인데 이쪽이
          DOM 에서 나중이라 이겨서 **위치 버튼이 눌리지 않았다.** 줄은 클릭을
          통과시키고 버튼만 pointer-events-auto 로 받는다.
        */}
        {!selected && !group && !addOpen && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-24">
            <button
              type="button"
              onClick={handleGuide}
              disabled={!sdkReady || guideBusy || toilets === null}
              className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-brand px-5 py-3 font-semibold text-brand-ink shadow-float hover:bg-brand-strong disabled:bg-surface disabled:text-muted"
            >
              <Icon name="directions" className="h-5 w-5 shrink-0" />
              <span className="truncate">
                {guideBusy ? "찾는 중…" : "가장 가까운 화장실 안내"}
              </span>
            </button>
          </div>
        )}

        {addOpen && mapInstance && (
          <AddToilet
            map={mapInstance}
            toilets={toilets ?? []}
            seed={addSeed}
            onClose={closeAdd}
          />
        )}

        {group && !selected && (
          <ToiletListSheet
            key={group.key}
            group={group}
            ratings={
              groupRatings?.key === group.key
                ? groupRatings.ratings
                : EMPTY_RATINGS
            }
            onSelect={chooseToilet}
            // 좌표와 주소는 묶음 안에서 다 같다. 건물명은 첫 행의 것을 쓴다.
            onAdd={() => openAddAt(group.toilets[0])}
            onClose={() => setGroup(null)}
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
            onNavigate={() => navigateTo(selected)}
            onAdd={() => openAddAt(selected)}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </>
  );
}
