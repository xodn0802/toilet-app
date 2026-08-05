"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase/client";

import { randomNickname } from "./nickname";

/**
 * 익명 신원.
 *
 * 로그인 화면이 없다. 사용자는 "로그인"이라는 말을 아예 만나지 않고, 리뷰를
 * 등록하는 순간 Supabase 익명 계정이 조용히 만들어진다. 신원이 필요한 이유는
 * 리뷰 남용 방지 하나뿐이고, 그 목적에는 카카오 계정까지 필요하지 않았다.
 *
 * 익명 계정도 auth.users 에 진짜 행이 생기고 JWT 의 role 이 'authenticated' 라
 * reviews 의 RLS 정책이 그대로 적용된다(0003_reviews_anonymous.sql 참고).
 *
 * 한계는 분명하다 — 브라우저 데이터를 지우면 다른 사람이 되고, 기기를 바꾸면
 * 자기 리뷰를 못 지운다. 그래서 남용은 신원이 아니라 규칙이 막는다:
 * unique(toilet_id, user_id) 가 한 화장실에 하나만 허용한다.
 *
 * 나중에 카카오를 얹고 싶으면 auth.linkIdentity({provider:'kakao'}) 로 같은
 * user_id 에 붙이면 된다. 이미 쓴 리뷰가 그대로 따라온다.
 */

/** 지금 브라우저가 들고 있는 신원. */
export type Who = { userId: string; nickname: string };

export type Identity = {
  /** 아직 발급 전이면 null. 리뷰를 한 번도 안 쓴 브라우저가 그렇다. */
  who: Who | null;
  /**
   * 신원을 확보한다. 없으면 만든다.
   *
   * **리뷰를 등록하려는 순간에만 부른다.** 방문할 때마다 부르면 auth.users 에
   * 아무것도 안 한 유령 계정이 쌓인다.
   */
  ensure: () => Promise<Who>;
};

function whoOf(user: User): Who {
  const nickname = user.user_metadata?.nickname;
  return {
    userId: user.id,
    // 별명은 가입할 때 넣으므로 비어 있을 일이 없다. 그래도 비었다면 그때마다
    // 새 별명을 뽑는 대신 고정값을 쓴다 — 같은 사람이 매번 달라 보이면 안 된다.
    nickname:
      typeof nickname === "string" && nickname.trim()
        ? nickname.trim()
        : "익명",
  };
}

export function useIdentity(): Identity {
  const [who, setWho] = useState<Who | null>(null);

  /**
   * 진행 중인 ensure(). 두 번 눌려도 계정이 두 개 생기지 않게 붙잡아 둔다.
   * state 로 두면 이미 실행 중인 콜백의 클로저에는 반영되지 않는다.
   */
  const pending = useRef<Promise<Who> | null>(null);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;

    // 이펙트 본문에서 setState 를 바로 부르면 렌더가 연쇄로 돈다. 그래서
    // 환경변수 없음(= getSupabaseClient() 가 던짐)까지 이 안에서 처리한다.
    void (async () => {
      try {
        const supabase = getSupabaseClient();

        // 구독하면 저장돼 있던 세션이 INITIAL_SESSION 으로 한 번 들어온다.
        // 그래서 여기서 getSession() 을 따로 부르지 않는다. **없으면 만들지도
        // 않는다** — 발급은 ensure() 를 부른 쪽이 결정한다.
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!alive) return;
          setWho(session ? whoOf(session.user) : null);
        });

        // await 사이에 언마운트됐을 수 있다. 그러면 정리 함수는 이미 지나갔다.
        if (!alive) {
          data.subscription.unsubscribe();
          return;
        }
        unsubscribe = () => data.subscription.unsubscribe();
      } catch {
        // 환경변수가 없는 경우. 신원만 못 만들 뿐 지도는 계속 써야 한다.
        // 실제 실패는 ensure() 가 던져서 리뷰 폼에 그대로 보여 준다.
      }
    })();

    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  const ensure = useCallback(async (): Promise<Who> => {
    if (pending.current) return pending.current;

    const run = (async () => {
      const supabase = getSupabaseClient();

      // state 가 아니라 라이브러리에 직접 묻는다. 콜백이 오래된 값을 클로저에
      // 가두고 있어도 여기서 판단이 갈리면 안 된다.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return whoOf(session.user);

      const { data, error } = await supabase.auth.signInAnonymously({
        options: { data: { nickname: randomNickname() } },
      });

      // 대시보드에서 "Allow anonymous sign-ins" 를 안 켰으면 여기서 막힌다.
      // 원인을 감추지 않는다 — 지도 실패 문구를 도메인 하나로 단정했다가 헤맸다.
      if (error) {
        throw new Error(
          `리뷰를 남길 준비를 하지 못했습니다 · ${error.message}`,
        );
      }
      if (!data.user) {
        throw new Error(
          "리뷰를 남길 준비를 하지 못했습니다 · 신원이 비어 있음",
        );
      }
      return whoOf(data.user);
    })();

    pending.current = run;
    try {
      return await run;
    } finally {
      pending.current = null;
    }
  }, []);

  return { who, ensure };
}
