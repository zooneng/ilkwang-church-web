"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminEditLink } from "@/components/AdminEditLink";
import { CopyAccountButton } from "@/components/CopyAccountButton";
import { SubpageHero } from "@/components/SubpageHero";
import { readJsonResponseSafe } from "@/lib/media-utils";
import type { ChurchInfo, InquiryCategory } from "@/types/site-content";

const INQUIRY_CATEGORIES: readonly InquiryCategory[] = [
  "새가족 등록",
  "예배·교회 문의",
  "심방·기도 요청",
  "시설·행정 문의",
];

interface ContactPageClientProps {
  readonly churchInfo: ChurchInfo;
}

export function ContactPageClient({ churchInfo }: ContactPageClientProps) {
  const [category, setCategory] = useState<InquiryCategory>("새가족 등록");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [websiteHoneypot, setWebsiteHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          name,
          contact,
          title,
          message,
          website: websiteHoneypot,
        }),
      });
      const data = await readJsonResponseSafe<{
        readonly inquiry?: { readonly id: string };
        readonly error?: string;
      }>(response);
      if (!response.ok || !data.inquiry) {
        throw new Error(data.error ?? "접수에 실패했습니다.");
      }
      setSubmittedId(data.inquiry.id);
      setName("");
      setContact("");
      setTitle("");
      setMessage("");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <SubpageHero
        englishLabel="Contact & Newcomers"
        title="새가족 등록 · 문의하기"
        subtitle="새가족 등록 신청, 심방·기도 요청, 예배 안내 문의를 온라인으로 접수합니다"
        bannerImageUrl="https://images.unsplash.com/photo-1542396601-dca920ea2807?w=1800&auto=format&fit=crop&q=80"
      />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-6 py-12 sm:py-16 grid lg:grid-cols-[0.88fr_1.12fr] gap-10">
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-[#1a2744] mb-4">교회 안내 및 연락처</h2>
          <div className="bg-[#E8F5E9] rounded-2xl p-6">
            <p className="text-xs font-bold text-[#2E7D32] mb-1">📞 대표 전화</p>
            <a
              href={`tel:${churchInfo.phone}`}
              className="text-xl font-black text-[#1a2744] hover:underline"
            >
              {churchInfo.phone}
            </a>
            <p className="text-xs text-gray-600 mt-1">
              평일 및 주일 교회 사무실로 연결됩니다.
            </p>
          </div>
          <div className="bg-[#F8FAF8] rounded-2xl p-6 border border-gray-100">
            <p className="text-xs font-bold text-[#2E7D32] mb-1">✉ 이메일</p>
            <a
              href={`mailto:${churchInfo.email}`}
              className="text-base font-bold text-[#1a2744] hover:underline break-all"
            >
              {churchInfo.email}
            </a>
          </div>
          <div className="bg-[#F8FAF8] rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs font-bold text-[#2E7D32]">📍 주소</p>
              <CopyAccountButton
                textToCopy={churchInfo.address}
                label="주소 복사"
              />
            </div>
            <p className="text-base font-bold text-[#1a2744]">
              {churchInfo.address}
            </p>
            <p className="text-xs text-gray-500 mt-1">{churchInfo.subwayGuide}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
          <h2 className="text-xl font-black text-[#1a2744] mb-2">
            온라인 신청 및 문의 접수
          </h2>
          <p className="text-xs text-gray-500 mb-6">
            남겨주신 내용은 담당 교역자에게 전달되어 확인 후 정성껏 안내해 드립니다.
          </p>

          {errorMsg && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-bold text-red-700">
              {errorMsg}
            </div>
          )}

          {submittedId ? (
            <div className="rounded-xl bg-[#E8F5E9] p-6 text-center space-y-3 border border-[#2E7D32]/30">
              <p className="text-lg font-black text-[#2E7D32]">
                ✓ 문의 및 신청이 정상 접수되었습니다!
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                온라인 문의가 정상 접수되었습니다. 담당 교역자가 확인 후 연락드리겠습니다.
              </p>
              <div className="flex flex-wrap justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmittedId(null)}
                  className="px-5 py-2 rounded-full bg-white border border-gray-300 text-[#1a2744] text-xs font-bold"
                >
                  추가 문의 작성
                </button>
                <AdminEditLink
                  href="/admin?tab=inquiries"
                  className="px-5 py-2 rounded-full bg-[#2E7D32] text-white text-xs font-bold hover:bg-[#1B5E20]"
                >
                  관리자 문의함에서 방금 접수된 글 확인하기 →
                </AdminEditLink>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={websiteHoneypot}
                onChange={(e) => setWebsiteHoneypot(e.target.value)}
                className="sr-only"
              />
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  신청 구분 *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {INQUIRY_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                        category === cat
                          ? "bg-[#2E7D32] text-white border-[#2E7D32]"
                          : "bg-[#F8FAF8] text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    성함 *
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="성함을 입력해 주세요"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#2E7D32] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    연락처 (휴대전화 또는 이메일) *
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={100}
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#2E7D32] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  제목 *
                </label>
                <input
                  required
                  type="text"
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="문의 또는 신청 제목을 입력해 주세요"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#2E7D32] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  상세 내용 *
                </label>
                <textarea
                  required
                  rows={4}
                  maxLength={3000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="참석 희망 예배 시간, 자녀 부서 안내, 심방 및 기도 제목 등을 편하게 적어 주세요"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#2E7D32] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-[26px] bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-60 text-white font-bold text-sm transition-colors"
              >
                {submitting ? "접수 중..." : "문의 · 신청 접수하기"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
