import type { WalkRoute, WalkRouteRequest } from "./types";

/**
 * 도보 경로를 요청한다. 실패하면 화면에 그대로 띄울 수 있는 문구로 던진다.
 * TMAP 호출은 서버(app/api/walk-route)에서 일어난다.
 */
export async function fetchWalkRoute(
  body: WalkRouteRequest,
): Promise<WalkRoute> {
  const response = await fetch("/api/walk-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const { error } = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(error ?? "경로를 불러오지 못했습니다.");
  }

  return response.json() as Promise<WalkRoute>;
}
