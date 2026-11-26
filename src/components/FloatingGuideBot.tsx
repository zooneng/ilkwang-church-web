"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ChurchInfo } from "@/types/site-content";

interface FloatingGuideBotProps {
  readonly churchInfo: ChurchInfo;
}

export function FloatingGuideBot({ churchInfo }: FloatingGuideBotProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const answers: Record<string, { readonly title: string; readonly body: string; readonly link: string; readonly linkLabel: string }> = {
    worship: {
      title: "주일 및 주중 예배 시간",
      body: "주일 1부(오전 9:30), 2부(오전 11:00), 오후예배(오후 1:30)로 모이며, 새벽기도회(월~금 오전 5:00), 수요기도회(수요일 오전 10:30), 금요기도회(매월 첫째 주 금요일 오후 8:00)를 본당에서 드립니다.",
      link: "/worship",
      linkLabel: "예배 안내 자세히 보기",
    },
    location: {
      title: "오시는 길 및 대중교통",
      body: `${churchInfo.address} (${churchInfo.subwayGuide}, 대표전화 ${churchInfo.phone})`,
      link: "/about/location",
      linkLabel: "지도 및 교통편 보기",
    },
    contact: {
      title: "새가족 등록 및 온라인 문의",
      body: "처음 방문하시는 분들의 등록 안내나 심방 요청, 교회 행정 문의를 온라인으로 남기시면 담당 교역자가 연락드립니다.",
      link: "/contact",
      linkLabel: "온라인 문의하기",
    },
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-2.5">
      {open && (
        <div className="w-[calc(100vw-2rem)] max-w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-[#1a2744] text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/gapck-logo.svg"
                alt={churchInfo.name}
                className="w-5 h-7 object-contain"
              />
              <div>
                <p className="text-sm font-bold">{churchInfo.name} 온라인 안내</p>
                <p className="text-[11px] text-[#a3c9a8]">무엇을 도와드릴까요?</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="안내창 닫기"
              className="p-2 -mr-2 rounded-lg text-white/75 hover:text-white hover:bg-white/10 text-lg leading-none transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-3 bg-[#F8FAF8]">
            <div className="bg-white rounded-xl p-3.5 text-xs text-gray-700 leading-relaxed shadow-xs">
              반갑습니다! 행복과 영원으로 초대하는 <strong>{churchInfo.name}</strong>입니다. 궁금하신 항목을 선택해 주세요.
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedTopic("worship")}
                className="px-3 py-1.5 rounded-full bg-white border border-[#2E7D32]/30 text-xs font-semibold text-[#1a2744] hover:bg-[#E8F5E9] transition-colors"
              >
                예배 시간 안내
              </button>
              <button
                type="button"
                onClick={() => setSelectedTopic("location")}
                className="px-3 py-1.5 rounded-full bg-white border border-[#2E7D32]/30 text-xs font-semibold text-[#1a2744] hover:bg-[#E8F5E9] transition-colors"
              >
                오시는 길
              </button>
              <button
                type="button"
                onClick={() => setSelectedTopic("contact")}
                className="px-3 py-1.5 rounded-full bg-[#2E7D32] text-xs font-semibold text-white hover:bg-[#1B5E20] transition-colors"
              >
                새가족 및 문의
              </button>
            </div>

            {selectedTopic && answers[selectedTopic] && (
              <div className="bg-white rounded-xl p-3.5 border border-[#2E7D32]/25 space-y-2">
                <p className="text-xs font-bold text-[#2E7D32]">
                  {answers[selectedTopic].title}
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {answers[selectedTopic].body}
                </p>
                <Link
                  href={answers[selectedTopic].link}
                  onClick={() => setOpen(false)}
                  className="inline-block text-xs font-bold text-[#1a2744] underline underline-offset-4 hover:text-[#2E7D32]"
                >
                  {answers[selectedTopic].linkLabel} →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? "교회 안내 도우미 닫기" : "교회 안내 도우미 열기"}
        title={`${churchInfo.name} 온라인 안내 도우미`}
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#5c6ac4] hover:bg-[#4c59b0] text-white shadow-xl flex items-center justify-center relative transition-transform hover:scale-105"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
        <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#4caf50] border-2 border-white" />
      </button>
    </div>
  );
}
