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
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg border border-gray-200 p-7 sm:p-9 space-y-6">
        <div className="flex flex-col items-center text-center">
          <img
            src="/gapck-logo.svg"
            alt="일광교회"
            className="w-11 h-15 object-contain mb-3"
          />
          <h1 className="text-2xl sm:text-3xl font-black text-[#1a2744]">
            홈페이지 담당자 로그인
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1.5">
            ① 담당 역할을 고른 뒤 ② 비밀번호를 입력해 주세요
          </p>
        </div>

        {/* Step 1: 2-Role Account Selector */}
        <div className="space-y-2">
          <p className="text-xs sm:text-sm font-extrabold text-[#1a2744]">
            1단계: 어떤 작업을 하시나요?
          </p>
          <div className="grid grid-cols-2 gap-2.5 p-1.5 rounded-2xl bg-gray-100">
            <button
              type="button"
              onClick={() => {
                setAccountType("admin");
                setErrorMsg(null);
              }}
              className={`py-3.5 px-3 rounded-xl text-sm sm:text-base font-black transition-all ${
                accountType === "admin"
                  ? "bg-[#1a2744] text-white shadow-sm"
                  : "text-gray-700 hover:text-[#1a2744]"
              }`}
            >
              🔑 사이트 관리자 모드
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountType("photo");
                setErrorMsg(null);
              }}
              className={`py-3.5 px-3 rounded-xl text-sm sm:text-base font-black transition-all ${
                accountType === "photo"
                  ? "bg-[#2E7D32] text-white shadow-sm"
                  : "text-gray-700 hover:text-[#2E7D32]"
              }`}
            >
              📷 사진 업로드 전용
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-[#F8FAF8] border border-gray-200 px-4 py-3.5 text-sm text-gray-700 leading-relaxed">
          {accountType === "admin" ? (
            <>
              <p className="font-black text-[#1a2744] text-base">
                사이트 전체 관리자 — 목회자, 행정 담당자용
              </p>
              <p className="mt-1">
                주보, 설교 영상, 새가족 문의함, 앨범, 배경 사진 등 모든 메뉴를 관리합니다.
              </p>
            </>
          ) : (
            <>
              <p className="font-black text-[#2E7D32] text-base">
                사진 및 동영상 업로드 전용 — 앨범 봉사자용
              </p>
              <p className="mt-1">
                다른 설정을 건드릴 걱정 없이 교회 앨범 사진 올리기 화면만 열립니다.
              </p>
            </>
          )}
        </div>

        {!authRequired && (
          <div className="rounded-2xl bg-[#E8F5E9] border border-[#2E7D32]/30 p-4 text-sm text-gray-800 leading-relaxed space-y-2.5">
            <p className="font-black text-[#1B5E20]">
              내 컴퓨터 체험 모드 — 비밀번호 없이 바로 열기
            </p>
            <div className="flex flex-wrap gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => void submitLogin("admin", "")}
                className="px-4 py-2 rounded-full bg-[#1a2744] text-white font-bold hover:bg-black transition-colors"
              >
                사이트 관리자로 열기 →
              </button>
              <button
                type="button"
                onClick={() => void submitLogin("photo", "")}
                className="px-4 py-2 rounded-full bg-[#2E7D32] text-white font-bold hover:bg-[#1B5E20] transition-colors"
              >
                사진 전용 계정으로 열기 →
              </button>
            </div>
          </div>
        )}

        {authRequired && !activePasswordConfigured && (
          <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-sm text-amber-950 leading-relaxed">
            선택하신 계정의 비밀번호가 아직 설정되지 않았습니다. 교회 홈페이지 담당자에게 문의해 주세요.
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-2xl bg-red-50 border-2 border-red-300 px-4 py-3.5 text-sm font-bold text-red-800 leading-relaxed"
          >
            ⚠ {errorMsg} 아래 [글자 보기] 버튼을 눌러 영문과 숫자가 맞게 입력되었는지 확인해 보세요.
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
                2단계:{" "}
                {accountType === "photo"
                  ? "사진 업로드 전용 비밀번호"
                  : "사이트 관리자 비밀번호"}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm font-bold text-[#1a2744] transition-colors"
              >
                {showPassword ? "🙈 글자 가리기" : "👁 입력한 글자 보기"}
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
              placeholder="영문 소문자와 숫자로 입력해 주세요"
              className="w-full rounded-xl border-2 border-gray-300 px-4 py-3.5 text-base font-bold focus:border-[#2E7D32] focus:outline-none"
            />

            {hasHangulInPassword && (
              <p
                role="status"
                className="rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-amber-950"
              >
                ⚠ 지금 키보드가 [한글]로 되어 있습니다. 키보드 오른쪽 아래 [한영 전환] 키를 한 번 눌러 영문으로 바꾼 뒤 다시 입력해 주세요.
              </p>
            )}
            {capsLockOn && !hasHangulInPassword && (
              <p
                role="status"
                className="rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-amber-950"
              >
                ⚠ 대문자 잠금 (Caps Lock) 키가 켜져 있습니다. 비밀번호는 영문 소문자인지 확인해 주세요.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`block w-full text-center py-4 rounded-[28px] text-white text-base sm:text-lg font-black shadow-md transition-colors disabled:opacity-60 ${
              accountType === "photo"
                ? "bg-[#2E7D32] hover:bg-[#1B5E20]"
                : "bg-[#1a2744] hover:bg-[#2E7D32]"
            }`}
          >
            {submitting
              ? "비밀번호 확인 중..."
              : accountType === "photo"
                ? "사진 업로드 화면 열기 →"
                : "관리자 화면 열기 →"}
          </button>
        </form>

        <div className="rounded-2xl bg-[#E8F5E9]/70 border border-[#2E7D32]/25 px-4 py-3 flex items-center justify-between gap-2">
          <span className="text-xs sm:text-sm font-bold text-[#1B5E20]">
            처음 사용하시나요? 큰글씨 그림 설명서를 보실 수 있습니다.
          </span>
          <a
            href="/church-admin-easy-manual.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black whitespace-nowrap shrink-0 transition-colors"
          >
            📖 설명서 보기
          </a>
        </div>

        <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 pt-2 border-t border-gray-100 font-semibold">
          <Link href="/" className="hover:text-[#2E7D32]">
            ← 홈페이지 첫 화면으로 돌아가기
          </Link>
          <Link href="/news/gallery" className="hover:text-[#2E7D32]">
            교회 앨범 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
