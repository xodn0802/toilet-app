import ToiletMap from "@/components/ToiletMap";

/**
 * `?add=1` 은 사이드바의 "화장실 등록"이 붙이는 것이다. 등록을 별도 라우트로
 * 만들지 않는 이유 — 지도를 다른 페이지로 옮기면 지도가 다시 만들어져 사용자가
 * 보던 위치·축척을 잃는다. 그래서 같은 화면에 모드로 얹는다.
 *
 * Next 16 에서 searchParams 는 Promise 다. 읽는 순간 이 페이지는 요청 시점에
 * 렌더된다(지도는 어차피 클라이언트에서 그린다).
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { add } = await searchParams;

  return (
    <main className="flex h-full flex-col">
      <ToiletMap initialAdd={add === "1"} />
    </main>
  );
}
