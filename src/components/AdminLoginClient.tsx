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
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rawNext = searchParams.get("next") ?? "/admin";
  const safeNext =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";

  const activePasswordConfigured =
    accountType === "photo" ? photoAdminConfigured : siteAdminConfigured;
  const hasHangulInPassword = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(password);

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
    <div className="min-h-[78vh] bg-[#F8FAF8] flex items-center justify-center px-5 py-14">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-gray-200 p-7 sm:p-9 space-y-6">
        <div className="flex flex-col items-center text-center">
          <img
            src="/gapck-logo.svg"
            alt="일광교회"
            className="w-10 h-14 object-contain mb-3"
          />
          <h1 className="text-2xl sm:text-3xl font-black text-[#1a2744]">
            관리자 로그인
          </h1>
        </div>

        {/* Role Selector */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-gray-100">
            <button
              type="button"
              onClick={() => {
                setAccountType("admin");
                setErrorMsg(null);
              }}
              className={`py-3 px-3 rounded-xl text-sm sm:text-base font-black transition-all ${
                accountType === "admin"
                  ? "bg-[#1a2744] text-white shadow-sm"
                  : "text-gray-700 hover:text-[#1a2744]"
              }`}
            >
              사이트 관리자
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountType("photo");
                setErrorMsg(null);
              }}
              className={`py-3 px-3 rounded-xl text-sm sm:text-base font-black transition-all ${
                accountType === "photo"
                  ? "bg-[#2E7D32] text-white shadow-sm"
                  : "text-gray-700 hover:text-[#2E7D32]"
              }`}
            >
              사진 업로드 전용
            </button>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 text-center font-medium">
            {accountType === "admin"
              ? "주보, 설교, 문의함 등 전체 메뉴 관리"
              : "예배 및 행사 사진 앨범 등록 전용"}
          </p>
        </div>

        {!authRequired && (
          <div className="rounded-2xl bg-[#E8F5E9] border border-[#2E7D32]/30 p-4 text-sm text-gray-800 space-y-2.5">
            <p className="font-black text-[#1B5E20]">로컬 개발 환경 바로 열기</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void submitLogin("admin", "")}
                className="px-4 py-2 rounded-full bg-[#1a2744] text-white font-bold hover:bg-black transition-colors"
              >
                사이트 관리자
              </button>
              <button
                type="button"
                onClick={() => void submitLogin("photo", "")}
                className="px-4 py-2 rounded-full bg-[#2E7D32] text-white font-bold hover:bg-[#1B5E20] transition-colors"
              >
                사진 업로드 전용
              </button>
            </div>
          </div>
        )}

        {authRequired && !activePasswordConfigured && (
          <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-sm text-amber-950">
            비밀번호가 아직 설정되지 않았습니다. 담당자에게 문의해 주세요.
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-2xl bg-red-50 border border-red-300 px-4 py-3 text-sm font-bold text-red-800"
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
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="admin-password-input"
                className="block text-sm font-extrabold text-[#1a2744]"
              >
                비밀번호
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm font-bold text-[#1a2744] transition-colors"
              >
                {showPassword ? "글자 가리기" : "글자 보기"}
              </button>
            </div>

            <input
              id="admin-password-input"
              type={showPassword ? "text" : "password"}
              required={authRequired}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
              onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
              placeholder="비밀번호 입력"
              className="w-full rounded-xl border-2 border-gray-300 px-4 py-3.5 text-base font-bold focus:border-[#2E7D32] focus:outline-none"
            />

            {hasHangulInPassword && (
              <p
                role="status"
                className="rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-amber-950"
              >
                키보드가 한글 상태입니다. [한영 전환] 키를 눌러 영문으로 입력해 주세요.
              </p>
            )}
            {capsLockOn && !hasHangulInPassword && (
              <p
                role="status"
                className="rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-amber-950"
              >
                대문자 잠금 (Caps Lock)이 켜져 있습니다.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`block w-full text-center py-3.5 rounded-[28px] text-white text-base sm:text-lg font-black shadow-md transition-colors disabled:opacity-60 ${
              accountType === "photo"
                ? "bg-[#2E7D32] hover:bg-[#1B5E20]"
                : "bg-[#1a2744] hover:bg-[#2E7D32]"
            }`}
          >
            {submitting ? "확인 중..." : "로그인"}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 pt-3 border-t border-gray-100 font-bold">
          <Link href="/" className="hover:text-[#2E7D32]">
            ← 홈페이지로 돌아가기
          </Link>
          <a
            href="/church-admin-easy-manual.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2E7D32] hover:underline"
          >
            설명서 PDF 열기
          </a>
        </div>
      </div>
    </div>
  );
}
