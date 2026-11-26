"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { readJsonResponseSafe } from "@/lib/media-utils";

interface AdminLoginClientProps {
  readonly authRequired: boolean;
  readonly siteAdminConfigured: boolean;
  readonly photoAdminConfigured: boolean;
}

export function AdminLoginClient({
  authRequired,
  siteAdminConfigured,
  photoAdminConfigured,
}: AdminLoginClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRoleParam = searchParams.get("role");

  const [accountType, setAccountType] = useState<"admin" | "photo">(() =>
    initialRoleParam === "photo" ? "photo" : "admin"
  );
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rawNext = searchParams.get("next") ?? "/admin";
  const safeNext =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";

  const activePasswordConfigured =
    accountType === "photo" ? photoAdminConfigured : siteAdminConfigured;

  async function submitLogin(targetAccount: "admin" | "photo", pwd: string) {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: targetAccount, password: pwd }),
      });
      const data = await readJsonResponseSafe<{
        readonly ok?: boolean;
        readonly redirectTo?: string;
        readonly error?: string;
      }>(response);
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "비밀번호가 일치하지 않습니다.");
      }
      const destination =
        targetAccount === "photo"
          ? "/admin/photos"
          : safeNext === "/admin/photos"
            ? "/admin/photos"
            : safeNext;
      router.push(destination);
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "로그인 처리 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[75vh] bg-[#F8FAF8] flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-7 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center">
          <img
            src="/gapck-logo.svg"
            alt="일광교회"
            className="w-10 h-14 object-contain mb-3"
          />
          <h1 className="text-2xl font-black text-[#1a2744]">
            일광교회 담당자 로그인
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            역할에 맞는 계정 유형을 선택한 뒤 비밀번호를 입력해 주세요
          </p>
        </div>

        {/* 2-Role Account Selector */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-gray-100">
          <button
            type="button"
            onClick={() => {
              setAccountType("admin");
              setErrorMsg(null);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
              accountType === "admin"
                ? "bg-[#1a2744] text-white shadow-xs"
                : "text-gray-600 hover:text-[#1a2744]"
            }`}
          >
            사이트 관리자 모드
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountType("photo");
              setErrorMsg(null);
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
              accountType === "photo"
                ? "bg-[#2E7D32] text-white shadow-xs"
                : "text-gray-600 hover:text-[#2E7D32]"
            }`}
          >
            사진 업로드 전용
          </button>
        </div>

        <div className="rounded-xl bg-[#F8FAF8] border border-gray-200 px-4 py-3 text-xs text-gray-600 leading-relaxed">
          {accountType === "admin" ? (
            <>
              <p className="font-bold text-[#1a2744]">사이트 전체 관리자</p>
              <p className="mt-0.5">
                주보, 설교, 새가족 문의함, 앨범, 메뉴 및 전체 콘텐츠를 관리합니다.
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-[#2E7D32]">사진 및 동영상 업로드 전용</p>
              <p className="mt-0.5">
                교회 앨범 사진과 동영상 업로드 화면만 열립니다.
              </p>
            </>
          )}
        </div>

        {!authRequired && (
          <div className="rounded-xl bg-[#E8F5E9] border border-[#2E7D32]/25 p-4 text-xs text-gray-700 leading-relaxed space-y-2">
            <p className="font-bold text-[#2E7D32]">로컬 개발 환경 빠른 전환</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void submitLogin("admin", "")}
                className="px-3.5 py-1.5 rounded-full bg-[#1a2744] text-white font-bold hover:bg-black transition-colors"
              >
                사이트 관리자로 열기 →
              </button>
              <button
                type="button"
                onClick={() => void submitLogin("photo", "")}
                className="px-3.5 py-1.5 rounded-full bg-[#2E7D32] text-white font-bold hover:bg-[#1B5E20] transition-colors"
              >
                사진 전용 계정으로 열기 →
              </button>
            </div>
          </div>
        )}

        {authRequired && !activePasswordConfigured && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 leading-relaxed">
            선택하신 계정의 비밀번호가 아직 설정되지 않았습니다. 교회 홈페이지 담당자에게 문의해 주세요.
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-bold text-red-700"
          >
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitLogin(accountType, password);
          }}
          className="space-y-4"
        >
          <input
            type="text"
            name="username"
            autoComplete="username"
            readOnly
            value={accountType}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <div>
            <label
              htmlFor="admin-password-input"
              className="block text-xs font-bold text-gray-700 mb-1.5"
            >
              {accountType === "photo"
                ? "사진 업로드 전용 비밀번호"
                : "사이트 관리자 비밀번호"}
            </label>
            <input
              id="admin-password-input"
              type="password"
              required={authRequired}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력해 주세요"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#2E7D32] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className={`block w-full text-center py-3 rounded-[26px] text-white text-sm font-bold transition-colors disabled:opacity-60 ${
              accountType === "photo"
                ? "bg-[#2E7D32] hover:bg-[#1B5E20]"
                : "bg-[#1a2744] hover:bg-[#2E7D32]"
            }`}
          >
            {submitting
              ? "확인 중..."
              : accountType === "photo"
                ? "사진 업로드 스튜디오 로그인"
                : "사이트 관리자 모드 로그인"}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
          <Link href="/" className="hover:text-[#2E7D32]">
            ← 홈페이지 메인으로
          </Link>
          <Link href="/news/gallery" className="hover:text-[#2E7D32]">
            앨범 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
