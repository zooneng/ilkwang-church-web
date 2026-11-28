import Link from "next/link";
import { AdminEditLink } from "@/components/AdminEditLink";
import { HeroPhotoCube } from "@/components/HeroPhotoCube";
import { HomePopupModal } from "@/components/HomePopupModal";
import { getSiteContent } from "@/lib/content-store";
import { getKstDateString, resolveEventIsoDate } from "@/lib/format-utils";
import { isPopupCurrentlyLive } from "@/lib/popup-utils";
import {
  normalizeScriptureText,
  normalizeSermonServiceType,
} from "@/lib/sermon-utils";

export const dynamic = "force-dynamic";

const MINISTRY_CARDS = [
  {
    title: "주일 예배",
    description: "말씀 중심의 주일 예배로 하나님께 나아갑니다.",
    href: "/worship",
    icon: "📖",
  },
  {
    title: "청년부",
    description: "청년들이 함께 성장하고 교제하는 공동체입니다.",
    href: "/youth/young-adults",
    icon: "👥",
  },
  {
    title: "주일학교",
    description: "다음 세대를 믿음 안에서 양육하는 교육부입니다.",
    href: "/youth/sunday",
    icon: "🌱",
  },
  {
    title: "특별 행사",
    description: "부흥성회, 수련회 등 특별한 신앙 행사를 진행합니다.",
    href: "/news/events",
    icon: "📅",
  },
  {
    title: "새가족 · 상담",
    description: "새가족 등록과 심방·기도 요청을 온라인으로 접수합니다.",
    href: "/contact",
    icon: "💚",
  },
  {
    title: "선교 사역",
    description: "국내외 선교를 통해 복음을 전하는 교회입니다.",
    href: "/about/vision",
    icon: "🌏",
  },
] as const;

const FAITH_CONFESSIONS = [
  {
    tag: "SALVATION",
    title: "예수 그리스도가 주님",
    description: "우리는 예수 그리스도를 유일한 구원자요 주님으로 믿습니다.",
    imageUrl:
      "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=800&auto=format&fit=crop&q=80",
  },
  {
    tag: "LOVE",
    title: "하나님은 사랑이시다",
    description: "성경은 하나님이 세상을 사랑하사 독생자를 주셨다고 말씀합니다.",
    imageUrl:
      "https://images.unsplash.com/photo-1536126750180-3c7d59643f99?w=800&auto=format&fit=crop&q=80",
  },
  {
    tag: "HOLY SPIRIT",
    title: "성령의 능력으로",
    description: "성령 하나님이 신자 안에 내주하시며 삶을 변화시키십니다.",
    imageUrl:
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&auto=format&fit=crop&q=80",
  },
  {
    tag: "BIBLE",
    title: "성경은 하나님의 말씀",
    description: "성경 66권은 하나님의 영감으로 기록된 무오한 말씀입니다.",
    imageUrl:
      "https://images.unsplash.com/photo-1507692049790-de58290a4334?w=800&auto=format&fit=crop&q=80",
  },
] as const;

