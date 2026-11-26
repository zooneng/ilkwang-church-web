"use client";

import { useMemo, useState } from "react";
import { AdminEditLink } from "@/components/AdminEditLink";
import type { CustomBoard } from "@/types/site-content";

interface CustomBoardClientProps {
  readonly initialBoard: CustomBoard;
  readonly initialSelectedId?: string;
}

export function CustomBoardClient({
  initialBoard,
  initialSelectedId,
}: CustomBoardClientProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialSelectedId
  );
  const [searchQuery, setSearchQuery] = useState("");

  const sortedPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...initialBoard.posts]
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
      .filter((post) => {
        if (!q) return true;
        return (
          post.title.toLowerCase().includes(q) ||
          post.content.toLowerCase().includes(q) ||
          post.categoryTag.toLowerCase().includes(q)
        );
      });
  }, [initialBoard.posts, searchQuery]);

  const activePost =
    sortedPosts.find((p) => p.id === selectedId) ?? sortedPosts[0] ?? null;

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-6 py-10 sm:py-16 space-y-8">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#1a2744]">
            {initialBoard.title}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            목록에서 게시물을 선택하면 본문과 첨부 자료를 확인하실 수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <AdminEditLink
            href={`/admin?tab=posts&board=${encodeURIComponent(`custom:${initialBoard.slug}`)}`}
            className="px-4 py-2 rounded-full bg-[#1a2744] text-white hover:bg-[#2E7D32] text-xs font-bold transition-colors"
          >
            게시판 관리
          </AdminEditLink>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="제목, 본문 내용 검색..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-[#2E7D32] focus:outline-none"
        />
      </div>

      {/* Active Post Reader */}
      {activePost ? (
        <article className="bg-[#F8FAF8] rounded-2xl border border-[#2E7D32]/25 p-5 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {activePost.isPinned && (
              <span className="px-2.5 py-1 rounded-full bg-[#1a2744] text-white text-xs font-bold">
                상단고정
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-[#2E7D32] text-white text-xs font-bold">
              {activePost.categoryTag}
            </span>
            <span className="text-xs text-gray-500">{activePost.date}</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-[#1a2744] break-keep">
            {activePost.title}
          </h3>
          {activePost.imageUrl && (
            <div className="pt-2">
              <img
                src={activePost.imageUrl}
                alt={activePost.title}
                className="max-h-[420px] w-auto max-w-full rounded-xl border border-gray-200 object-contain bg-white"
              />
            </div>
          )}
          <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line break-keep pt-2 border-t border-gray-200">
            {activePost.content}
          </p>
          {activePost.attachmentUrl && (
            <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs sm:text-sm font-semibold text-[#1a2744] break-all">
                첨부 자료: {activePost.attachmentName || "첨부파일 다운로드"}
              </span>
              <a
                href={activePost.attachmentUrl}
                download={activePost.attachmentName || true}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-[#2E7D32] text-white text-xs font-bold hover:bg-[#1B5E20] transition-colors shrink-0"
              >
                첨부파일 내려받기 ↓
              </a>
            </div>
          )}
        </article>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
          등록된 게시물이 없습니다.
        </div>
      )}

      {/* Post List */}
      {sortedPosts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {sortedPosts.map((post) => {
            const isSelected = activePost?.id === post.id;
            return (
              <button
                key={post.id}
                type="button"
                onClick={() => {
                  setSelectedId(post.id);
                  window.scrollTo({ top: 240, behavior: "smooth" });
                }}
                className={`w-full text-left px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                  isSelected
                    ? "bg-[#E8F5E9]/60"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  {post.isPinned && (
                    <span className="px-2 py-0.5 rounded bg-[#1a2744] text-white text-[11px] font-bold shrink-0">
                      공지
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-[#2E7D32] text-xs font-bold shrink-0">
                    {post.categoryTag}
                  </span>
                  <span className="font-bold text-sm sm:text-base text-[#1a2744] break-keep">
                    {post.title}
                  </span>
                  {post.attachmentUrl && (
                    <span className="text-xs text-[#2E7D32] font-semibold shrink-0">
                      📎 첨부
                    </span>
                  )}
                </div>
                <div className="flex items-center text-xs text-gray-400 shrink-0">
                  <span>{post.date}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
