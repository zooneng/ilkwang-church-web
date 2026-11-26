"use client";

import { useMemo, useState } from "react";
import { AdminEditLink } from "@/components/AdminEditLink";
import { resolveEventIsoDate } from "@/lib/format-utils";
import type { EventItem } from "@/types/site-content";

type EventPeriodMode = "quarter" | "half" | "annual";

interface NormalizedEventItem extends EventItem {
  readonly isoDate: string;
  readonly yearNum: number;
  readonly monthNum: number;
  readonly dayNum: number;
}

interface ChurchEventsBrowserProps {
  readonly events: readonly EventItem[];
  readonly referenceIsoDate: string;
}

const QUARTER_DEFS = [
  { quarter: 1, label: "1분기", monthsLabel: "1월 ~ 3월", startMonth: 1, endMonth: 3 },
  { quarter: 2, label: "2분기", monthsLabel: "4월 ~ 6월", startMonth: 4, endMonth: 6 },
  { quarter: 3, label: "3분기", monthsLabel: "7월 ~ 9월", startMonth: 7, endMonth: 9 },
  { quarter: 4, label: "4분기", monthsLabel: "10월 ~ 12월", startMonth: 10, endMonth: 12 },
] as const;

const HALF_DEFS = [
  { half: 1, label: "상반기", monthsLabel: "1월 ~ 6월", startMonth: 1, endMonth: 6 },
  { half: 2, label: "하반기", monthsLabel: "7월 ~ 12월", startMonth: 7, endMonth: 12 },
] as const;

