import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-[70vh] bg-[#F8FAF8] flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-6 text-center">
        <img
          src="/gapck-logo.svg"
          alt="일광교회"
          className="w-10 h-14 object-contain mx-auto"
        />
        <h1 className="text-2xl font-black text-[#1a2744]">비밀번호 안내</h1>
        <p className="text-sm text-gray-600 leading-relaxed break-keep">
          담당자 로그인 비밀번호 확인이나 변경은 교회 홈페이지 관리자에게 문의해 주세요.
        </p>
        <Link
          href="/login"
          className="inline-block px-6 py-2.5 rounded-full bg-[#2E7D32] text-white text-sm font-bold hover:bg-[#1B5E20] transition-colors"
        >
          ← 로그인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
