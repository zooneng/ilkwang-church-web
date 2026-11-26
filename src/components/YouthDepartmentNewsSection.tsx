"use client";

import { useState } from "react";
import { AdminEditLink } from "@/components/AdminEditLink";
import type { CommunityPost, YouthDepartmentConfig } from "@/types/site-content";

interface YouthDepartmentNewsSectionProps {
  readonly dept: YouthDepartmentConfig;
  readonly posts: readonly CommunityPost[];
}

const INITIAL_VISIBLE_COUNT = 6;

export function YouthDepartmentNewsSection({
  dept,
  posts,
}: YouthDepartmentNewsSectionProps) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(
    () => posts[0]?.id ?? null
  );
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  const activePost = posts.find((p) => p.id === selectedPostId) ?? null;
  const visiblePosts = posts.slice(0, visibleCount);
  const remainingCount = Math.max(0, posts.length - visibleCount);

  return (
    <section
      id="dept-news"
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 sm:p-10 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-[#2E7D32]">
            DEPARTMENT NEWS
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-[#1a2744] mt-1">
            {dept.title} 소식 및 사역 나눔
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {dept.title} 예배, 수련회, 찬양 및 소그룹 모임 기록을 바로 확인합니다.
          </p>
        </div>

        <AdminEditLink
          href={`/admin?tab=community&dept=${dept.id}`}
          className="px-4 py-2 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
        >
          + {dept.title} 소식 등록하기
        </AdminEditLink>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-[#F8FAF8] p-10 text-center space-y-2">
          <p className="text-sm font-bold text-[#1a2744]">
            등록된 {dept.title} 소식이 아직 없습니다.
          </p>
          <p className="text-xs text-gray-500">
            관리자 모드의 [다음 세대 부서 소식]에서 첫 소식을 등록해 보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {activePost && (
            <article
              className={`bg-[#F8FAF8] rounded-2xl border border-[#2E7D32]/25 p-5 sm:p-7 grid gap-6 ${
                activePost.content.trim()
                  ? "md:grid-cols-[380px_1fr] items-start"
                  : "md:grid-cols-[1.15fr_0.85fr] items-center"
              }`}
            >
              {activePost.youtubeId ? (
                <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-gray-200 shadow-xs">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${activePost.youtubeId}?rel=0`}
                    title={activePost.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              ) : (
                <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                  <img
                    src={activePost.imageUrl}
                    alt={activePost.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-[#2E7D32] text-white text-xs font-bold">
                      {dept.title}
                    </span>
                    {activePost.youtubeId && (
                      <span className="px-2.5 py-1 rounded-full bg-[#1a2744] text-white text-xs font-bold">
                        사역 영상
                      </span>
                    )}
                    <span className="text-xs text-gray-500 font-semibold">
                      {activePost.date}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPostId(null)}
                    className="text-xs font-bold text-gray-500 hover:text-[#1a2744]"
                  >
                    접기 ✕
                  </button>
                </div>

                <h4 className="text-lg sm:text-xl font-black text-[#1a2744] break-keep">
                  {activePost.title}
                </h4>

                {activePost.content.trim() && (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line pt-3 border-t border-gray-200 break-keep">
                    {activePost.content}
                  </p>
                )}
              </div>
            </article>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visiblePosts.map((post) => {
              const isSelected = activePost?.id === post.id;
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => {
                    setSelectedPostId(isSelected ? null : post.id);
                    if (!isSelected) {
                      document
                        .getElementById("dept-news")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className={`text-left rounded-2xl border overflow-hidden flex flex-col transition-all group ${
                    isSelected
                      ? "border-[#2E7D32] bg-[#F8FAF8] ring-2 ring-[#2E7D32]/15"
                      : "border-gray-100 bg-white shadow-xs hover:shadow-md hover:border-gray-200"
                  }`}
                >
                  <div className="aspect-[16/10] bg-gray-100 overflow-hidden w-full relative">
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {post.youtubeId && (
                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/75 text-white text-[11px] font-bold">
                        ▶ 사역 영상
                      </span>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col w-full">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-[#2E7D32]">
                        {dept.title}
                      </span>
                      <span className="text-xs text-gray-400">{post.date}</span>
                    </div>
                    <h4 className="text-base font-black text-[#1a2744] group-hover:text-[#2E7D32] transition-colors break-keep">
                      {post.title}
                    </h4>
                    {post.content.trim() && (
                      <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 mt-1.5 break-keep">
                        {post.content}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {remainingCount > 0 && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((prev) => prev + INITIAL_VISIBLE_COUNT)
                }
                className="px-6 py-2.5 rounded-full border border-gray-300 bg-white hover:border-[#2E7D32] hover:text-[#2E7D32] text-xs sm:text-sm font-bold text-[#1a2744] transition-colors"
              >
                이전 {dept.title} 소식 더 보기 ↓
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