export function ChurchEventsBrowser({
  events,
  referenceIsoDate,
}: ChurchEventsBrowserProps) {
  const normalizedEvents = useMemo<readonly NormalizedEventItem[]>(() => {
    return events
      .map((evt) => {
        const isoDate = resolveEventIsoDate(evt);
        const [yStr, mStr, dStr] = isoDate.split("-");
        const yearNum = Number(yStr) || 2026;
        const monthNum = Math.min(12, Math.max(1, Number(mStr) || 1));
        const dayNum = Math.min(31, Math.max(1, Number(dStr) || 1));
        return {
          ...evt,
          isoDate,
          yearNum,
          monthNum,
          dayNum,
        };
      })
      .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  }, [events]);

  const refYear = Number(referenceIsoDate.slice(0, 4)) || 2026;
  const refMonth = Math.min(
    12,
    Math.max(1, Number(referenceIsoDate.slice(5, 7)) || 1)
  );
  const defaultQuarter = Math.ceil(refMonth / 3) as 1 | 2 | 3 | 4;
  const defaultHalf = (refMonth <= 6 ? 1 : 2) as 1 | 2;

  // Default mode requested by user: "quarter" (3 months shown together at once)
  const [periodMode, setPeriodMode] = useState<EventPeriodMode>("quarter");
  const [selectedYear, setSelectedYear] = useState<number>(refYear);
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(
    defaultQuarter
  );
  const [selectedHalf, setSelectedHalf] = useState<1 | 2>(defaultHalf);

  const activeRange = useMemo(() => {
    if (periodMode === "quarter") {
      const qDef = QUARTER_DEFS[selectedQuarter - 1];
      return {
        startMonth: qDef.startMonth,
        endMonth: qDef.endMonth,
        title: `${selectedYear}년 ${qDef.label} (${qDef.monthsLabel})`,
        badge: "3개월 한눈에 보기",
      };
    }
    if (periodMode === "half") {
      const hDef = HALF_DEFS[selectedHalf - 1];
      return {
        startMonth: hDef.startMonth,
        endMonth: hDef.endMonth,
        title: `${selectedYear}년 ${hDef.label} (${hDef.monthsLabel})`,
        badge: "6개월 일정 보기",
      };
    }
    return {
      startMonth: 1,
      endMonth: 12,
      title: `${selectedYear}년 연간 전체 (1월 ~ 12월)`,
      badge: "12개월 연간 보기",
    };
  }, [periodMode, selectedHalf, selectedQuarter, selectedYear]);

  const monthsInWindow = useMemo(() => {
    const list: number[] = [];
    for (let m = activeRange.startMonth; m <= activeRange.endMonth; m += 1) {
      list.push(m);
    }
    return list;
  }, [activeRange.endMonth, activeRange.startMonth]);

  const yearEvents = useMemo(
    () => normalizedEvents.filter((evt) => evt.yearNum === selectedYear),
    [normalizedEvents, selectedYear]
  );

  const visibleEvents = useMemo(
    () =>
      yearEvents.filter(
        (evt) =>
          evt.monthNum >= activeRange.startMonth &&
          evt.monthNum <= activeRange.endMonth
      ),
    [activeRange.endMonth, activeRange.startMonth, yearEvents]
  );

  function stepPeriod(delta: -1 | 1) {
    if (periodMode === "quarter") {
      const nextIndex = selectedQuarter + delta;
      if (nextIndex < 1) {
        setSelectedYear((y) => y - 1);
        setSelectedQuarter(4);
      } else if (nextIndex > 4) {
        setSelectedYear((y) => y + 1);
        setSelectedQuarter(1);
      } else {
        setSelectedQuarter(nextIndex as 1 | 2 | 3 | 4);
      }
      return;
    }
    if (periodMode === "half") {
      const nextHalf = selectedHalf + delta;
      if (nextHalf < 1) {
        setSelectedYear((y) => y - 1);
        setSelectedHalf(2);
      } else if (nextHalf > 2) {
        setSelectedYear((y) => y + 1);
        setSelectedHalf(1);
      } else {
        setSelectedHalf(nextHalf as 1 | 2);
      }
      return;
    }
    setSelectedYear((y) => y + delta);
  }

  const isAtCurrentDefault =
    selectedYear === refYear &&
    ((periodMode === "quarter" && selectedQuarter === defaultQuarter) ||
      (periodMode === "half" && selectedHalf === defaultHalf) ||
      periodMode === "annual");

  return (
    <div className="space-y-7">
      {/* Top Heading + Primary Period Mode Buttons (Quarter 3M Default / Half 6M / Annual 12M) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#1a2744]">주요 예배 및 행사</h2>
          <p className="text-sm text-gray-500 mt-1">
            기본 화면에서 현재 분기 3개월 일정을 한눈에 확인하며 반기별, 연간 전체 일정으로 자유롭게 전환할 수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="tablist"
            aria-label="행사 기간 단위 선택"
            className="inline-flex rounded-full bg-[#F4F7F5] p-1 border border-gray-200"
          >
            {(
              [
                { key: "quarter", label: "분기별 (3개월)" },
                { key: "half", label: "반기별 (6개월)" },
                { key: "annual", label: "연간 (12개월)" },
              ] as const
            ).map((btn) => {
              const isActive = periodMode === btn.key;
              return (
                <button
                  key={btn.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setPeriodMode(btn.key)}
                  className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-[#2E7D32] text-white shadow-xs"
                      : "text-gray-600 hover:text-[#1a2744]"
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          <AdminEditLink
            href="/admin?tab=events"
            className="px-4 py-2 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap"
          >
            ✎ 행사 일정 편집
          </AdminEditLink>
        </div>
      </div>

      {/* Period Navigation & Sub-Period Quick Selector Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => stepPeriod(-1)}
              aria-label="이전 기간"
              className="w-8 h-8 rounded-full border border-gray-200 bg-[#F8FAF8] hover:bg-gray-100 text-[#1a2744] text-xs font-black flex items-center justify-center shrink-0"
            >
              ◀
            </button>
            <span className="text-sm sm:text-lg font-black text-[#1a2744]">
              {activeRange.title}
            </span>
            <button
              type="button"
              onClick={() => stepPeriod(1)}
              aria-label="다음 기간"
              className="w-8 h-8 rounded-full border border-gray-200 bg-[#F8FAF8] hover:bg-gray-100 text-[#1a2744] text-xs font-black flex items-center justify-center shrink-0"
            >
              ▶
            </button>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold whitespace-nowrap">
            {activeRange.badge}
          </span>

          {!isAtCurrentDefault && (
            <button
              type="button"
              onClick={() => {
                setSelectedYear(refYear);
                setSelectedQuarter(defaultQuarter);
                setSelectedHalf(defaultHalf);
              }}
              className="px-3 py-1 rounded-full border border-gray-300 text-xs font-bold text-gray-600 hover:text-[#1a2744] hover:bg-gray-50 whitespace-nowrap"
            >
              현재 기간으로
            </button>
          )}
        </div>

        {/* Sub-selector buttons for Quarters or Half-years */}
        {periodMode === "quarter" && (
          <div className="flex flex-wrap items-center gap-1.5">
            {QUARTER_DEFS.map((q) => {
              const isSelected = selectedQuarter === q.quarter;
              return (
                <button
                  key={q.quarter}
                  type="button"
                  onClick={() => setSelectedQuarter(q.quarter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    isSelected
                      ? "bg-[#1a2744] text-white"
                      : "bg-[#F8FAF8] text-gray-600 border border-gray-200 hover:border-[#2E7D32]"
                  }`}
                >
                  {q.label} ({q.startMonth}~{q.endMonth}월)
                </button>
              );
            })}
          </div>
        )}

        {periodMode === "half" && (
          <div className="flex flex-wrap items-center gap-1.5">
            {HALF_DEFS.map((h) => {
              const isSelected = selectedHalf === h.half;
              return (
                <button
                  key={h.half}
                  type="button"
                  onClick={() => setSelectedHalf(h.half)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    isSelected
                      ? "bg-[#1a2744] text-white"
                      : "bg-[#F8FAF8] text-gray-600 border border-gray-200 hover:border-[#2E7D32]"
                  }`}
                >
                  {h.label} ({h.startMonth}~{h.endMonth}월)
                </button>
              );
            })}
          </div>
        )}

        {periodMode === "annual" && (
          <div className="flex items-center gap-1.5">
            {[refYear - 1, refYear, refYear + 1].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  selectedYear === yr
                    ? "bg-[#1a2744] text-white"
                    : "bg-[#F8FAF8] text-gray-600 border border-gray-200 hover:border-[#2E7D32]"
                }`}
              >
                {yr}년
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Multi-Month Grouped Schedule View (Shows all 3 months together in Quarter mode) */}
      {visibleEvents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center space-y-2">
          <p className="text-base font-bold text-[#1a2744]">
            {activeRange.title} 기간에 등록된 주요 행사가 없습니다.
          </p>
          <p className="text-xs text-gray-500">
            상단에서 다른 분기, 반기, 연간 보기를 선택하거나 관리자 모드에서 새 일정을 등록할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {monthsInWindow.map((month) => {
            const monthEvents = visibleEvents.filter(
              (evt) => evt.monthNum === month
            );
            if (monthEvents.length === 0 && periodMode === "annual") {
              return null;
            }

            return (
              <section key={month} className="space-y-3.5">
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-1 rounded-full bg-[#1a2744] text-white text-xs sm:text-sm font-black">
                    {selectedYear}년 {String(month).padStart(2, "0")}월
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                  {monthEvents.length === 0 && (
                    <span className="text-xs font-semibold text-gray-400">
                      등록 일정 없음
                    </span>
                  )}
                </div>

                {monthEvents.length === 0 ? (
                  <div className="bg-[#F8FAF8] rounded-xl border border-gray-100 px-5 py-3.5 text-xs text-gray-400">
                    {selectedYear}년 {month}월에는 별도 절기 및 특별 행사가 등록되어 있지 않으며 주일 예배와 주중 정기 기도회는 정상 진행합니다.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-5">
                    {monthEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className={`bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow p-4 sm:p-6 flex gap-3.5 sm:gap-5 ${
                          evt.description.trim() ? "items-start" : "items-center"
                        }`}
                      >
                        <div className="shrink-0 w-16 h-16 rounded-xl bg-[#1a2744] text-white flex flex-col items-center justify-center">
                          <span className="text-2xl font-black leading-none">
                            {String(evt.dayNum).padStart(2, "0")}
                          </span>
                          <span className="text-[10px] opacity-80 mt-1 font-semibold">
                            {selectedYear}. {String(evt.monthNum).padStart(2, "0")}
                          </span>
                        </div>
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <h3 className="text-lg font-black text-[#1a2744] break-keep">
                            {evt.title}
                          </h3>
                          <p className="text-xs font-semibold text-[#2E7D32]">
                            {[
                              evt.timeText ? `🕒 ${evt.timeText}` : "",
                              evt.location ? `📍 ${evt.location}` : "",
                            ]
                              .filter(Boolean)
                              .join("   ")}
                          </p>
                          {evt.description.trim() && (
                            <p className="text-sm text-gray-600 leading-relaxed break-keep">
                              {evt.description}
                            </p>
                          )}
                          {evt.attachmentUrl && (
                            <div className="pt-1">
                              <a
                                href={evt.attachmentUrl}
                                download={evt.attachmentName ?? true}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors"
                              >
                                {evt.attachmentName || "행사 안내문 내려받기"} ↓
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