export default async function HomePage() {
  const content = await getSiteContent();
  const featuredSermon = content.sermons[0];
  const recentSermons = content.sermons.slice(0, 4);
  const cubePhotos = content.gallery.filter((photo) => photo.showInHeroCube);

  const todayIso = getKstDateString();
  const currentYear = Number(todayIso.slice(0, 4)) || 2026;
  const currentMonth = Number(todayIso.slice(5, 7)) || 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  const qStartMonth = (currentQuarter - 1) * 3 + 1;
  const qEndMonth = currentQuarter * 3;

  const sortedEvents = [...content.events]
    .map((evt) => ({ evt, isoDate: resolveEventIsoDate(evt) }))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

  const quarterEvents = sortedEvents.filter(({ isoDate }) => {
    const yr = Number(isoDate.slice(0, 4));
    const mo = Number(isoDate.slice(5, 7));
    return yr === currentYear && mo >= qStartMonth && mo <= qEndMonth;
  });

  const featuredEvents = (
    quarterEvents.length > 0 ? quarterEvents : sortedEvents.slice(0, 4)
  ).slice(0, 4);
  const livePopups = content.popups.filter((item) =>
    isPopupCurrentlyLive(item, todayIso)
  );

  return (
    <div>
      {livePopups.length > 0 && (
        <HomePopupModal popups={livePopups} todayIso={todayIso} />
      )}

      {/* 1. Main Hero with Preserved Sanctuary Photo & Dynamic 3D Rotating Church Cube */}
      <section className="relative min-h-[560px] sm:min-h-[700px] lg:min-h-[800px] flex items-center justify-center overflow-hidden">
        <img
          src={content.churchInfo.heroBackgroundUrl?.trim() || "/c01/Hero001.png"}
          alt={`${content.churchInfo.name} 본당 예배`}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#1a2744]/85" />
        <div className="absolute top-28 right-5 z-30 flex flex-wrap items-center gap-2">
          <AdminEditLink
            href="/admin?tab=popups"
            className="px-4 py-2 rounded-full bg-white/95 text-[#1a2744] hover:bg-[#2E7D32] hover:text-white text-xs sm:text-sm font-black shadow-lg transition-colors"
          >
            팝업 관리
          </AdminEditLink>
          <AdminEditLink
            href="/admin?tab=hero-cube"
            className="px-4 py-2 rounded-full bg-white/95 text-[#1a2744] hover:bg-[#2E7D32] hover:text-white text-xs sm:text-sm font-black shadow-lg transition-colors"
          >
            배경 및 대표 사진 변경
          </AdminEditLink>
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-6 pt-20 pb-28 sm:pt-24 sm:pb-32 lg:py-16 w-full flex flex-col lg:flex-row items-center justify-center lg:gap-12 min-h-[560px] sm:min-h-[700px] lg:min-h-[800px]">
          <div className="max-w-2xl w-full text-center lg:text-left lg:pl-[50px]">
            <p className="text-[#a3c9a8] text-base sm:text-lg lg:text-[22px] font-bold mb-2">
              {content.churchInfo.slogan}
            </p>
            <h1 className="text-[28px] sm:text-[36px] lg:text-[42px] font-black text-white leading-[1.15] mb-3 sm:mb-4 break-keep">
              {content.churchInfo.name}에
              <br className="hidden sm:inline" /> 오신 것을 환영합니다
            </h1>
            <p className="text-gray-300 text-sm sm:text-base lg:text-[20px] leading-relaxed mb-6 sm:mb-8 max-w-xl mx-auto lg:mx-0 break-keep">
              우리의 목표는 지역 사회에서 소외된
              <br className="hidden sm:inline" /> 이웃들에게 복음의 빛을 전하고, 모든 사람이
              <br className="hidden sm:inline" /> 하나님의 사랑 안에서 새로운 삶을
              <br className="hidden sm:inline" /> 시작하도록 돕는 것입니다.
            </p>

            <div className="relative -top-[10px]">
              <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-5 justify-center lg:justify-start">
                <Link
                  href="/about"
                  className="inline-flex items-center justify-center px-6 py-[10px] bg-[#2E7D32] text-white font-bold text-base rounded-[26px] hover:bg-[#1B5E20] transition-colors tracking-wide"
                >
                  교회 소개 보기
                </Link>
                <Link
                  href="/worship/sermons"
                  className="inline-flex items-center justify-center px-6 py-[10px] border-2 border-white text-white font-bold text-base rounded-[26px] hover:bg-white hover:text-[#1a2744] transition-colors tracking-wide"
                >
                  설교 영상 보기
                </Link>
              </div>

              <div className="flex flex-col items-start gap-y-[0.45rem] w-fit mx-auto lg:mx-0 lg:flex-row lg:flex-wrap lg:gap-x-8 lg:gap-y-[1.35rem] lg:w-auto">
                <div className="flex items-center gap-3 text-gray-300 text-sm sm:text-base">
                  <span className="w-5 h-5 rounded-full bg-[#2E7D32]/30 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-[#6dbf73]" />
                  </span>
                  <span>{content.churchInfo.sundaySummary}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300 text-sm sm:text-base">
                  <span className="w-5 h-5 rounded-full bg-[#2E7D32]/30 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-[#6dbf73]" />
                  </span>
                  <span>{content.churchInfo.shortAddress}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex shrink-0 w-[480px] items-center justify-center">
            <HeroPhotoCube photos={cubePhotos} />
          </div>
        </div>
      </section>

      {/* Featured Latest Sermon Split Card */}
      {featuredSermon && (
        <section className="relative z-20 -mt-12 sm:-mt-16 pb-6 px-5 sm:px-6">
          <div className="max-w-[1280px] mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="aspect-video bg-[#0b1320]">
              <iframe
                src={`https://www.youtube.com/embed/${featuredSermon.youtubeId}`}
                title={featuredSermon.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <div className="p-6 sm:p-9 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold">
                  {normalizeSermonServiceType(featuredSermon.serviceType)}
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  {featuredSermon.date}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#1a2744] mb-2.5 break-keep">
                &ldquo;{featuredSermon.title}&rdquo;
              </h2>
              {(normalizeScriptureText(featuredSermon.scripture) ||
                featuredSermon.preacher.trim()) && (
                <p className="text-sm font-bold text-[#2E7D32] mb-6">
                  {[
                    normalizeScriptureText(featuredSermon.scripture),
                    featuredSermon.preacher.trim(),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/worship/sermons?v=${featuredSermon.youtubeId}`}
                  className="px-5 py-2.5 bg-[#2E7D32] text-white text-sm font-bold rounded-[26px] hover:bg-[#1B5E20] transition-colors"
                >
                  설교 영상 더보기
                </Link>
                <Link
                  href="/news/bulletin"
                  className="px-5 py-2.5 border border-gray-300 text-[#1a2744] text-sm font-bold rounded-[26px] hover:bg-gray-50 transition-colors"
                >
                  이번 주 주보 보기
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. OUR MINISTRY */}
      <section className="py-14 sm:py-20 lg:py-24 bg-[#F8FAF8]">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-6">
          <div className="grid lg:grid-cols-2 xl:grid-cols-[420px_1fr] gap-8 sm:gap-10 xl:gap-24 items-start">
            <div className="xl:sticky xl:top-28 text-center lg:text-left flex flex-col items-center lg:items-start">
              <p className="text-[#2E7D32] text-xs font-bold uppercase tracking-[0.2em] mb-3">
                OUR MINISTRY
              </p>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#1a2744] leading-tight mb-4 sm:mb-6 break-keep">
                지역 사회와 함께
                <br />
                성장하는 교회
              </h2>
              <p className="text-gray-500 text-sm sm:text-base leading-relaxed mb-6 sm:mb-8 max-w-md break-keep">
                일광교회는 예배와 교육, 교제와 봉사를 통해 성도들이 하나님의
                사람으로 세워지도록 돕고 있습니다. 다양한 부서와 사역을 통해
                모든 세대가 함께합니다.
              </p>
              <Link
                href="/worship"
                className="inline-block px-7 py-3.5 bg-[#2E7D32] text-white font-bold rounded-[26px] hover:bg-[#1B5E20] transition-colors tracking-wide"
              >
                예배 안내 보기
              </Link>
            </div>

            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 xl:gap-8">
              {MINISTRY_CARDS.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="flex flex-col gap-3 bg-white rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all items-center text-center sm:items-start sm:text-left group border border-gray-100"
                >
                  <div className="w-12 h-12 rounded-xl border-2 border-[#1a2744]/10 bg-[#F8FAF8] flex items-center justify-center text-xl group-hover:bg-[#E8F5E9] transition-colors">
                    {card.icon}
                  </div>
                  <h3 className="text-base font-bold text-[#1a2744] group-hover:text-[#2E7D32] transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 leading-relaxed break-keep">
                    {card.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. RECENT SERMONS */}
      <section className="py-14 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-[#2E7D32] text-xs font-bold uppercase tracking-[0.2em] mb-3">
              RECENT SERMONS
            </p>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#1a2744] mb-4">
              최근 설교 말씀
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              일광교회 강단에서 선포되는 최신 설교 말씀을 만나보세요.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentSermons.map((sermon) => {
              const metaLine = [
                normalizeScriptureText(sermon.scripture),
                sermon.preacher.trim(),
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <Link
                  key={sermon.id}
                  href={`/worship/sermons?v=${sermon.youtubeId}`}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all overflow-hidden group flex flex-col"
                >
                  <div className="relative aspect-video bg-[#1a2744] overflow-hidden">
                    <img
                      src={`https://i.ytimg.com/vi/${sermon.youtubeId}/hqdefault.jpg`}
                      alt={sermon.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                      <span className="w-12 h-12 rounded-full bg-[#2E7D32]/90 text-white flex items-center justify-center text-base shadow-lg">
                        ▶
                      </span>
                    </div>
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#1a2744]/85 text-white text-[11px] font-semibold">
                      {normalizeSermonServiceType(sermon.serviceType)}
                    </span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-xs text-gray-400 mb-1.5">{sermon.date}</p>
                    <h3 className="font-bold text-[#1a2744] text-base mb-1.5 group-hover:text-[#2E7D32] transition-colors line-clamp-2 break-keep">
                      {sermon.title}
                    </h3>
                    {metaLine && (
                      <p className="text-xs text-[#2E7D32] font-semibold mt-auto">
                        {metaLine}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/worship/sermons"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#2E7D32] text-white font-bold rounded-[26px] hover:bg-[#1B5E20] transition-colors tracking-wide"
            >
              <span>전체 설교 목록 보기</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. THIS YEAR EVENTS */}
      <section className="py-14 sm:py-20 lg:py-24 bg-[#F8FAF8]">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-6">
          <div className="grid lg:grid-cols-2 xl:grid-cols-[380px_1fr] gap-8 sm:gap-10 xl:gap-24 items-start">
            <div className="xl:sticky xl:top-28 text-center lg:text-left flex flex-col items-center lg:items-start">
              <p className="text-[#2E7D32] text-xs font-bold uppercase tracking-[0.2em] mb-3">
                THIS YEAR
              </p>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#1a2744] leading-tight mb-4 sm:mb-6 break-keep">
                특별한 예배와
                <br />
                행사에 함께하세요
              </h2>
              <p className="text-gray-500 text-sm sm:text-base leading-relaxed mb-6 sm:mb-8 max-w-md break-keep">
                일광교회는 다양한 절기 예배와 특별 행사를 통해 성도들이 하나님의
                은혜를 더욱 풍성하게 경험할 수 있도록 준비하고 있습니다.
              </p>
              <Link
                href="/news/events"
                className="inline-block px-7 py-3.5 bg-[#2E7D32] text-white font-bold rounded-[26px] hover:bg-[#1B5E20] transition-colors tracking-wide"
              >
                모든 행사 보기
              </Link>
            </div>

            <div className="grid sm:grid-cols-1 xl:grid-cols-2 gap-4">
              {featuredEvents.map(({ evt, isoDate }) => (
                <div
                  key={evt.id}
                  className="flex gap-3.5 sm:gap-5 bg-white rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
                >
                  <div className="shrink-0 w-16 h-16 bg-[#1a2744] rounded-xl flex flex-col items-center justify-center text-white">
                    <span className="text-2xl font-black leading-none">
                      {isoDate.slice(8, 10) || evt.dayBadge}
                    </span>
                    <span className="text-[10px] font-semibold opacity-75 mt-0.5">
                      {isoDate
                        ? `${isoDate.slice(0, 4)}. ${isoDate.slice(5, 7)}`
                        : evt.monthYearBadge}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-[#1a2744] mb-1.5">
                      {evt.title}
                    </h3>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>🕒 {evt.timeText}</span>
                      <span>📍 {evt.location}</span>
                    </div>
                  </div>
                  <Link
                    href="/news/events"
                    aria-label={`${evt.title} 상세 보기`}
                    className="shrink-0 self-center w-10 h-10 rounded-full bg-[#2E7D32]/10 flex items-center justify-center text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white transition-colors"
                  >
                    →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. MISSION STATEMENT BANNER */}
      <section className="relative py-16 sm:py-24 bg-[#1a2744] overflow-hidden">
        <img
          src={content.churchInfo.missionBackgroundUrl?.trim() || "/ilkwang01.png"}
          alt={`${content.churchInfo.name} 비전`}
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-6">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="rounded-2xl overflow-hidden shadow-2xl max-w-md mx-auto w-full border-2 border-white/20">
              <img
                src={content.churchInfo.missionCardImageUrl?.trim() || "/c01/cube-1.png"}
                alt={`${content.churchInfo.name} 공동체`}
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
            <div>
              <div className="text-[#6dbf73] text-5xl sm:text-6xl font-black leading-none mb-4 opacity-85">
                &ldquo;
              </div>
              <blockquote className="text-white text-xl sm:text-2xl lg:text-3xl font-bold leading-snug mb-6 text-center md:text-left break-keep">
                우리의 목표는 지역 사회에서 소외된 이웃들에게 복음의 빛을
                전하고, 모든 사람이 하나님의 사랑 안에서 새로운 삶을 시작하도록
                돕는 것입니다.
              </blockquote>
              <p className="text-gray-300 leading-relaxed text-center md:text-left text-sm sm:text-base break-keep">
                {content.churchInfo.foundedYear}년 설립된{" "}
                {content.churchInfo.name}는 {content.churchInfo.denomination}
                으로, 반세기가 넘는 역사 속에서 하나님의 말씀을 붙잡고 성장해 온
                교회입니다. 말씀과 기도, 사랑으로 지역 사회와 함께합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. ALL ABOUT JESUS */}
      <section className="py-14 sm:py-20 lg:py-24 bg-[#F8FAF8]">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-[#2E7D32] text-xs font-bold uppercase tracking-[0.2em] mb-3">
              ALL ABOUT JESUS
            </p>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#1a2744] mb-4">
              우리가 믿는 것
            </h2>
            <p className="text-gray-500 leading-relaxed max-w-xl mx-auto mb-6 sm:mb-8">
              일광교회는 성경 말씀에 기초한 개혁주의 신앙을 고백하며, 삼위일체
              하나님을 예배합니다.
            </p>
            <Link
              href="/about/vision"
              className="inline-block px-8 py-3.5 bg-[#2E7D32] text-white font-bold rounded-[26px] hover:bg-[#1B5E20] transition-colors tracking-wide"
            >
              교회 비전 보기
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {FAITH_CONFESSIONS.map((item) => (
              <div
                key={item.tag}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow group border border-gray-100"
              >
                <div className="overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5 sm:p-6">
                  <span className="text-[10px] font-black text-[#2E7D32] tracking-widest uppercase mb-2 block">
                    {item.tag}
                  </span>
                  <h3 className="text-lg font-black text-[#1a2744] mb-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed break-keep">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. VISIT US */}
      <section className="py-10 sm:py-16 bg-white">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-6">
          <div className="bg-[#F8FAF8] rounded-2xl p-6 sm:p-10 text-center shadow-sm border border-gray-100">
            <p className="text-[#2E7D32] text-xs font-bold uppercase tracking-[0.2em] mb-3">
              VISIT US
            </p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mb-6 sm:mb-8 text-[#1a2744]">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-[#2E7D32]">🕒</span>
                <span>{content.churchInfo.visitSummary}</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-[#2E7D32]">📍</span>
                <span>{content.churchInfo.shortAddress}</span>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1a2744] mb-2">
              {content.churchInfo.name}로 오세요
            </h2>
            <p className="text-gray-500 mb-8">
              처음 방문하시는 분도 환영합니다. 온라인 새가족 등록 또는 전화로 언제든 문의해 주세요.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={`tel:${content.churchInfo.phone}`}
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#2E7D32] text-white font-bold rounded-[26px] hover:bg-[#1B5E20] transition-colors text-base tracking-wide"
              >
                <span>📞</span>
                <span>{content.churchInfo.phone}</span>
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-8 py-4 border-2 border-[#1a2744] text-[#1a2744] font-bold rounded-[26px] hover:bg-[#1a2744] hover:text-white transition-colors text-base tracking-wide"
              >
                온라인 새가족 등록 · 문의
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
