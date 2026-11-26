"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminPaginationBar } from "@/components/AdminPaginationBar";
import { BUILTIN_LINK_PRESETS } from "@/components/NavigationConfig";
import { createClientSafeId, getKstDateString } from "@/lib/format-utils";
import { readJsonResponseSafe } from "@/lib/media-utils";
import type {
  ManagedBoardPost,
  ManagedBoardSummary,
  NavCategoryConfig,
  NavSubItemConfig,
  SiteContent,
} from "@/types/site-content";

interface AdminMenusAndBoardsStudioProps {
  readonly draft: SiteContent;
  readonly initialBoardSummaries: readonly ManagedBoardSummary[];
  readonly initialSelectedBoardKey?: string;
  readonly sectionMode?: "menus-only" | "posts-only" | "both";
  readonly onSaveNavigation: (
    nextContent: SiteContent,
    toastText: string
  ) => Promise<void>;
  readonly onSyncContentFromServer: (nextContent: SiteContent) => void;
  readonly onUploadFile: (
    file: File,
    bucket: "bulletins" | "resources" | "gallery" | "profiles" | "notices",
    label: string
  ) => Promise<{
    readonly url: string;
    readonly fileName: string;
    readonly sizeLabel: string;
  } | null>;
  readonly onToast: (msg: string) => void;
  readonly onError: (msg: string) => void;
}

