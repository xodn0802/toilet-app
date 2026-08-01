"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * 카카오 로그인 세션.
 *
 * 지도와는 아무 상관이 없는 관심사라 ToiletMap 밖으로 뺐다. 세션을 쓰는 곳이
 * ToiletMap 하나뿐이라 Context 는 두지 않는다 — AppBar·ReviewForm 은 props 로 받는다.
 *
 * 흐름은 리디렉트다. signIn() 이 카카오로 페이지를 통째로 넘기고, 돌아올 때
 * 주소창 해시에 토큰이 실려 온다. supabase-js 기본값이 flowType:"implicit" +
 * detectSessionInUrl:true 라 그 해시를 알아서 읽고 지운다. 그래서 /auth/callback
 * 같은 라우트가 필요 없다.
 */

/** "loading" 은 저장된 세션을 아직 못 읽은 상태. 로그인 여부를 아직 모른다. */
export type AuthStatus = "loading" | "in" | "out";

export type Auth = {
  status: AuthStatus;
  /** 카카오 닉네임. 동의항목을 거부했으면 null 이다. */
  nickname: string | null;
  error: string | null;
  signIn: () => void;
  signOut: () => void;
};

/**
 * 닉네임이 들어올 만한 자리들.
 *
 * Supabase 는 공급자가 준 값을 user_metadata 에 그대로 담는데 키 이름이
 * 공급자마다 다르다. 실제로 카카오가 어느 키를 쓰는지는 첫 로그인 때 확인한다.
 */
const NICKNAME_KEYS = ["name", "nickname", "full_name", "preferred_username"];

function nicknameOf(user: User): string | null {
  const meta: Record<string, unknown> = user.user_metadata ?? {};

  for (const key of NICKNAME_KEYS) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** 원인을 감추지 않는다. 지도 실패 문구를 도메인 하나로 단정했다가 한참 헤맸다. */
function describe(reason: unknown): string {
  const detail =
    reason instanceof Error ? reason.message : String(reason ?? "알 수 없음");
  return `로그인하지 못했습니다 · ${detail}`;
}

export function useAuth(): Auth {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [nickname, setNickname] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;

    // 이펙트 본문에서 setState 를 바로 부르면 렌더가 연쇄로 돈다. 그래서
    // 환경변수 없음(= getSupabaseClient() 가 던짐)까지 이 안에서 처리한다.
    void (async () => {
      try {
        const supabase = getSupabaseClient();

        // 카카오에서 취소·거부하고 돌아온 사실은 여기로만 온다.
        // getSession() 은 이 에러를 삼키고 "로그인 안 됨"만 돌려준다.
        const { error: initError } = await supabase.auth.initialize();
        if (!alive) return;
        if (initError) setError(describe(initError));

        // 구독하면 저장돼 있던 세션이 INITIAL_SESSION 으로 한 번 들어온다.
        // 그래서 getSession() 을 따로 부르지 않는다.
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!alive) return;
          setStatus(session ? "in" : "out");
          setNickname(session ? nicknameOf(session.user) : null);
        });

        // await 사이에 언마운트됐을 수 있다. 그러면 정리 함수는 이미 지나갔다.
        if (!alive) {
          data.subscription.unsubscribe();
          return;
        }
        unsubscribe = () => data.subscription.unsubscribe();
      } catch (reason) {
        // 환경변수가 없는 경우. 로그인만 못 할 뿐 지도는 계속 써야 한다.
        if (!alive) return;
        setStatus("out");
        setError(describe(reason));
      }
    })();

    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      // 성공하면 이 탭이 카카오로 떠나므로 아래 줄까지 오지 않는다.
      const { error: signInError } =
        await getSupabaseClient().auth.signInWithOAuth({
          provider: "kakao",
          // 배포별 URL(toilet-app-<해시>-….vercel.app)은 Supabase 에 등록돼 있지
          // 않아 여기서 막힌다. 카카오 지도 SDK 도 같은 이유로 거기선 안 뜬다.
          // 확인은 항상 프로덕션 URL 로 한다.
          options: { redirectTo: window.location.origin },
        });
      if (signInError) setError(describe(signInError));
    } catch (reason) {
      setError(describe(reason));
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut();
      if (signOutError) setError(describe(signOutError));
    } catch (reason) {
      setError(describe(reason));
    }
  }, []);

  return { status, nickname, error, signIn, signOut };
}
