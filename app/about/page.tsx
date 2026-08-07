import type { Metadata } from "next";
import Link from "next/link";

import Icon, { type IconName } from "@/components/Icons";
import { MenuButton } from "@/components/SideNav";

export const metadata: Metadata = {
  title: "소개 — 뿡",
  description:
    "뿡이 무엇을 보여주고, 무엇을 저장하지 않는지. 데이터 출처와 자주 묻는 질문.",
};

/*
  이 페이지에 적는 숫자와 문장은 전부 실제 동작이어야 한다. 없는 기능을 소개에만
  적어 두면 그게 가장 먼저 거짓말이 된다(계획의 "껍데기 UI 금지"). 그래서
  즐겨찾기·검색·필터·사진 이야기는 없고, 인천만 수집했다는 것도 그대로 적는다.
*/

/** 인천 공중화장실 지오코딩 성공분. scripts/ 실측치(2026-08-03). */
const TOILET_COUNT = "2,130";

function Card({
  icon,
  title,
  children,
  className = "",
}: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border border-line bg-surface p-6 ${className}`}
    >
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-soft-ink">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <h3 className="mb-2 text-base font-bold">{title}</h3>
      <div className="text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-line bg-surface open:bg-sunken">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-medium [&::-webkit-details-marker]:hidden">
        {q}
        <Icon
          name="expandMore"
          className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:-rotate-180"
        />
      </summary>
      <div className="px-4 pb-4 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </details>
  );
}

export default function AboutPage() {
  return (
    // 지도 페이지와 달리 여기는 내용이 화면보다 길다. html·body 가 h-full 이라
    // 스크롤을 이 래퍼가 직접 맡아야 한다.
    <div className="h-full overflow-y-auto bg-paper">
      {/*
        데스크톱에는 사이드바가 늘 서 있지만 모바일에는 없다. 이 줄이 없으면
        모바일에서 소개 페이지에 들어온 사람이 지도로 돌아갈 길을 잃는다.
      */}
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur-sm lg:hidden">
        <MenuButton />
        <span className="font-wordmark text-2xl leading-none text-brand">
          뿡
        </span>
        <span className="text-sm text-muted">소개</span>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pb-20">
        <section className="py-14 text-center md:py-20">
          <h1 className="text-3xl leading-tight font-bold text-brand md:text-4xl">
            급할 때 가까운 화장실을
            <br className="sm:hidden" /> 빠르게 찾으세요
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted">
            현재 위치를 기준으로 주변 화장실을 지도에 표시하고, 도보 경로까지
            안내합니다. 지금은 인천 {TOILET_COUNT}곳의 공중화장실을 담고
            있습니다.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-medium text-brand-ink shadow-float transition-colors hover:bg-brand-strong"
          >
            <Icon name="map" className="h-5 w-5" />
            지도 열기
          </Link>
        </section>

        <section className="mb-14">
          <h2 className="mb-5 text-label text-muted">이런 것을 합니다</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card
              icon="myLocation"
              title="현재 위치 기준 주변 화장실"
              className="md:col-span-2"
            >
              <p>
                위치를 허용하면 1km 이내에 몇 곳이 있는지 바로 알려주고, 반경
                밖은 흐리게 두어 함께 보여줍니다. 한 곳을 고르면 도보 경로와
                예상 시간을 지도 위에 그립니다.
              </p>
              <p className="mt-3">
                위치를 허용하지 않아도 지도는 그대로 씁니다. 다만 &ldquo;몇 미터
                떨어졌다&rdquo;처럼 기준점이 있어야 할 수 있는 말은 하지
                않습니다.
              </p>
            </Card>

            <Card icon="check" title="청결도">
              <p>
                다녀온 사람들의 별점을 5칸 막대로 보여줍니다. 아직 아무도 남기지
                않았다면 빈 칸으로 두고 &ldquo;아직 평가 없음&rdquo;이라고
                적습니다.
              </p>
              {/*
                CleanlinessMeter 와 같은 그림이다. 컴포넌트를 가져다 쓰지 않는
                이유 — 저쪽은 리뷰 배열을 받아 계산하는 물건이라 여기서 쓰려면
                가짜 리뷰를 지어내야 한다. 여기 있는 것은 설명용 그림이다.
              */}
              <div
                aria-hidden
                className="mt-5 flex gap-1 [&>span]:h-2 [&>span]:flex-1"
              >
                <span className="rounded-l-full bg-brand" />
                <span className="bg-brand" />
                <span className="bg-brand" />
                <span className="bg-brand" />
                <span className="rounded-r-full bg-line" />
              </div>
              <p className="mt-2 text-xs">깨끗</p>
            </Card>

            <Card icon="accessible" title="편의시설">
              <p className="mb-4">
                장애인 화장실·기저귀 교환대가 있는지 표시합니다. 공공데이터에
                값이 없으면 &ldquo;없음&rdquo;이 아니라 &ldquo;정보
                없음&rdquo;으로 둡니다 — 빈 값을 없다고 말하면 실제로 있는
                시설을 없다고 하게 됩니다.
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-soft-ink">
                  <Icon name="accessible" className="h-3.5 w-3.5" />
                  장애인
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-xs font-medium text-muted">
                  <Icon name="baby" className="h-3.5 w-3.5" />
                  기저귀 정보 없음
                </span>
              </div>
            </Card>

            <Card
              icon="addLocation"
              title="빠진 화장실 제보"
              className="md:col-span-2"
            >
              <p>
                공공데이터에는 카페·상가 화장실이 아예 없습니다. 지도에서{" "}
                <span className="font-medium text-ink">+</span> 를 눌러 위치를
                맞추고 정보를 적어 보내면 검토 뒤에 지도에 올립니다.
              </p>
              <p className="mt-3">
                <span className="font-medium text-ink">
                  보낸 즉시 지도에 뜨지는 않습니다.
                </span>{" "}
                확인 없이 올리면 잘못된 등록 하나가 급한 사람을 헛걸음시키기
                때문입니다.
              </p>
              <Link
                href="/?add=1"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                화장실 등록하러 가기
                <Icon name="expandMore" className="h-4 w-4 -rotate-90" />
              </Link>
            </Card>
          </div>
        </section>

        <section className="mb-14">
          <h2 className="mb-5 text-label text-muted">무엇을 저장하지 않는지</h2>
          <div className="rounded-2xl border border-line bg-surface p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <Icon name="shield" className="h-7 w-7 text-brand" />
              <h3 className="text-lg font-bold">
                모으지 않는 것이 더 많습니다
              </h3>
            </div>
            <dl className="space-y-5 text-sm leading-relaxed text-muted">
              <div>
                <dt className="font-bold text-ink">로그인이 없습니다</dt>
                <dd className="mt-1">
                  리뷰를 남기는 순간 이 브라우저에 별명 하나가 생길 뿐입니다.
                  이메일·전화번호·카카오 계정을 묻지 않습니다.
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink">
                  위치는 브라우저 안에서만 씁니다
                </dt>
                <dd className="mt-1">
                  현재 위치는 지도를 그리고 거리를 재는 데만 쓰고 저장하지
                  않습니다. 경로를 그릴 때만 출발지·도착지 좌표가 경로 계산에
                  쓰입니다.
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink">
                  다녀온 길을 남기지 않습니다
                </dt>
                <dd className="mt-1">
                  받아온 도보 경로는 화면에 그리고 끝입니다. 사용한 지도 API 의
                  약관이 24시간 이상 보관을 금지하고 있고, 애초에 저장할 이유도
                  없습니다.
                </dd>
              </div>
              <div>
                <dt className="font-bold text-ink">리뷰에는 별명만 남습니다</dt>
                <dd className="mt-1">
                  한 화장실에는 한 번만 남길 수 있습니다. 사진은 아직 받지
                  않습니다 — 신고·삭제 절차가 함께 있어야 하기 때문입니다.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section>
          <h2 className="mb-5 text-label text-muted">자주 묻는 질문</h2>
          <div className="space-y-3">
            <Faq q="화장실 정보는 어디서 가져오나요?">
              행정안전부의 공중화장실 정보(공공데이터포털)입니다. 여기에는
              좌표가 없어 주소를 좌표로 바꿔 지도에 찍습니다. 그래서 주소가 부지
              단위인 곳(대학 캠퍼스·공원 등)은 여러 건이 한 지점에 겹쳐 보일 수
              있습니다.
            </Faq>
            <Faq q="제 주변에는 아무것도 안 보여요.">
              지금은 인천 {TOILET_COUNT}곳만 담겨 있습니다. 다른 지역은 아직
              수집하지 않았습니다 — 지도가 비어 보인다면 화장실이 없는 게 아니라
              데이터가 없는 것입니다.
            </Faq>
            <Faq q="정보가 실제와 다릅니다.">
              청결도·휴지·비누처럼 자주 바뀌는 것은 리뷰로 남겨 주세요. 가장
              최근에 다녀온 사람의 말이 가장 정확합니다. 위치나 시설 정보 자체가
              틀렸다면 원본 공공데이터가 그런 경우가 많아, 지금은 제보로 받아
              사람이 확인합니다.
            </Faq>
            <Faq q="남녀공용인지 알 수 있나요?">
              공공데이터에 그 항목이 아예 없어 대부분 &ldquo;정보 없음&rdquo;
              입니다. 직접 등록한 화장실만 값이 채워집니다. 모르는 것을 아는
              척하지 않으려고 비워 둡니다.
            </Faq>
          </div>
        </section>
      </main>
    </div>
  );
}