export function AdminMenusAndBoardsStudio({
  draft,
  initialBoardSummaries,
  initialSelectedBoardKey,
  sectionMode = "both",
  onSaveNavigation,
  onSyncContentFromServer,
  onUploadFile,
  onToast,
  onError,
}: AdminMenusAndBoardsStudioProps) {
  const router = useRouter();

  // 1. Navigation Category State (synced with draft.navigation)
  const categories = draft.navigation;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    () => categories[0]?.id ?? ""
  );
  const [navDirty, setNavDirty] = useState(false);
  const [localCategories, setLocalCategories] = useState<
    readonly NavCategoryConfig[]
  >(categories);
  const [savingNav, setSavingNav] = useState(false);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(
    null
  );

  // Add Top-Level Category Form
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatDescription, setNewCatDescription] = useState("");

  // Create Custom Board Form
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardSubtitle, setNewBoardSubtitle] = useState("");
  const [newBoardSlug, setNewBoardSlug] = useState("");
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [confirmDeleteBoardSlug, setConfirmDeleteBoardSlug] = useState<
    string | null
  >(null);

  // Add Built-in Link Form
  const [selectedPresetHref, setSelectedPresetHref] = useState<string>(
    BUILTIN_LINK_PRESETS[0]?.href ?? "/about"
  );

  // 2. Unified Post Manager State
  const [summaries, setSummaries] = useState<readonly ManagedBoardSummary[]>(
    initialBoardSummaries
  );
  const [activeBoardKey, setActiveBoardKey] = useState<string>(() => {
    if (
      initialSelectedBoardKey &&
      initialBoardSummaries.some((s) => s.boardKey === initialSelectedBoardKey)
    ) {
      return initialSelectedBoardKey;
    }
    return initialBoardSummaries[0]?.boardKey ?? "builtin:notices";
  });
  const [postSearch, setPostSearch] = useState("");
  const [postPage, setPostPage] = useState(1);
  const [postPageSize, setPostPageSize] = useState(10);
  const [selectedPostIds, setSelectedPostIds] = useState<readonly string[]>([]);
  const [moveTargetBoardKey, setMoveTargetBoardKey] = useState<string>("");
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [busyPostOp, setBusyPostOp] = useState(false);

  // New Post Composer inside Post Manager
  const [composerOpen, setComposerOpen] = useState(false);
  const [newPostTag, setNewPostTag] = useState("소식");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostDate, setNewPostDate] = useState(() => getKstDateString());
  const [newPostPinned, setNewPostPinned] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImageUrl, setNewPostImageUrl] = useState("");
  const [newPostAttachUrl, setNewPostAttachUrl] = useState("");
  const [newPostAttachName, setNewPostAttachName] = useState("");

  // Inline Post Edit State
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostDraft, setEditPostDraft] = useState<{
    readonly categoryTag: string;
    readonly title: string;
    readonly date: string;
    readonly content: string;
    readonly isPinned: boolean;
    readonly attachmentUrl: string;
    readonly attachmentName: string;
  } | null>(null);

  const activeCategory =
    localCategories.find((c) => c.id === selectedCategoryId) ??
    localCategories[0] ??
    null;

  const activeSummary =
    summaries.find((s) => s.boardKey === activeBoardKey) ??
    summaries[0] ??
    null;

  const filteredPosts: readonly ManagedBoardPost[] = useMemo(() => {
    if (!activeSummary) return [];
    const q = postSearch.trim().toLowerCase();
    if (!q) return activeSummary.posts;
    return activeSummary.posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.categoryTag.toLowerCase().includes(q)
    );
  }, [activeSummary, postSearch]);

  const totalPostPages = Math.max(
    1,
    Math.ceil(filteredPosts.length / postPageSize)
  );
  const safePostPage = Math.min(postPage, totalPostPages);
  const pagedPosts = useMemo(
    () =>
      filteredPosts.slice(
        (safePostPage - 1) * postPageSize,
        safePostPage * postPageSize
      ),
    [filteredPosts, safePostPage, postPageSize]
  );

  const otherBoards = useMemo(
    () =>
      summaries.filter((s) => s.boardKey !== (activeSummary?.boardKey ?? "")),
    [summaries, activeSummary]
  );

  const effectiveMoveTarget =
    otherBoards.some((b) => b.boardKey === moveTargetBoardKey)
      ? moveTargetBoardKey
      : (otherBoards[0]?.boardKey ?? "");

  function updateLocalNav(
    updater: (prev: readonly NavCategoryConfig[]) => readonly NavCategoryConfig[]
  ) {
    setLocalCategories((prev) => updater(prev));
    setNavDirty(true);
  }

  async function persistNavigationNow(
    nextNav: readonly NavCategoryConfig[],
    toastMsg: string
  ) {
    setSavingNav(true);
    try {
      const normalized = nextNav.map((cat) => {
        const firstVisibleHref =
          cat.items.find((i) => i.isVisible !== false)?.href ?? cat.href ?? "/";
        const safeHref =
          cat.href && cat.href !== "#" ? cat.href : firstVisibleHref;
        return {
          ...cat,
          href: safeHref,
        };
      });
      setLocalCategories(normalized);
      await onSaveNavigation(
        {
          ...draft,
          navigation: normalized,
        },
        toastMsg
      );
      setNavDirty(false);
    } finally {
      setSavingNav(false);
    }
  }

  // Add a new top-level category (to the right of existing categories)
  async function handleAddTopCategory() {
    const label = newCatLabel.trim();
    if (!label) {
      onError("추가할 상위 카테고리 이름을 입력해 주세요.");
      return;
    }
    const created: NavCategoryConfig = {
      id: createClientSafeId("nav-cat"),
      label,
      headingTitle: label,
      description:
        newCatDescription.trim() ||
        `일광교회 ${label} 안내 및 게시판 공간입니다.`,
      href: "/",
      isVisible: true,
      items: [],
    };
    const nextNav = [...localCategories, created];
    setNewCatLabel("");
    setNewCatDescription("");
    setSelectedCategoryId(created.id);
    await persistNavigationNow(
      nextNav,
      `상위 카테고리 "${label}"이(가) 메뉴 오른쪽에 추가되었습니다. 이제 아래에서 하위 게시판을 생성해 보세요.`
    );
  }

  function handleMoveCategory(catId: string, direction: -1 | 1) {
    const idx = localCategories.findIndex((c) => c.id === catId);
    if (idx < 0) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= localCategories.length) return;
    const copy = [...localCategories];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    updateLocalNav(() => copy);
  }

  async function handleDeleteCategory(catId: string) {
    if (localCategories.length <= 1) {
      onError("최소 1개 이상의 상위 카테고리는 유지되어야 합니다.");
      return;
    }
    const target = localCategories.find((c) => c.id === catId);
    const nextNav = localCategories.filter((c) => c.id !== catId);
    setConfirmDeleteCatId(null);
    if (selectedCategoryId === catId) {
      setSelectedCategoryId(nextNav[0]?.id ?? "");
    }

    // Clean up custom boards owned exclusively by the deleted category
    const ownedSlugs = (target?.items ?? [])
      .map(
        (sub) =>
          sub.customBoardSlug ||
          (sub.href.startsWith("/boards/")
            ? sub.href.slice("/boards/".length)
            : "")
      )
      .filter((slug) => Boolean(slug))
      .filter(
        (slug) =>
          !nextNav.some((cat) =>
            cat.items.some(
              (item) =>
                item.customBoardSlug === slug || item.href === `/boards/${slug}`
            )
          )
      );

    await persistNavigationNow(
      nextNav,
      `상위 카테고리 "${target?.label ?? ""}"이(가) 상단 메뉴에서 제거되었습니다.`
    );

    for (const slug of ownedSlugs) {
      try {
        const response = await fetch("/api/board-manager", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete-board", slug }),
        });
        if (response.ok) {
          const data = await readJsonResponseSafe<{
            readonly summaries?: readonly ManagedBoardSummary[];
          }>(response, "게시판 정리 응답을 읽지 못했습니다.");
          if (data.summaries) {
            setSummaries(data.summaries);
            if (activeBoardKey === `custom:${slug}`) {
              setActiveBoardKey(
                data.summaries[0]?.boardKey ?? "builtin:notices"
              );
              setSelectedPostIds([]);
            }
          }
        }
      } catch {
        // Non-fatal cleanup after navigation update
      }
    }
    if (ownedSlugs.length > 0) {
      router.refresh();
    }
  }

  function handleMoveSubItem(catId: string, subId: string, direction: -1 | 1) {
    updateLocalNav((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;
        const idx = cat.items.findIndex((i) => i.id === subId);
        if (idx < 0) return cat;
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= cat.items.length) return cat;
        const copy = [...cat.items];
        const [moved] = copy.splice(idx, 1);
        copy.splice(nextIdx, 0, moved);
        return {
          ...cat,
          href: copy[0]?.href ?? cat.href,
          items: copy,
        };
      })
    );
  }

  function handleDetachSubItem(catId: string, subId: string) {
    updateLocalNav((prev) =>
      prev.map((cat) => {
        if (cat.id !== catId) return cat;
        const remaining = cat.items.filter((i) => i.id !== subId);
        const nextHref = remaining.some((i) => i.href === cat.href)
          ? cat.href
          : (remaining[0]?.href ?? "/");
        return {
          ...cat,
          href: nextHref,
          items: remaining,
        };
      })
    );
  }

  function handleAttachPresetPage() {
    if (!activeCategory) return;
    const preset = BUILTIN_LINK_PRESETS.find(
      (p) => p.href === selectedPresetHref
    );
    if (!preset) return;
    const newItem: NavSubItemConfig = {
      id: createClientSafeId("sub"),
      label: preset.label,
      href: preset.href,
      description: preset.description,
      isVisible: true,
    };
    updateLocalNav((prev) =>
      prev.map((cat) =>
        cat.id === activeCategory.id
          ? {
              ...cat,
              href:
                !cat.href || cat.href === "/" || cat.items.length === 0
                  ? preset.href
                  : cat.href,
              items: [...cat.items, newItem],
            }
          : cat
      )
    );
    onToast(
      `"${preset.label}" 메뉴가 "${activeCategory.label}" 아래에 추가되었습니다. [메뉴 구성 저장하기]를 눌러 반영해 주세요.`
    );
  }

  // Create Custom Board under activeCategory
  async function handleCreateCustomBoard() {
    if (!activeCategory) {
      onError("먼저 게시판을 추가할 상위 카테고리를 선택해 주세요.");
      return;
    }
    if (!newBoardTitle.trim()) {
      onError("생성할 게시판 이름을 입력해 주세요.");
      return;
    }

    setCreatingBoard(true);
    try {
      // If unsaved local category edits exist, persist them first so server sees the category!
      if (navDirty) {
        await onSaveNavigation(
          { ...draft, navigation: localCategories },
          "상위 카테고리 변경사항을 먼저 동기화했습니다."
        );
        setNavDirty(false);
      }

      const response = await fetch("/api/board-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-board",
          parentCategoryId: activeCategory.id,
          title: newBoardTitle.trim(),
          subtitle: newBoardSubtitle.trim() || undefined,
          slug: newBoardSlug.trim() || undefined,
          allowMemberWrite: false,
        }),
      });
      const data = await readJsonResponseSafe<{
        readonly board?: { readonly slug: string; readonly title: string };
        readonly content?: SiteContent;
        readonly summaries?: readonly ManagedBoardSummary[];
        readonly error?: string;
      }>(response, "게시판 생성에 실패했습니다.");
      if (!response.ok || !data.content || !data.summaries || !data.board) {
        throw new Error(data.error ?? "게시판 생성에 실패했습니다.");
      }

      setLocalCategories(data.content.navigation);
      onSyncContentFromServer(data.content);
      setSummaries(data.summaries);
      setActiveBoardKey(`custom:${data.board.slug}`);
      setSelectedPostIds([]);
      setNewBoardTitle("");
      setNewBoardSubtitle("");
      setNewBoardSlug("");
      onToast(
        `새 게시판 "${data.board.title}"이(가) "${activeCategory.label}" 아래에 생성되었습니다.`
      );
      router.refresh();
    } catch (err: unknown) {
      onError(
        err instanceof Error ? err.message : "게시판 생성 중 오류가 발생했습니다."
      );
    } finally {
      setCreatingBoard(false);
    }
  }

  async function handleDeleteCustomBoard(slug: string) {
    setCreatingBoard(true);
    try {
      const response = await fetch("/api/board-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-board",
          slug,
        }),
      });
      const data = await readJsonResponseSafe<{
        readonly content?: SiteContent;
        readonly summaries?: readonly ManagedBoardSummary[];
        readonly error?: string;
      }>(response, "게시판 삭제에 실패했습니다.");
      if (!response.ok || !data.content || !data.summaries) {
        throw new Error(data.error ?? "게시판 삭제에 실패했습니다.");
      }
      setConfirmDeleteBoardSlug(null);
      setLocalCategories(data.content.navigation);
      onSyncContentFromServer(data.content);
      setSummaries(data.summaries);
      if (activeBoardKey === `custom:${slug}`) {
        setActiveBoardKey(data.summaries[0]?.boardKey ?? "builtin:notices");
        setSelectedPostIds([]);
      }
      onToast("선택한 게시판이 삭제되고 메뉴에서 자동 분리되었습니다.");
      router.refresh();
    } catch (err: unknown) {
      onError(
        err instanceof Error ? err.message : "게시판 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setCreatingBoard(false);
    }
  }

  // Post Selection Helpers
  const allFilteredSelected =
    filteredPosts.length > 0 &&
    filteredPosts.every((p) => selectedPostIds.includes(p.id));

  function handleToggleSelectAllFiltered() {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredPosts.map((p) => p.id));
      setSelectedPostIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([
        ...selectedPostIds,
        ...filteredPosts.map((p) => p.id),
      ]);
      setSelectedPostIds([...merged]);
    }
  }

  function handleToggleSelectOne(postId: string) {
    setSelectedPostIds((prev) =>
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId]
    );
  }

  // Create Post in Active Board
  async function handleCreateManagedPost(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSummary) return;
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      onError("게시물 제목과 본문을 입력해 주세요.");
      return;
    }
    setBusyPostOp(true);
    try {
      const response = await fetch("/api/board-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-post",
          boardKey: activeSummary.boardKey,
          categoryTag: newPostTag.trim() || "소식",
          title: newPostTitle.trim(),
          author: "일광교회",
          date: newPostDate,
          content: newPostContent.trim(),
          isPinned: newPostPinned,
          imageUrl: newPostImageUrl || undefined,
          attachmentUrl: newPostAttachUrl || undefined,
          attachmentName: newPostAttachName || undefined,
        }),
      });
      const data = await readJsonResponseSafe<{
        readonly content?: SiteContent;
        readonly summaries?: readonly ManagedBoardSummary[];
        readonly error?: string;
      }>(response, "게시물 등록에 실패했습니다.");
      if (!response.ok || !data.content || !data.summaries) {
        throw new Error(data.error ?? "게시물 등록에 실패했습니다.");
      }
      onSyncContentFromServer(data.content);
      setSummaries(data.summaries);
      setNewPostTitle("");
      setNewPostContent("");
      setNewPostPinned(false);
      setNewPostImageUrl("");
      setNewPostAttachUrl("");
      setNewPostAttachName("");
      setComposerOpen(false);
      onToast(`"${activeSummary.title}" 게시판에 새 게시물이 등록되었습니다.`);
      router.refresh();
    } catch (err: unknown) {
      onError(
        err instanceof Error ? err.message : "게시물 등록 중 오류가 발생했습니다."
      );
    } finally {
      setBusyPostOp(false);
    }
  }

  // Quick Toggle Pin or Save Inline Post Edit
  async function handleUpdatePost(
    postId: string,
    patch: {
      readonly categoryTag?: string;
      readonly title?: string;
      readonly author?: string;
      readonly date?: string;
      readonly content?: string;
      readonly isPinned?: boolean;
      readonly attachmentUrl?: string;
      readonly attachmentName?: string;
    },
    toastMsg: string
  ) {
    if (!activeSummary) return;
    setBusyPostOp(true);
    try {
      const response = await fetch("/api/board-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-post",
          boardKey: activeSummary.boardKey,
          postId,
          ...patch,
        }),
      });
      const data = await readJsonResponseSafe<{
        readonly content?: SiteContent;
        readonly summaries?: readonly ManagedBoardSummary[];
        readonly error?: string;
      }>(response, "게시물 수정에 실패했습니다.");
      if (!response.ok || !data.content || !data.summaries) {
        throw new Error(data.error ?? "게시물 수정에 실패했습니다.");
      }
      onSyncContentFromServer(data.content);
      setSummaries(data.summaries);
      setEditingPostId(null);
      setEditPostDraft(null);
      onToast(toastMsg);
      router.refresh();
    } catch (err: unknown) {
      onError(
        err instanceof Error ? err.message : "게시물 수정 중 오류가 발생했습니다."
      );
    } finally {
      setBusyPostOp(false);
    }
  }

  // Bulk Delete Selected Posts
  async function handleExecuteBulkDelete() {
    if (!activeSummary || selectedPostIds.length === 0) return;
    setBusyPostOp(true);
    try {
      const response = await fetch("/api/board-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk-delete-posts",
          boardKey: activeSummary.boardKey,
          postIds: selectedPostIds,
        }),
      });
      const data = await readJsonResponseSafe<{
        readonly deletedCount?: number;
        readonly content?: SiteContent;
        readonly summaries?: readonly ManagedBoardSummary[];
        readonly error?: string;
      }>(response, "일괄 삭제에 실패했습니다.");
      if (!response.ok || !data.content || !data.summaries) {
        throw new Error(data.error ?? "일괄 삭제에 실패했습니다.");
      }
      onSyncContentFromServer(data.content);
      setSummaries(data.summaries);
      setSelectedPostIds([]);
      setConfirmBulkDelete(false);
      onToast(
        `"${activeSummary.title}"에서 선택한 ${data.deletedCount ?? 0}건의 게시물이 일괄 삭제되었습니다.`
      );
      router.refresh();
    } catch (err: unknown) {
      onError(
        err instanceof Error ? err.message : "일괄 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setBusyPostOp(false);
    }
  }

  // Move Selected Posts to Target Board
  async function handleExecuteMovePosts() {
    if (
      !activeSummary ||
      selectedPostIds.length === 0 ||
      !effectiveMoveTarget
    ) {
      onError("이동할 게시물과 대상 게시판을 선택해 주세요.");
      return;
    }
    const targetBoardObj = summaries.find(
      (b) => b.boardKey === effectiveMoveTarget
    );
    setBusyPostOp(true);
    try {
      const response = await fetch("/api/board-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move-posts",
          sourceBoardKey: activeSummary.boardKey,
          targetBoardKey: effectiveMoveTarget,
          postIds: selectedPostIds,
        }),
      });
      const data = await readJsonResponseSafe<{
        readonly movedCount?: number;
        readonly content?: SiteContent;
        readonly summaries?: readonly ManagedBoardSummary[];
        readonly error?: string;
      }>(response, "게시물 이동에 실패했습니다.");
      if (!response.ok || !data.content || !data.summaries) {
        throw new Error(data.error ?? "게시물 이동에 실패했습니다.");
      }
      onSyncContentFromServer(data.content);
      setSummaries(data.summaries);
      setSelectedPostIds([]);
      setConfirmBulkDelete(false);
      onToast(
        `선택한 ${data.movedCount ?? 0}건의 게시물이 "${activeSummary.title}"에서 "${targetBoardObj?.title ?? "대상 게시판"}"(으)로 이동되었습니다.`
      );
      router.refresh();
    } catch (err: unknown) {
      onError(
        err instanceof Error ? err.message : "게시물 이동 중 오류가 발생했습니다."
      );
    } finally {
      setBusyPostOp(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* =========================================================
          SECTION 1: 상위 카테고리 관리 (추가 · 순서 · 숨김 · 삭제)
      ========================================================= */}
      {sectionMode !== "posts-only" && (
      <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
              상단 메뉴 및 게시판 추가
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              상단 카테고리와 하위 게시판을 추가하거나 순서를 변경할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            disabled={savingNav}
            onClick={() =>
              persistNavigationNow(
                localCategories,
                "상단 카테고리 및 하위 메뉴 구성이 저장되어 홈페이지 전체에 반영되었습니다."
              )
            }
            className={`shrink-0 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-colors ${
              navDirty
                ? "bg-[#2E7D32] text-white hover:bg-[#1B5E20] shadow-md"
                : "bg-[#1a2744] text-white hover:bg-[#2E7D32]"
            } disabled:opacity-50`}
          >
            {savingNav
              ? "메뉴 저장 중..."
              : navDirty
                ? "메뉴 변경사항 저장하기 *"
                : "메뉴 구성 저장하기"}
          </button>
        </div>

        {/* Horizontal Visual Preview Bar of Top-Level Categories */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600">
              현재 상단 큰 카테고리 순서 (클릭하면 아래에서 세부 설정 및 하위 게시판을 관리합니다)
            </span>
            <span className="text-xs text-gray-400">
              총 {localCategories.length}개 카테고리
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 bg-[#F8FAF8] p-4 rounded-2xl border border-gray-200">
            {localCategories.map((cat, idx) => {
              const selected = activeCategory?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setConfirmDeleteCatId(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                    selected
                      ? "bg-[#1a2744] text-white border-[#1a2744] shadow-sm"
                      : cat.isVisible
                        ? "bg-white text-[#1a2744] border-gray-200 hover:border-[#2E7D32]"
                        : "bg-gray-100 text-gray-400 border-dashed border-gray-300"
                  }`}
                >
                  <span className="text-xs opacity-65">{idx + 1}.</span>
                  <span>{cat.label}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {cat.items.length}
                  </span>
                  {!cat.isVisible && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                      숨김
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Add New Top-Level Category (e.g., to the right of 나눔과 소식) */}
        <div className="rounded-2xl bg-[#F8FAF8] border border-[#2E7D32]/25 p-5 space-y-3">
          <h3 className="text-sm font-black text-[#1a2744]">
            + 오른쪽에 새 상위 카테고리 추가하기
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <input
                type="text"
                value={newCatLabel}
                onChange={(e) => setNewCatLabel(e.target.value)}
                placeholder="새 큰 카테고리 이름 (예: 선교와 사역)"
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#2E7D32] focus:outline-none"
              />
            </div>
            <div className="md:col-span-5">
              <input
                type="text"
                value={newCatDescription}
                onChange={(e) => setNewCatDescription(e.target.value)}
                placeholder="마우스 오버 시 좌측 안내 문구 (선택)"
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#2E7D32] focus:outline-none"
              />
            </div>
            <div className="md:col-span-3">
              <button
                type="button"
                disabled={savingNav}
                onClick={handleAddTopCategory}
                className="w-full h-full px-4 py-2.5 rounded-xl bg-[#2E7D32] text-white text-xs sm:text-sm font-bold hover:bg-[#1B5E20] transition-colors disabled:opacity-50"
              >
                + 상위 카테고리 추가
              </button>
            </div>
          </div>
        </div>

        {/* Selected Top-Level Category Detail Editor + Sub-Menu / Custom Board Manager */}
        {activeCategory && (
          <div className="rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-full bg-[#1a2744] text-white text-xs font-bold">
                  선택된 상위 카테고리
                </span>
                <h3 className="text-lg font-black text-[#1a2744]">
                  {activeCategory.label}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMoveCategory(activeCategory.id, -1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  ◀ 왼쪽으로 이동
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveCategory(activeCategory.id, 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  오른쪽으로 이동 ▶
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateLocalNav((prev) =>
                      prev.map((c) =>
                        c.id === activeCategory.id
                          ? { ...c, isVisible: !c.isVisible }
                          : c
                      )
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    activeCategory.isVisible
                      ? "bg-[#E8F5E9] text-[#2E7D32] border-[#2E7D32]/30"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  {activeCategory.isVisible ? "메뉴 노출중" : "메뉴 숨김 상태"}
                </button>
                {confirmDeleteCatId === activeCategory.id ? (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                    <span className="text-xs font-bold text-red-700">
                      카테고리를 뺄까요?
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(activeCategory.id)}
                      className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700"
                    >
                      삭제 확인
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCatId(null)}
                      className="px-2 py-1 rounded bg-white text-gray-600 text-xs font-bold border border-gray-200"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCatId(activeCategory.id)}
                    className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    상위 카테고리 삭제
                  </button>
                )}
              </div>
            </div>

            {/* Category Metadata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  상단 메뉴 이름
                </label>
                <input
                  type="text"
                  value={activeCategory.label}
                  onChange={(e) =>
                    updateLocalNav((prev) =>
                      prev.map((c) =>
                        c.id === activeCategory.id
                          ? { ...c, label: e.target.value }
                          : c
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm focus:border-[#2E7D32] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  펼침 메뉴 제목
                </label>
                <input
                  type="text"
                  value={activeCategory.headingTitle}
                  onChange={(e) =>
                    updateLocalNav((prev) =>
                      prev.map((c) =>
                        c.id === activeCategory.id
                          ? { ...c, headingTitle: e.target.value }
                          : c
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm focus:border-[#2E7D32] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  펼침 메뉴 설명
                </label>
                <input
                  type="text"
                  value={activeCategory.description}
                  onChange={(e) =>
                    updateLocalNav((prev) =>
                      prev.map((c) =>
                        c.id === activeCategory.id
                          ? { ...c, description: e.target.value }
                          : c
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm focus:border-[#2E7D32] focus:outline-none"
                />
              </div>
            </div>

            {/* Create Custom Board directly under Active Category */}
            <div className="rounded-2xl bg-[#F8FAF8] border border-[#2E7D32]/30 p-4 sm:p-5 space-y-4">
              <h4 className="text-sm sm:text-base font-black text-[#1a2744]">
                + &ldquo;{activeCategory.label}&rdquo; 아래에 새 게시판 만들기
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    새 게시판 이름 *
                  </label>
                  <input
                    type="text"
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                    placeholder="예: 선교소식, 구역모임"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm focus:border-[#2E7D32] focus:outline-none"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    게시판 한 줄 설명
                  </label>
                  <input
                    type="text"
                    value={newBoardSubtitle}
                    onChange={(e) => setNewBoardSubtitle(e.target.value)}
                    placeholder="예: 국내외 선교지 소식과 기도제목"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm focus:border-[#2E7D32] focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    영문 주소 (선택)
                  </label>
                  <input
                    type="text"
                    value={newBoardSlug}
                    onChange={(e) => setNewBoardSlug(e.target.value)}
                    placeholder="예: mission"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm focus:border-[#2E7D32] focus:outline-none"
                  />
                </div>
                <div className="md:col-span-3">
                  <button
                    type="button"
                    disabled={creatingBoard}
                    onClick={handleCreateCustomBoard}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#2E7D32] text-white text-xs sm:text-sm font-bold hover:bg-[#1B5E20] transition-colors disabled:opacity-50"
                  >
                    {creatingBoard ? "생성 중..." : "+ 새 게시판 생성"}
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-items List under Active Category */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-black text-[#1a2744]">
                  &ldquo;{activeCategory.label}&rdquo; 하위 메뉴 목록 (
                  {activeCategory.items.length}개)
                </h4>

                {/* Re-attach Built-in Page Helper */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <select
                    value={selectedPresetHref}
                    onChange={(e) => setSelectedPresetHref(e.target.value)}
                    className="min-w-0 flex-1 sm:flex-none max-w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700"
                  >
                    {BUILTIN_LINK_PRESETS.map((p) => (
                      <option key={p.href} value={p.href}>
                        기본 화면: {p.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAttachPresetPage}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-[#1a2744] hover:bg-gray-50 whitespace-nowrap shrink-0"
                  >
                    + 기본 화면 연결
                  </button>
                </div>
              </div>

              {activeCategory.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  아직 연결된 하위 메뉴나 게시판이 없습니다. 위에서 <strong>+ 새 게시판 생성</strong>을 눌러 첫 게시판을 만들어 보세요.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                  {activeCategory.items.map((sub, idx) => {
                    const customSlug =
                      sub.customBoardSlug ||
                      (sub.href.startsWith("/boards/")
                        ? sub.href.slice("/boards/".length)
                        : undefined);
                    const matchingSummary = customSlug
                      ? summaries.find(
                          (s) => s.boardKey === `custom:${customSlug}`
                        )
                      : summaries.find((s) => s.href === sub.href);

                    return (
                      <div
                        key={sub.id}
                        className="p-4 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                      >
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                          <div className="sm:col-span-4 flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 w-5">
                              {idx + 1}.
                            </span>
                            <input
                              type="text"
                              value={sub.label}
                              onChange={(e) =>
                                updateLocalNav((prev) =>
                                  prev.map((c) =>
                                    c.id === activeCategory.id
                                      ? {
                                          ...c,
                                          items: c.items.map((item) =>
                                            item.id === sub.id
                                              ? {
                                                  ...item,
                                                  label: e.target.value,
                                                }
                                              : item
                                          ),
                                        }
                                      : c
                                  )
                                )
                              }
                              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold text-[#1a2744] focus:border-[#2E7D32] focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-5">
                            <input
                              type="text"
                              value={sub.description}
                              onChange={(e) =>
                                updateLocalNav((prev) =>
                                  prev.map((c) =>
                                    c.id === activeCategory.id
                                      ? {
                                          ...c,
                                          items: c.items.map((item) =>
                                            item.id === sub.id
                                              ? {
                                                  ...item,
                                                  description: e.target.value,
                                                }
                                              : item
                                          ),
                                        }
                                      : c
                                  )
                                )
                              }
                              placeholder="메뉴 설명 문구"
                              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 focus:border-[#2E7D32] focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-3 flex items-center gap-2">
                            <Link
                              href={sub.href}
                              target="_blank"
                              className="text-xs font-semibold text-[#2E7D32] hover:underline truncate"
                            >
                              화면 열기 ↗
                            </Link>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {matchingSummary && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveBoardKey(matchingSummary.boardKey);
                                setSelectedPostIds([]);
                                const el = document.getElementById(
                                  "unified-post-manager-section"
                                );
                                el?.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#E8F5E9] text-[#1B5E20] text-xs font-bold hover:bg-[#2E7D32] hover:text-white transition-colors"
                            >
                              게시물 관리 ({matchingSummary.postCount})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleMoveSubItem(activeCategory.id, sub.id, -1)
                            }
                            className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                            aria-label="위로 이동"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleMoveSubItem(activeCategory.id, sub.id, 1)
                            }
                            className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                            aria-label="아래로 이동"
                          >
                            ▼
                          </button>
                          {customSlug ? (
                            confirmDeleteBoardSlug === customSlug ? (
                              <div className="flex items-center gap-1 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                                <span className="text-[11px] font-bold text-red-700">
                                  게시판 삭제?
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteCustomBoard(customSlug)
                                  }
                                  className="px-2 py-0.5 rounded bg-red-600 text-white text-[11px] font-bold"
                                >
                                  확인
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDeleteBoardSlug(null)
                                  }
                                  className="px-2 py-0.5 rounded bg-white text-gray-600 text-[11px] border border-gray-200"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteBoardSlug(customSlug)
                                }
                                className="px-2.5 py-1 rounded-lg border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50"
                              >
                                게시판 삭제
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleDetachSubItem(activeCategory.id, sub.id)
                              }
                              className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 hover:text-red-600 hover:border-red-200"
                            >
                              메뉴에서 빼기
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      )}

      {/* =========================================================
          SECTION 2: 게시판별 게시물 통합 관리 (이동 · 일괄 삭제 · 작성 · 수정)
      ========================================================= */}
      {sectionMode !== "menus-only" && (
      <section
        id="unified-post-manager-section"
        className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-5 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
              게시물 통합 이동 및 삭제 ({summaries.length}개 게시판)
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              교회 소식, 행사 안내, 교재 자료, 각 부서 소식, 일광학사관 등 모든 게시판의 글을 조회하고 다른 게시판으로 옮기거나 일괄 삭제합니다.
            </p>
          </div>
          {activeSummary && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!activeSummary.isBuiltIn && activeSummary.customBoardSlug && (
                confirmDeleteBoardSlug === activeSummary.customBoardSlug ? (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                    <span className="text-xs font-bold text-red-700">
                      이 게시판을 삭제할까요?
                    </span>
                    <button
                      type="button"
                      disabled={creatingBoard}
                      onClick={() =>
                        activeSummary.customBoardSlug &&
                        handleDeleteCustomBoard(activeSummary.customBoardSlug)
                      }
                      className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700"
                    >
                      삭제 확인
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteBoardSlug(null)}
                      className="px-2 py-1 rounded-lg bg-white text-gray-600 text-xs font-bold border border-gray-200"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDeleteBoardSlug(
                        activeSummary.customBoardSlug ?? null
                      )
                    }
                    className="px-3.5 py-2 rounded-xl border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    현재 게시판 삭제
                  </button>
                )
              )}
              <Link
                href={activeSummary.href}
                target="_blank"
                className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
              >
                현재 게시판 화면 보기 ↗
              </Link>
              <button
                type="button"
                onClick={() => setComposerOpen((prev) => !prev)}
                className="px-4 py-1.5 rounded-full bg-[#2E7D32] text-white text-xs font-bold hover:bg-[#1B5E20] transition-colors whitespace-nowrap shrink-0"
              >
                {composerOpen ? "작성창 접기 ▲" : "+ 이 게시판에 새 글 등록 ▼"}
              </button>
            </div>
          )}
        </div>

        {/* Board Selector Pills */}
        <div className="flex flex-wrap gap-2">
          {summaries.map((board) => {
            const active = activeSummary?.boardKey === board.boardKey;
            return (
              <button
                key={board.boardKey}
                type="button"
                onClick={() => {
                  setActiveBoardKey(board.boardKey);
                  setPostPage(1);
                  setSelectedPostIds([]);
                  setConfirmBulkDelete(false);
                  setEditingPostId(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors flex items-center gap-2 ${
                  active
                    ? "bg-[#1a2744] text-white border-[#1a2744]"
                    : "bg-gray-50 text-gray-700 border-gray-200 hover:border-[#2E7D32]"
                }`}
              >
                <span className="opacity-70 text-[11px]">
                  [{board.parentCategoryLabel}]
                </span>
                <span>{board.title}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {board.postCount}건
                </span>
              </button>
            );
          })}
        </div>

        {/* Optional New Post Composer */}
        {composerOpen && activeSummary && (
          <form
            onSubmit={handleCreateManagedPost}
            className="rounded-2xl bg-[#F8FAF8] border border-[#2E7D32]/30 p-5 space-y-4"
          >
            <h3 className="text-base font-black text-[#1a2744]">
              &ldquo;{activeSummary.title}&rdquo; 새 게시물 작성
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  분류 및 말머리
                </label>
                <input
                  type="text"
                  value={newPostTag}
                  onChange={(e) => setNewPostTag(e.target.value)}
                  placeholder="소식, 공지, 나눔 등"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  게시일
                </label>
                <input
                  type="date"
                  value={newPostDate}
                  onChange={(e) => setNewPostDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-[#1a2744] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPostPinned}
                    onChange={(e) => setNewPostPinned(e.target.checked)}
                    className="rounded border-gray-300 text-[#2E7D32]"
                  />
                  <span>상단 고정 게시물로 등록</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                게시물 제목 *
              </label>
              <input
                type="text"
                required
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="게시물 제목을 입력해 주세요"
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                게시물 본문 *
              </label>
              <textarea
                rows={5}
                required
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="본문 내용을 입력해 주세요."
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700 cursor-pointer hover:bg-gray-50">
                  <span>사진 첨부 (선택)</span>
                  <input
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const uploaded = await onUploadFile(
                        file,
                        "gallery",
                        "게시물 사진 업로드"
                      );
                      if (uploaded) {
                        setNewPostImageUrl(uploaded.url);
                      }
                    }}
                  />
                </label>
                <label className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700 cursor-pointer hover:bg-gray-50">
                  <span>첨부파일 업로드 (선택)</span>
                  <input
                    type="file"
                    accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const uploaded = await onUploadFile(
                        file,
                        "notices",
                        "게시물 첨부파일 업로드"
                      );
                      if (uploaded) {
                        setNewPostAttachUrl(uploaded.url);
                        setNewPostAttachName(uploaded.fileName);
                      }
                    }}
                  />
                </label>
                {newPostImageUrl && (
                  <span className="text-xs text-[#2E7D32] font-semibold">
                    사진 첨부됨
                  </span>
                )}
                {newPostAttachName && (
                  <span className="text-xs text-[#2E7D32] font-semibold">
                    첨부: {newPostAttachName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={busyPostOp}
                  className="px-5 py-2 rounded-xl bg-[#2E7D32] text-white text-xs font-bold hover:bg-[#1B5E20] disabled:opacity-50"
                >
                  {busyPostOp ? "등록 중..." : "게시물 등록하기"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Search + Bulk Move / Bulk Delete Action Bar */}
        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
              <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#1a2744] shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={handleToggleSelectAllFiltered}
                  className="w-4 h-4 rounded border-gray-300 text-[#2E7D32]"
                />
                <span>
                  전체 선택 ({selectedPostIds.length}/{filteredPosts.length}건)
                </span>
              </label>

              <input
                type="search"
                value={postSearch}
                onChange={(e) => {
                  setPostSearch(e.target.value);
                  setPostPage(1);
                }}
                placeholder="제목, 본문 검색..."
                className="w-full sm:flex-1 min-w-0 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm focus:border-[#2E7D32] focus:outline-none"
              />
            </div>

            {/* Bulk Move & Bulk Delete Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="이동할 대상 게시판 선택"
                value={effectiveMoveTarget}
                onChange={(e) => setMoveTargetBoardKey(e.target.value)}
                disabled={otherBoards.length === 0}
                className="w-full sm:w-auto max-w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-700"
              >
                {otherBoards.map((b) => (
                  <option key={b.boardKey} value={b.boardKey}>
                    이동 대상: [{b.parentCategoryLabel}] {b.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={
                  busyPostOp ||
                  selectedPostIds.length === 0 ||
                  !effectiveMoveTarget
                }
                onClick={handleExecuteMovePosts}
                className="px-3.5 py-2 rounded-xl bg-[#1a2744] text-white text-xs font-bold hover:bg-[#2E7D32] transition-colors disabled:opacity-40"
              >
                선택 게시물 이동 ({selectedPostIds.length})
              </button>

              {confirmBulkDelete ? (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-red-700">
                    {selectedPostIds.length}건을 삭제할까요?
                  </span>
                  <button
                    type="button"
                    disabled={busyPostOp}
                    onClick={handleExecuteBulkDelete}
                    className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700"
                  >
                    일괄 삭제 확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBulkDelete(false)}
                    className="px-2 py-1 rounded-lg bg-white text-gray-600 text-xs font-bold border border-gray-200"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busyPostOp || selectedPostIds.length === 0}
                  onClick={() => setConfirmBulkDelete(true)}
                  className="px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-40"
                >
                  선택 일괄 삭제 ({selectedPostIds.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Posts List */}
        {pagedPosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            현재 게시판에 표시할 게시물이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 overflow-hidden">
            {pagedPosts.map((post) => {
              const checked = selectedPostIds.includes(post.id);
              const isEditing = editingPostId === post.id && editPostDraft;

              return (
                <div
                  key={post.id}
                  className={`p-4 transition-colors ${
                    checked ? "bg-[#E8F5E9]/40" : "bg-white hover:bg-gray-50/70"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="flex items-start sm:items-center gap-3 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleSelectOne(post.id)}
                        className="mt-1 sm:mt-0 w-4 h-4 rounded border-gray-300 text-[#2E7D32] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {post.isPinned && (
                            <span className="px-2 py-0.5 rounded bg-[#1a2744] text-white text-[11px] font-bold">
                              상단고정
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px] font-bold">
                            {post.categoryTag}
                          </span>
                          <span className="font-bold text-sm text-[#1a2744] break-keep">
                            {post.title}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {post.content.trim()
                            ? `${post.date} — ${post.content}`
                            : post.date}
                        </p>
                      </div>
                    </label>

                    <div className="flex items-center gap-1.5 shrink-0 pl-7 sm:pl-0">
                      {(activeSummary?.boardKey === "builtin:notices" ||
                        activeSummary?.boardKey.startsWith("custom:")) && (
                        <button
                          type="button"
                          disabled={busyPostOp}
                          onClick={() =>
                            handleUpdatePost(
                              post.id,
                              { isPinned: !post.isPinned },
                              post.isPinned
                                ? "상단 고정이 해제되었습니다."
                                : "게시물이 상단에 고정되었습니다."
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            post.isPinned
                              ? "bg-[#1a2744] text-white border-[#1a2744]"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {post.isPinned ? "고정해제" : "상단고정"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) {
                            setEditingPostId(null);
                            setEditPostDraft(null);
                          } else {
                            setEditingPostId(post.id);
                            setEditPostDraft({
                              categoryTag: post.categoryTag,
                              title: post.title,
                              date: post.date,
                              content: post.content,
                              isPinned: post.isPinned,
                              attachmentUrl: post.attachmentUrl ?? "",
                              attachmentName: post.attachmentName ?? "",
                            });
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-bold text-[#1a2744] hover:bg-gray-50"
                      >
                        {isEditing ? "닫기" : "수정"}
                      </button>
                    </div>
                  </div>

                  {/* Inline Post Editor */}
                  {isEditing && editPostDraft && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3 bg-gray-50/80 p-4 rounded-xl">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editPostDraft.categoryTag}
                          onChange={(e) =>
                            setEditPostDraft({
                              ...editPostDraft,
                              categoryTag: e.target.value,
                            })
                          }
                          placeholder="말머리"
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                        />
                        <input
                          type={
                            /^\d{4}-\d{2}-\d{2}$/.test(editPostDraft.date)
                              ? "date"
                              : "text"
                          }
                          value={editPostDraft.date}
                          onChange={(e) =>
                            setEditPostDraft({
                              ...editPostDraft,
                              date: e.target.value,
                            })
                          }
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                        />
                      </div>
                      <input
                        type="text"
                        value={editPostDraft.title}
                        onChange={(e) =>
                          setEditPostDraft({
                            ...editPostDraft,
                            title: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
                      />
                      <textarea
                        rows={4}
                        value={editPostDraft.content}
                        onChange={(e) =>
                          setEditPostDraft({
                            ...editPostDraft,
                            content: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                            <span className="text-xs text-gray-600">
                              첨부 문서:{" "}
                              <strong className="text-[#1a2744]">
                                {editPostDraft.attachmentName || "없음"}
                              </strong>
                            </span>
                            <div className="flex items-center gap-2">
                              <label className="cursor-pointer px-3 py-1 rounded-lg bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors">
                                파일 교체 및 첨부 (.hwp, .pdf 등)
                                <input
                                  type="file"
                                  accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (!file) return;
                                    const uploaded = await onUploadFile(
                                      file,
                                      "resources",
                                      file.name
                                    );
                                    if (uploaded) {
                                      setEditPostDraft((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              attachmentUrl: uploaded.url,
                                              attachmentName: uploaded.fileName,
                                            }
                                          : prev
                                      );
                                      onToast(
                                        `"${uploaded.fileName}" 파일이 첨부되었습니다. 아래 [수정 저장]을 눌러 반영해 주세요.`
                                      );
                                    }
                                  }}
                                />
                              </label>
                              {editPostDraft.attachmentUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditPostDraft((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            attachmentUrl: "",
                                            attachmentName: "",
                                          }
                                        : prev
                                    )
                                  }
                                    className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-bold"
                                  >
                                    첨부 해제
                                  </button>
                                )}
                              </div>
                            </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPostId(null);
                            setEditPostDraft(null);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-600"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          disabled={busyPostOp}
                          onClick={() =>
                            handleUpdatePost(
                              post.id,
                              editPostDraft,
                              "게시물 수정사항이 저장되었습니다."
                            )
                          }
                          className="px-4 py-1.5 rounded-lg bg-[#2E7D32] text-white text-xs font-bold hover:bg-[#1B5E20]"
                        >
                          수정 저장
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <AdminPaginationBar
          currentPage={safePostPage}
          totalItems={filteredPosts.length}
          pageSize={postPageSize}
          onPageChange={setPostPage}
          onPageSizeChange={setPostPageSize}
          itemUnit="건"
        />
      </section>
      )}
    </div>
  );
}
