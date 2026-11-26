"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ActionFeedbackBubble,
  useActionAnchorTracking,
} from "@/components/ActionFeedbackBubble";
import { AdminBulletinStudio } from "@/components/AdminBulletinStudio";
import { AdminMenusAndBoardsStudio } from "@/components/AdminMenusAndBoardsStudio";
import { AdminPaginationBar } from "@/components/AdminPaginationBar";
import {
  AdminSmartAssistant,
  type AssistantJumpTarget,
} from "@/components/AdminSmartAssistant";
import { StaffPhotoCropModal } from "@/components/StaffPhotoCropModal";
import { uploadAssetClient } from "@/lib/client-upload";
import {
  CANONICAL_RESOURCE_CATEGORIES,
  createClientSafeId,
  extractYoutubeId,
  formatEventBadgesFromIsoDate,
  formatStaffDepartmentsField,
  getKstDateString,
  normalizeResourceCategory,
  normalizeYouthDepartmentLabel,
  parseStaffDepartments,
  resolveEventIsoDate,
  splitRawStaffDepartmentTokens,
} from "@/lib/format-utils";
import {
  inferGalleryTagsFromTitle,
  PRESET_GALLERY_TAGS,
} from "@/lib/gallery-tags";
import { isVideoAssetUrl, readJsonResponseSafe } from "@/lib/media-utils";
import {
  BULLETIN_SERMON_SERVICES,
  normalizeScriptureText,
  normalizeSermonServiceType,
} from "@/lib/sermon-utils";
import type {
  CareerEntry,
  CommunityDepartment,
  CommunityPost,
  EventItem,
  GalleryPhoto,
  HistoryItem,
  InquiryItem,
  LegacyGalleryAlbum,
  LegacyGalleryImage,
  LegacyGalleryStoreData,
  ManagedBoardSummary,
  NoticeItem,
  OfferingAccount,
  ResourceCategory,
  ResourceItem,
  SermonItem,
  SermonServiceCategory,
  SiteContent,
  StaffMember,
  WorshipServiceItem,
  YouthDepartmentConfig,
} from "@/types/site-content";

type AdminTabKey =
  | "bulletin"
  | "sermons"
  | "inquiries"
  | "notices"
  | "events"
  | "gallery"
  | "resources"
  | "community"
  | "greeting"
  | "pastor-bio"
  | "history"
  | "staff"
  | "church-info"
  | "worship"
  | "youth"
  | "offering"
  | "hero-cube"
  | "top-banner"
  | "menus"
  | "posts"
  | "backup";

type AdminGroupKey = "weekly" | "boards" | "about" | "ministry" | "system";

interface AdminCategoryDef {
  readonly key: AdminTabKey;
  readonly label: string;
  readonly countLabel?: string;
  readonly alertBadge?: number;
}

interface AdminGroupDef {
  readonly key: AdminGroupKey;
  readonly title: string;
  readonly items: readonly AdminCategoryDef[];
}

interface AdminStudioProps {
  readonly initialContent: SiteContent;
  readonly initialInquiries: readonly InquiryItem[];
  readonly initialLegacyAlbums?: readonly LegacyGalleryAlbum[];
  readonly initialBoardSummaries?: readonly ManagedBoardSummary[];
  readonly initialBoardKey?: string;
  readonly initialTab?: string;
  readonly initialDept?: string;
  readonly authRequired?: boolean;
}

interface UploadResult {
  readonly url: string;
  readonly fileName: string;
  readonly sizeLabel: string;
}

interface YoutubeMetaResponse {
  readonly youtubeId: string;
  readonly rawTitle: string;
  readonly parsedTitle: string;
  readonly parsedDate: string | null;
  readonly parsedScripture: string | null;
  readonly parsedPreacher?: string | null;
  readonly parsedServiceType?: SermonServiceCategory;
  readonly authorName: string;
  readonly thumbnailUrl: string;
  readonly warning?: string;
  readonly error?: string;
}

function resolveInitialTab(
  rawTab?: string,
  initialBoardKey?: string
): AdminTabKey {
  if (initialBoardKey) return "posts";
  if (rawTab === "news") return "bulletin";
  if (rawTab === "pastor") return "pastor-bio";
  if (rawTab === "ministry") return "worship";
  if (rawTab === "church") return "church-info";

  const allowed: readonly AdminTabKey[] = [
    "bulletin",
    "sermons",
    "inquiries",
    "notices",
    "events",
    "gallery",
    "resources",
    "community",
    "greeting",
    "pastor-bio",
    "history",
    "staff",
    "church-info",
    "worship",
    "youth",
    "offering",
    "hero-cube",
    "top-banner",
    "menus",
    "posts",
    "backup",
  ];
  return allowed.includes(rawTab as AdminTabKey)
    ? (rawTab as AdminTabKey)
    : "bulletin";
}

const LEGACY_ADMIN_PER_PAGE = 10;

const ADMIN_IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.png,.webp,.heic,.heif";
const ADMIN_GALLERY_MEDIA_ACCEPT =
  "image/*,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,.m4v,.webm";

function toggleGalleryTag(
  current: readonly string[],
  tag: string
): string[] {
  return current.includes(tag)
    ? current.filter((t) => t !== tag)
    : [...current, tag];
}

function parseTagsText(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const cleaned = part.replace(/^#+/, "").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

const SERVICE_TYPES: readonly SermonServiceCategory[] =
  BULLETIN_SERMON_SERVICES;

const RESOURCE_CATEGORIES: readonly ResourceCategory[] =
  CANONICAL_RESOURCE_CATEGORIES;

const COMMUNITY_DEPARTMENTS: readonly ("유초등부" | "중고등부" | "청년부")[] = [
  "유초등부",
  "중고등부",
  "청년부",
];

function resolveInitialYouthDeptFilter(
  rawDept?: string
): "전체" | "유초등부" | "중고등부" | "청년부" {
  if (rawDept === "sunday" || rawDept === "유초등부") return "유초등부";
  if (rawDept === "teens" || rawDept === "중고등부") return "중고등부";
  if (rawDept === "young-adults" || rawDept === "청년부") return "청년부";
  return "전체";
}

export function AdminStudio({
  initialContent,
  initialInquiries,
  initialLegacyAlbums = [],
  initialBoardSummaries = [],
  initialBoardKey,
  initialTab,
  initialDept,
  authRequired = false,
}: AdminStudioProps) {
  const router = useRouter();
  useActionAnchorTracking();
  const [activeTab, setActiveTab] = useState<AdminTabKey>(() =>
    resolveInitialTab(initialTab, initialBoardKey)
  );
  const [selectedBoardKeyForStudio, setSelectedBoardKeyForStudio] = useState<
    string | undefined
  >(initialBoardKey);
  const [assistantDrawerOpen, setAssistantDrawerOpen] = useState(
    () => initialTab === "guide"
  );

  function selectAdminTab(nextTab: AdminTabKey, nextBoardKey?: string) {
    setActiveTab(nextTab);
    if (nextTab === "posts" && nextBoardKey) {
      setSelectedBoardKeyForStudio(nextBoardKey);
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      if (nextTab === "posts" && nextBoardKey) {
        url.searchParams.set("board", nextBoardKey);
      } else if (nextTab !== "posts") {
        url.searchParams.delete("board");
      }
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }
  const [draft, setDraft] = useState<SiteContent>(initialContent);
  const [baseline, setBaseline] = useState<SiteContent>(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live two-way operational states
  const [inquiries, setInquiries] =
    useState<readonly InquiryItem[]>(initialInquiries);
  const [inquiryFilter, setInquiryFilter] = useState<
    "전체" | "접수대기" | "연락완료"
  >("전체");
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialInquiries.map((item) => [item.id, item.adminMemo]))
  );

  // Pastor quick-add states
  const [newEduText, setNewEduText] = useState("");
  const [newCareerStatus, setNewCareerStatus] = useState<"현" | "전">("현");
  const [newCareerText, setNewCareerText] = useState("");

  // Sermon quick-add + YouTube auto-fetch states
  const [newSermonUrl, setNewSermonUrl] = useState("");
  const [newSermonService, setNewSermonService] =
    useState<SermonServiceCategory>("주일오전예배");
  const [newSermonTitle, setNewSermonTitle] = useState("");
  const [newSermonScripture, setNewSermonScripture] = useState("");
  const [newSermonPreacher, setNewSermonPreacher] = useState("");
  const [newSermonDate, setNewSermonDate] = useState(() => getKstDateString());
  const [fetchingYt, setFetchingYt] = useState(false);
  const [syncingYtChannel, setSyncingYtChannel] = useState(false);
  const [ytPreviewThumb, setYtPreviewThumb] = useState<string | null>(null);

  // New gallery album quick-create states
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [newAlbumContent, setNewAlbumContent] = useState("");
  const [newAlbumDate, setNewAlbumDate] = useState(() => getKstDateString());
  const [newAlbumTagsText, setNewAlbumTagsText] = useState("예배와 절기");
  const [newAlbumTagsTouched, setNewAlbumTagsTouched] = useState(false);
  const [creatingAlbum, setCreatingAlbum] = useState(false);

  // Admin-only Main 3D Cube direct upload states
  const [newPhotoTitle, setNewPhotoTitle] = useState("");
  const [newPhotoDate, setNewPhotoDate] = useState(() => getKstDateString());

  // Unified album gallery management states
  const [legacyAlbums, setLegacyAlbums] =
    useState<readonly LegacyGalleryAlbum[]>(initialLegacyAlbums);
  const [legacySearch, setLegacySearch] = useState("");
  const [legacyVisibilityFilter, setLegacyVisibilityFilter] = useState<
    "전체" | "공개중" | "숨김"
  >("전체");
  const [legacyPage, setLegacyPage] = useState(1);
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [legacyBusyId, setLegacyBusyId] = useState<string | null>(null);
  const [legacyEditDrafts, setLegacyEditDrafts] = useState<
    Record<
      string,
      {
        readonly title: string;
        readonly content: string;
        readonly date: string;
        readonly tagsText: string;
      }
    >
  >({});

  // Compact pagination, search, and single-row expand states for large archives
  const [inquirySearch, setInquirySearch] = useState("");
  const [inquiryPage, setInquiryPage] = useState(1);
  const [inquiryPageSize, setInquiryPageSize] = useState(10);

  const [sermonSearch, setSermonSearch] = useState("");
  const [sermonServiceFilter, setSermonServiceFilter] = useState<string>("전체");
  const [sermonPage, setSermonPage] = useState(1);
  const [sermonPageSize, setSermonPageSize] = useState(10);
  const [expandedSermonId, setExpandedSermonId] = useState<string | null>(null);

  const [noticeSearch, setNoticeSearch] = useState("");
  const [noticeCategoryFilter, setNoticeCategoryFilter] = useState<
    "전체" | NoticeItem["category"]
  >("전체");
  const [noticePage, setNoticePage] = useState(1);
  const [noticePageSize, setNoticePageSize] = useState(10);
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);

  const [eventSearch, setEventSearch] = useState("");
  const [eventPage, setEventPage] = useState(1);
  const [eventPageSize, setEventPageSize] = useState(10);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceCategoryFilter, setResourceCategoryFilter] = useState<
    "전체" | ResourceCategory
  >("전체");
  const [resourcePage, setResourcePage] = useState(1);
  const [resourcePageSize, setResourcePageSize] = useState(10);
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(
    null
  );

  const [communitySearch, setCommunitySearch] = useState("");
  const [communityDeptFilter, setCommunityDeptFilter] = useState<
    "전체" | "유초등부" | "중고등부" | "청년부"
  >(() => resolveInitialYouthDeptFilter(initialDept));
  const [communityPage, setCommunityPage] = useState(1);
  const [communityPageSize, setCommunityPageSize] = useState(10);
  const [expandedCommunityId, setExpandedCommunityId] = useState<string | null>(
    null
  );

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null
  );

  // Unified Creation Card States Across All Collection Modules
  // 1) Notices (/admin?tab=notices)
  const [newNoticeCategory, setNewNoticeCategory] =
    useState<NoticeItem["category"]>("소식");
  const [newNoticePinned, setNewNoticePinned] = useState(false);
  const [newNoticeDate, setNewNoticeDate] = useState(() => getKstDateString());
  const [newNoticeTitle, setNewNoticeTitle] = useState("");
  const [newNoticeContent, setNewNoticeContent] = useState("");
  const [newNoticeAttachUrl, setNewNoticeAttachUrl] = useState("");
  const [newNoticeAttachName, setNewNoticeAttachName] = useState("");
  const [commYtInputDrafts, setCommYtInputDrafts] = useState<
    Record<string, string>
  >({});

  // 2) Events (/admin?tab=events)
  const [newEventDate, setNewEventDate] = useState(() => getKstDateString());
  const [newEventTime, setNewEventTime] = useState("오전 11:00");
  const [newEventLocation, setNewEventLocation] = useState("일광교회 본당");
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventAttachUrl, setNewEventAttachUrl] = useState("");
  const [newEventAttachName, setNewEventAttachName] = useState("");

  // 3) Study & Admin Resources (/admin?tab=resources)
  const [newResourceCategory, setNewResourceCategory] =
    useState<ResourceCategory>("성경 공부");
  const [newResourceDate, setNewResourceDate] = useState(() =>
    getKstDateString()
  );
  const [newResourceTitle, setNewResourceTitle] = useState("");
  const [newResourceDesc, setNewResourceDesc] = useState("");
  const [newResourceFile, setNewResourceFile] = useState<UploadResult | null>(
    null
  );

  // 4) Youth Department News (/admin?tab=community)
  const [newCommDept, setNewCommDept] = useState<
    "유초등부" | "중고등부" | "청년부"
  >(() => {
    const initialResolved = resolveInitialYouthDeptFilter(initialDept);
    return initialResolved === "전체" ? "청년부" : initialResolved;
  });
  const [newCommDate, setNewCommDate] = useState(() => getKstDateString());
  const [newCommTitle, setNewCommTitle] = useState("");
  const [newCommContent, setNewCommContent] = useState("");
  const [newCommYoutubeUrl, setNewCommYoutubeUrl] = useState("");
  const [newCommImageUrl, setNewCommImageUrl] = useState("");

  // Top Banner Single-Line Box Creation (/admin?tab=top-banner)
  const [newTopBannerText, setNewTopBannerText] = useState("");

  // 5) Worship Schedule (/admin?tab=worship)
  const [newWorshipTitle, setNewWorshipTitle] = useState("");
  const [newWorshipTime, setNewWorshipTime] = useState("");
  const [newWorshipLocation, setNewWorshipLocation] = useState("본당");
  const [newWorshipDesc, setNewWorshipDesc] = useState("");

  // 6) Serving People / Staff (/admin?tab=staff)
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("부교역자");
  const [newStaffDeptsText, setNewStaffDeptsText] = useState("");
  const [newStaffDesc, setNewStaffDesc] = useState("");
  const [newStaffPhotoUrl, setNewStaffPhotoUrl] = useState("");

  // 7) Church History (/admin?tab=history)
  const [newHistoryYear, setNewHistoryYear] = useState(() =>
    getKstDateString().slice(0, 7).replace("-", ". ")
  );
  const [newHistoryTitle, setNewHistoryTitle] = useState("");
  const [newHistoryDesc, setNewHistoryDesc] = useState("");
  const [newHistoryImageUrl, setNewHistoryImageUrl] = useState("");
  const [newHistoryImageCaption, setNewHistoryImageCaption] = useState("");

  // 8) Online Offering Accounts (/admin?tab=offering)
  const [newOfferingPurpose, setNewOfferingPurpose] = useState("");
  const [newOfferingBank, setNewOfferingBank] = useState("");
  const [newOfferingNumber, setNewOfferingNumber] = useState("");
  const [newOfferingHolder, setNewOfferingHolder] = useState("일광교회");

  // Staff ministry tag editor, reorder & ID-photo crop studio state (/admin?tab=staff)
  const [openDeptInputStaffId, setOpenDeptInputStaffId] = useState<
    string | null
  >(null);
  const [staffDeptDrafts, setStaffDeptDrafts] = useState<
    Readonly<Record<string, string>>
  >({});
  const [armedDragStaffId, setArmedDragStaffId] = useState<string | null>(null);
  const [draggingStaffId, setDraggingStaffId] = useState<string | null>(null);
  const [dragOverStaffId, setDragOverStaffId] = useState<string | null>(null);
  const [draggingStaffTag, setDraggingStaffTag] = useState<{
    readonly staffId: string;
    readonly tag: string;
  } | null>(null);
  const [dragOverStaffTag, setDragOverStaffTag] = useState<{
    readonly staffId: string;
    readonly tag: string;
  } | null>(null);
  const [staffCropSession, setStaffCropSession] = useState<{
    readonly sessionKey: string;
    readonly staffId: string;
    readonly staffName: string;
    readonly imageSrc: string;
    readonly sourceFileName: string;
    readonly revokeOnClose: boolean;
  } | null>(null);

  function closeStaffCropSession() {
    setStaffCropSession((prev) => {
      if (prev?.revokeOnClose) {
        URL.revokeObjectURL(prev.imageSrc);
      }
      return null;
    });
  }

  function moveStaffMember(fromIndex: number, toIndex: number) {
    updateDraft((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.staff.length ||
        toIndex < 0 ||
        toIndex >= prev.staff.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const nextList = [...prev.staff];
      const [moved] = nextList.splice(fromIndex, 1);
      nextList.splice(toIndex, 0, moved);
      return {
        ...prev,
        staff: nextList,
      };
    });
  }

  function reorderStaffById(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    updateDraft((prev) => {
      const fromIndex = prev.staff.findIndex((p) => p.id === sourceId);
      const toIndex = prev.staff.findIndex((p) => p.id === targetId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return prev;
      }
      const nextList = [...prev.staff];
      const [moved] = nextList.splice(fromIndex, 1);
      nextList.splice(toIndex, 0, moved);
      return {
        ...prev,
        staff: nextList,
      };
    });
  }

  const pendingInquiriesCount = inquiries.filter(
    (item) => item.status === "접수대기"
  ).length;
  const heroCubeCount = draft.gallery.filter((p) => p.showInHeroCube).length;

  function updateDraft(updater: (prev: SiteContent) => SiteContent) {
    setDraft(updater);
    setIsDirty(true);
  }

  function applyStaffDepartmentTags(
    sourceState: SiteContent,
    staffId: string,
    nextTags: readonly string[]
  ): SiteContent {
    const deduped = Array.from(
      new Set(
        nextTags
          .map((tag) =>
            tag.replace(/^[·ㆍ・,/|\s]+|[·ㆍ・,/|\s]+$/gu, "").trim()
          )
          .filter(Boolean)
      )
    );
    return {
      ...sourceState,
      staff: sourceState.staff.map((p) =>
        p.id === staffId
          ? {
              ...p,
              departments: deduped,
              department: formatStaffDepartmentsField(deduped),
            }
          : p
      ),
    };
  }

  function commitStaffDepartmentTag(staffId: string) {
    const raw = (staffDeptDrafts[staffId] ?? "").trim();
    if (!raw) return;
    const incomingTokens = splitRawStaffDepartmentTokens(raw);
    if (incomingTokens.length === 0) {
      setStaffDeptDrafts((prev) => ({ ...prev, [staffId]: "" }));
      return;
    }
    updateDraft((prev) => {
      const target = prev.staff.find((p) => p.id === staffId);
      if (!target) return prev;
      const existing = parseStaffDepartments(target);
      return applyStaffDepartmentTags(prev, staffId, [
        ...existing,
        ...incomingTokens,
      ]);
    });
    setStaffDeptDrafts((prev) => ({ ...prev, [staffId]: "" }));
  }

  function removeStaffDepartmentTag(staffId: string, tagToRemove: string) {
    updateDraft((prev) => {
      const target = prev.staff.find((p) => p.id === staffId);
      if (!target) return prev;
      const existing = parseStaffDepartments(target);
      return applyStaffDepartmentTags(
        prev,
        staffId,
        existing.filter((tag) => tag !== tagToRemove)
      );
    });
  }

  function reorderStaffDepartmentTag(
    staffId: string,
    sourceTag: string,
    targetTag: string
  ) {
    if (!staffId || !sourceTag || !targetTag || sourceTag === targetTag) {
      return;
    }
    updateDraft((prev) => {
      const targetPerson = prev.staff.find((p) => p.id === staffId);
      if (!targetPerson) return prev;
      const currentTags = parseStaffDepartments(targetPerson);
      const fromIndex = currentTags.indexOf(sourceTag);
      const toIndex = currentTags.indexOf(targetTag);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return prev;
      }
      const reordered = [...currentTags];
      const [movedTag] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, movedTag);
      return applyStaffDepartmentTags(prev, staffId, reordered);
    });
  }

  function moveStaffDepartmentTagToEnd(staffId: string, sourceTag: string) {
    if (!staffId || !sourceTag) return;
    updateDraft((prev) => {
      const targetPerson = prev.staff.find((p) => p.id === staffId);
      if (!targetPerson) return prev;
      const currentTags = parseStaffDepartments(targetPerson);
      const fromIndex = currentTags.indexOf(sourceTag);
      if (fromIndex === -1 || fromIndex === currentTags.length - 1) {
        return prev;
      }
      const reordered = [
        ...currentTags.filter((t) => t !== sourceTag),
        sourceTag,
      ];
      return applyStaffDepartmentTags(prev, staffId, reordered);
    });
  }

  function flushPendingStaffDeptDrafts(baseState: SiteContent): SiteContent {
    let updated = baseState;
    let flushedAny = false;
    for (const [staffId, rawText] of Object.entries(staffDeptDrafts)) {
      const incoming = splitRawStaffDepartmentTokens(rawText);
      if (incoming.length === 0) continue;
      const target = updated.staff.find((p) => p.id === staffId);
      if (!target) continue;
      const existing = parseStaffDepartments(target);
      updated = applyStaffDepartmentTags(updated, staffId, [
        ...existing,
        ...incoming,
      ]);
      flushedAny = true;
    }
    if (flushedAny) {
      setStaffDeptDrafts({});
      setOpenDeptInputStaffId(null);
    }
    return updated;
  }

  async function uploadAsset(
    file: File,
    bucket: "bulletins" | "resources" | "gallery" | "profiles" | "notices",
    label: string
  ): Promise<UploadResult | null> {
    setUploadingLabel(label);
    setErrorMessage(null);
    try {
      return await uploadAssetClient(file, bucket);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "파일 업로드 중 오류가 발생했습니다."
      );
      return null;
    } finally {
      setUploadingLabel(null);
    }
  }

  async function handleSave(nextState: SiteContent = draft, customToast?: string) {
    setSaving(true);
    setErrorMessage(null);
    setToastMessage(null);
    try {
      const stateWithFlushedTags =
        nextState === draft ? flushPendingStaffDeptDrafts(nextState) : nextState;
      let payloadToSave: SiteContent = stateWithFlushedTags;
      const latestRes = await fetch("/api/site-content", { cache: "no-store" });
      if (latestRes.ok) {
        const latestServer = await readJsonResponseSafe<SiteContent>(
          latestRes,
          "최신 데이터를 확인하지 못했습니다."
        );
        const mutableMerged: Record<string, unknown> = { ...latestServer };
        const compareKeys = [
          "navigation",
          "topBannerNotices",
          "churchInfo",
          "pastorProfile",
          "history",
          "staff",
          "worshipSchedule",
          "youthDepartments",
          "sermons",
          "notices",
          "bulletins",
          "events",
          "offeringAccounts",
          "gallery",
          "resources",
          "communityPosts",
        ] as const satisfies readonly (keyof SiteContent)[];
        for (const k of compareKeys) {
          if (
            JSON.stringify(stateWithFlushedTags[k]) !==
            JSON.stringify(baseline[k])
          ) {
            mutableMerged[k] = stateWithFlushedTags[k];
          }
        }
        payloadToSave = mutableMerged as unknown as SiteContent;
      }

      const response = await fetch("/api/site-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadToSave),
      });
      const saved = await readJsonResponseSafe<
        SiteContent & { readonly error?: string }
      >(response, "저장에 실패했습니다.");
      if (!response.ok || saved.error) {
        throw new Error(saved.error ?? "저장에 실패했습니다.");
      }
      setDraft(saved);
      setBaseline(saved);
      setIsDirty(false);
      setToastMessage(
        customToast ?? "변경하신 내용이 홈페이지에 반영되었습니다."
      );
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "저장 중 오류가 발생했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  // Inquiry Handlers (Live immediate persistence)
  async function refreshInquiries() {
    try {
      const response = await fetch("/api/inquiries");
      if (response.ok) {
        const data = await readJsonResponseSafe<{
          readonly inquiries: readonly InquiryItem[];
        }>(response, "문의 목록을 불러오지 못했습니다.");
        if (Array.isArray(data.inquiries)) {
          setInquiries(data.inquiries);
          setMemoDrafts(
            Object.fromEntries(data.inquiries.map((i) => [i.id, i.adminMemo]))
          );
        }
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "문의 목록 조회에 실패했습니다."
      );
    }
  }

  async function patchInquiryItem(
    id: string,
    patch: { readonly status?: "접수대기" | "연락완료"; readonly adminMemo?: string }
  ) {
    setErrorMessage(null);
    try {
      const response = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await readJsonResponseSafe<{
        readonly inquiries?: readonly InquiryItem[];
        readonly error?: string;
      }>(response, "문의 상태 변경에 실패했습니다.");
      if (!response.ok || !data.inquiries) {
        setErrorMessage(data.error ?? "문의 상태 변경에 실패했습니다.");
        return;
      }
      setInquiries(data.inquiries);
      setToastMessage("문의 처리 상태가 저장되었습니다.");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "문의 상태 저장 중 오류가 발생했습니다."
      );
    }
  }

  async function removeInquiryItem(id: string) {
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/inquiries?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );
      const data = await readJsonResponseSafe<{
        readonly inquiries?: readonly InquiryItem[];
        readonly error?: string;
      }>(response, "문의 삭제에 실패했습니다.");
      if (!response.ok || !data.inquiries) {
        setErrorMessage(data.error ?? "문의 삭제에 실패했습니다.");
        return;
      }
      setInquiries(data.inquiries);
      setToastMessage("문의 내역이 삭제되었습니다.");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "문의 삭제 중 오류가 발생했습니다."
      );
    }
  }

  // Unified Album Gallery Handlers (Live immediate persistence via /api/legacy-gallery)
  async function refreshLegacyAlbums() {
    setErrorMessage(null);
    try {
      const response = await fetch("/api/legacy-gallery");
      const data = await readJsonResponseSafe<
        LegacyGalleryStoreData & { readonly error?: string }
      >(response, "앨범 목록을 불러오지 못했습니다.");
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "앨범 목록을 불러오지 못했습니다.");
      }
      setLegacyAlbums(data.albums);
      setToastMessage(
        `앨범 목록을 새로고침했습니다 (${data.albums.length}개 앨범).`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "앨범 목록 조회 중 오류가 발생했습니다."
      );
    }
  }

  async function handleCreateGalleryAlbum(files: FileList) {
    if (files.length === 0) return;
    if (!newAlbumTitle.trim()) {
      setErrorMessage("먼저 앨범 제목을 입력한 뒤 사진이나 동영상을 선택해 주세요.");
      return;
    }
    setCreatingAlbum(true);
    setErrorMessage(null);
    setToastMessage(null);
    try {
      const uploadedPhotos: { readonly imageUrl: string; readonly caption: string }[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i]!;
        const uploaded = await uploadAsset(
          file,
          "gallery",
          `${file.name} (${i + 1}/${files.length})`
        );
        if (!uploaded) {
          throw new Error(`"${file.name}" 업로드에 실패했습니다.`);
        }
        uploadedPhotos.push({
          imageUrl: uploaded.url,
          caption: `${newAlbumTitle.trim()} (${i + 1})`,
        });
      }

      const parsedTags = parseTagsText(newAlbumTagsText);
      const effectiveTags =
        parsedTags.length > 0
          ? parsedTags
          : inferGalleryTagsFromTitle(newAlbumTitle.trim());

      const response = await fetch("/api/legacy-gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newAlbumTitle.trim(),
          content: newAlbumContent.trim(),
          date: newAlbumDate,
          tags: effectiveTags,
          photos: uploadedPhotos,
        }),
      });
      const data = await readJsonResponseSafe<
        LegacyGalleryStoreData & { readonly error?: string }
      >(response, "새 앨범 생성에 실패했습니다.");
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "새 앨범 생성에 실패했습니다.");
      }
      setLegacyAlbums(data.albums);
      setNewAlbumTitle("");
      setNewAlbumContent("");
      setNewAlbumTagsText("예배와 절기");
      setNewAlbumTagsTouched(false);
      setLegacyPage(1);
      setToastMessage(
        `"${newAlbumTitle.trim()}" 앨범(${uploadedPhotos.length}개 항목)이 등록되었습니다.`
      );
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "새 앨범 등록 중 오류가 발생했습니다."
      );
    } finally {
      setCreatingAlbum(false);
    }
  }

  async function handleAppendPhotosToAlbum(
    album: LegacyGalleryAlbum,
    files: FileList
  ) {
    if (files.length === 0) return;
    setLegacyBusyId(album.id);
    setErrorMessage(null);
    setToastMessage(null);
    try {
      const uploadedPhotos: { readonly imageUrl: string; readonly caption: string }[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i]!;
        const uploaded = await uploadAsset(
          file,
          "gallery",
          `${file.name} (${i + 1}/${files.length})`
        );
        if (!uploaded) {
          throw new Error(`"${file.name}" 업로드에 실패했습니다.`);
        }
        uploadedPhotos.push({
          imageUrl: uploaded.url,
          caption: `${album.title} (${album.photos.length + i + 1})`,
        });
      }

      const response = await fetch("/api/legacy-gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId: album.id,
          action: "add-photos",
          photos: uploadedPhotos,
        }),
      });
      const data = await readJsonResponseSafe<
        LegacyGalleryStoreData & { readonly error?: string }
      >(response, "앨범 항목 추가에 실패했습니다.");
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "앨범 항목 추가에 실패했습니다.");
      }
      setLegacyAlbums(data.albums);
      setToastMessage(
        `"${album.title}" 앨범에 ${uploadedPhotos.length}개 항목이 추가되었습니다.`
      );
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "앨범 항목 추가 중 오류가 발생했습니다."
      );
    } finally {
      setLegacyBusyId(null);
    }
  }

  async function patchLegacyAlbumItem(
    albumId: string,
    patch: {
      readonly title?: string;
      readonly content?: string;
      readonly date?: string;
      readonly tags?: readonly string[];
      readonly isVisible?: boolean;
      readonly coverImageUrl?: string;
    },
    successToast: string
  ) {
    setLegacyBusyId(albumId);
    setErrorMessage(null);
    setToastMessage(null);
    try {
      const response = await fetch("/api/legacy-gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId, ...patch }),
      });
      const data = await readJsonResponseSafe<
        LegacyGalleryStoreData & { readonly error?: string }
      >(response, "앨범 수정에 실패했습니다.");
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "앨범 수정에 실패했습니다.");
      }
      setLegacyAlbums(data.albums);
      setLegacyEditDrafts((prev) => {
        if (!(albumId in prev)) return prev;
        const next = { ...prev };
        delete next[albumId];
        return next;
      });
      setToastMessage(successToast);
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "앨범 저장 중 오류가 발생했습니다."
      );
    } finally {
      setLegacyBusyId(null);
    }
  }

  async function deleteEntireLegacyAlbum(albumId: string, albumTitle: string) {
    setLegacyBusyId(albumId);
    setErrorMessage(null);
    setToastMessage(null);
    try {
      const response = await fetch("/api/legacy-gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId, action: "delete-album" }),
      });
      const data = await readJsonResponseSafe<
        LegacyGalleryStoreData & { readonly error?: string }
      >(response, "앨범 삭제에 실패했습니다.");
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "앨범 삭제에 실패했습니다.");
      }
      setLegacyAlbums(data.albums);
      setToastMessage(`"${albumTitle}" 앨범을 삭제했습니다.`);
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "앨범 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setLegacyBusyId(null);
    }
  }

  async function removeLegacyPhotoItem(albumId: string, photoId: string) {
    setLegacyBusyId(albumId);
    setErrorMessage(null);
    setToastMessage(null);
    try {
      const response = await fetch("/api/legacy-gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId,
          action: "delete-photo",
          photoId,
        }),
      });
      const data = await readJsonResponseSafe<
        LegacyGalleryStoreData & { readonly error?: string }
      >(response, "항목 삭제에 실패했습니다.");
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "항목 삭제에 실패했습니다.");
      }
      setLegacyAlbums(data.albums);
      setToastMessage("선택한 항목이 앨범에서 제외되었습니다.");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "항목 제외 중 오류가 발생했습니다."
      );
    } finally {
      setLegacyBusyId(null);
    }
  }

  function handleAddLegacyPhotoToCube(
    album: LegacyGalleryAlbum,
    photo: LegacyGalleryImage
  ) {
    if (isVideoAssetUrl(photo.imageUrl)) {
      setErrorMessage("메인 3D 큐브에는 동영상 대신 정지 사진만 등록할 수 있습니다.");
      return;
    }
    const existing = draft.gallery.find((item) => item.imageUrl === photo.imageUrl);
    if (existing) {
      if (!existing.showInHeroCube) {
        updateDraft((prev) => ({
          ...prev,
          gallery: prev.gallery.map((item) =>
            item.imageUrl === photo.imageUrl
              ? { ...item, showInHeroCube: true }
              : item
          ),
        }));
      }
      setToastMessage(
        "메인 3D 큐브 노출을 켰습니다. 상단 [변경사항 저장하기]를 눌러 반영해 주세요."
      );
      return;
    }

    const promoted: GalleryPhoto = {
      id: createClientSafeId("gal-cube"),
      title: photo.caption.trim() || album.title,
      date: album.date,
      imageUrl: photo.imageUrl,
      showInHeroCube: true,
    };

    updateDraft((prev) => ({
      ...prev,
      gallery: [promoted, ...prev.gallery],
    }));
    setToastMessage(
      `사진("${promoted.title}")이 3D 큐브 목록에 추가되었습니다. 상단 [변경사항 저장하기]를 눌러 반영해 주세요.`
    );
  }

  // YouTube oEmbed Auto-Fetch Handler
  async function handleFetchYoutubeMeta() {
    if (!newSermonUrl.trim()) {
      setErrorMessage("먼저 유튜브 영상 주소를 입력해 주세요.");
      return;
    }
    setFetchingYt(true);
    setErrorMessage(null);
    setToastMessage(null);
    try {
      const response = await fetch(
        `/api/youtube-meta?url=${encodeURIComponent(newSermonUrl.trim())}`
      );
      const meta = await readJsonResponseSafe<YoutubeMetaResponse>(
        response,
        "유튜브 정보를 불러오지 못했습니다."
      );
      if (!response.ok || meta.error) {
        throw new Error(meta.error ?? "유튜브 정보를 불러오지 못했습니다.");
      }
      if (meta.parsedTitle) setNewSermonTitle(meta.parsedTitle);
      setNewSermonScripture(meta.parsedScripture ?? "");
      setNewSermonPreacher(meta.parsedPreacher ?? "");
      if (meta.parsedServiceType) {
        setNewSermonService(meta.parsedServiceType);
      }
      if (meta.parsedDate) setNewSermonDate(meta.parsedDate);
      setYtPreviewThumb(meta.thumbnailUrl);
      if (meta.warning) {
        setToastMessage(meta.warning);
      } else {
        setToastMessage(`유튜브 영상 정보를 불러왔습니다: "${meta.rawTitle}"`);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "유튜브 정보 조회 중 오류가 발생했습니다."
      );
    } finally {
      setFetchingYt(false);
    }
  }

  async function handleSyncYoutubeChannel() {
    setSyncingYtChannel(true);
    setErrorMessage(null);
    setToastMessage(null);
    try {
      const response = await fetch("/api/youtube-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingYoutubeIds: draft.sermons.map((s) => s.youtubeId),
        }),
      });
      const payload = await readJsonResponseSafe<{
        readonly newSermons?: readonly SermonItem[];
        readonly error?: string;
      }>(response, "유튜브 채널 동기화에 실패했습니다.");
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "유튜브 채널 동기화에 실패했습니다.");
      }
      const incoming = payload.newSermons ?? [];
      if (incoming.length === 0) {
        setToastMessage("이미 유튜브 채널의 최신 설교 영상이 모두 반영되어 있습니다.");
        return;
      }
      const merged = [...incoming, ...draft.sermons].sort((a, b) =>
        b.date.localeCompare(a.date)
      );
      await handleSave(
        { ...draft, sermons: merged },
        `유튜브 채널에서 새 설교 영상 ${incoming.length}편을 불러와 등록했습니다.`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "유튜브 채널 동기화 중 오류가 발생했습니다."
      );
    } finally {
      setSyncingYtChannel(false);
    }
  }

  async function handleAddAndPublishSermon() {
    const videoId = extractYoutubeId(newSermonUrl);
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      setErrorMessage("유효한 유튜브 영상 주소(URL) 또는 11자리 영상 ID를 입력해 주세요.");
      return;
    }
    if (!newSermonTitle.trim()) {
      setErrorMessage("설교 제목을 입력하거나 [유튜브 정보 자동 불러오기]를 눌러 주세요.");
      return;
    }
    const item: SermonItem = {
      id: createClientSafeId("sermon"),
      title: newSermonTitle.trim(),
      scripture: normalizeScriptureText(newSermonScripture),
      preacher: newSermonPreacher.trim(),
      date: newSermonDate,
      serviceType: newSermonService,
      youtubeId: videoId,
    };
    const nextSermons = [
      item,
      ...draft.sermons.filter((s) => s.youtubeId !== videoId),
    ].sort((a, b) => b.date.localeCompare(a.date));
    const nextContent: SiteContent = {
      ...draft,
      sermons: nextSermons,
    };
    setNewSermonUrl("");
    setNewSermonTitle("");
    setNewSermonScripture("");
    setNewSermonPreacher("");
    setYtPreviewThumb(null);
    await handleSave(nextContent, "새 설교 영상이 등록되었습니다.");
  }

  // Unified Collection Creation Handlers (Validate -> Reset -> Save Immediately)
  async function handleCreateNotice() {
    if (!newNoticeTitle.trim()) {
      setErrorMessage("교회 소식 제목을 입력해 주세요.");
      return;
    }
    if (!newNoticeContent.trim()) {
      setErrorMessage("교회 소식 본문 내용을 입력해 주세요.");
      return;
    }
    const created: NoticeItem = {
      id: createClientSafeId("notice"),
      category: newNoticeCategory,
      title: newNoticeTitle.trim(),
      date: newNoticeDate || getKstDateString(),
      author: "일광교회",
      isPinned: newNoticePinned,
      content: newNoticeContent.trim(),
      attachmentUrl: newNoticeAttachUrl || undefined,
      attachmentName: newNoticeAttachName || undefined,
    };
    const nextContent: SiteContent = {
      ...draft,
      notices: [created, ...draft.notices],
    };
    setNewNoticeTitle("");
    setNewNoticeContent("");
    setNewNoticePinned(false);
    setNewNoticeAttachUrl("");
    setNewNoticeAttachName("");
    setNoticePage(1);
    await handleSave(
      nextContent,
      `"${created.title}" 교회 소식이 등록되었습니다.`
    );
  }

  async function handleCreateEvent() {
    if (!newEventTitle.trim()) {
      setErrorMessage("행사 제목을 입력해 주세요.");
      return;
    }
    const safeDate = newEventDate || getKstDateString();
    const badges = formatEventBadgesFromIsoDate(safeDate);
    const created: EventItem = {
      id: createClientSafeId("ev"),
      date: safeDate,
      dayBadge: badges.dayBadge,
      monthYearBadge: badges.monthYearBadge,
      title: newEventTitle.trim(),
      timeText: newEventTime.trim() || "오전 11:00",
      location: newEventLocation.trim() || "일광교회 본당",
      description: newEventDescription.trim(),
      attachmentUrl: newEventAttachUrl || undefined,
      attachmentName: newEventAttachName || undefined,
    };
    const nextContent: SiteContent = {
      ...draft,
      events: [created, ...draft.events],
    };
    setNewEventTitle("");
    setNewEventDescription("");
    setNewEventAttachUrl("");
    setNewEventAttachName("");
    setEventPage(1);
    await handleSave(nextContent, `"${created.title}" 행사가 등록되었습니다.`);
  }

  async function handleCreateResource() {
    if (!newResourceFile) {
      setErrorMessage("먼저 등록할 교재 자료 파일을 선택해 주세요.");
      return;
    }
    const resolvedTitle =
      newResourceTitle.trim() ||
      newResourceFile.fileName.replace(/\.[^.]+$/, "");
    const created: ResourceItem = {
      id: createClientSafeId("res"),
      category: newResourceCategory,
      title: resolvedTitle,
      description: newResourceDesc.trim(),
      date: newResourceDate || getKstDateString(),
      author: "일광교회",
      fileUrl: newResourceFile.url,
      fileName: newResourceFile.fileName,
      fileSizeLabel: newResourceFile.sizeLabel,
    };
    const nextContent: SiteContent = {
      ...draft,
      resources: [created, ...draft.resources],
    };
    setNewResourceTitle("");
    setNewResourceDesc("");
    setNewResourceFile(null);
    setResourcePage(1);
    await handleSave(
      nextContent,
      `"${created.title}" 교재 자료가 등록되었습니다.`
    );
  }

  async function handleCreateCommunityPost() {
    if (!newCommTitle.trim()) {
      setErrorMessage("부서 소식 제목을 입력해 주세요.");
      return;
    }
    const rawYt = newCommYoutubeUrl.trim();
    const parsedYt = rawYt ? extractYoutubeId(rawYt) : "";
    if (rawYt && !parsedYt) {
      setErrorMessage(
        "올바른 유튜브 영상 주소를 입력해 주세요. (예: https://youtu.be/... 또는 https://www.youtube.com/watch?v=...)"
      );
      return;
    }
    const resolvedImage =
      newCommImageUrl ||
      (parsedYt
        ? `https://i.ytimg.com/vi/${parsedYt}/hqdefault.jpg`
        : "/c01/cube-2.png");
    const created: CommunityPost = {
      id: createClientSafeId("comm"),
      department: newCommDept,
      title: newCommTitle.trim(),
      content: newCommContent.trim(),
      author: "일광교회",
      date: newCommDate || getKstDateString(),
      imageUrl: resolvedImage,
      youtubeId: parsedYt || undefined,
    };
    const nextContent: SiteContent = {
      ...draft,
      communityPosts: [created, ...draft.communityPosts],
    };
    setNewCommTitle("");
    setNewCommContent("");
    setNewCommYoutubeUrl("");
    setNewCommImageUrl("");
    setCommunityPage(1);
    await handleSave(
      nextContent,
      `"${created.title}" ${newCommDept} 소식이 등록되었습니다.`
    );
  }

  async function handleCreateTopBannerNotice() {
    const trimmed = newTopBannerText.trim();
    if (!trimmed) {
      setErrorMessage("추가할 한 줄 알림 문구를 입력해 주세요.");
      return;
    }
    const nextContent: SiteContent = {
      ...draft,
      topBannerNotices: [...draft.topBannerNotices, trimmed],
    };
    setNewTopBannerText("");
    await handleSave(nextContent, "새 한 줄 알림 문구가 등록되었습니다.");
  }

  async function handleCreateWorshipItem() {
    if (!newWorshipTitle.trim() || !newWorshipTime.trim()) {
      setErrorMessage("예배 명칭과 예배 시간을 입력해 주세요.");
      return;
    }
    const created: WorshipServiceItem = {
      id: createClientSafeId("w"),
      title: newWorshipTitle.trim(),
      time: newWorshipTime.trim(),
      location: newWorshipLocation.trim() || "본당",
      description: newWorshipDesc.trim(),
    };
    const nextContent: SiteContent = {
      ...draft,
      worshipSchedule: [...draft.worshipSchedule, created],
    };
    setNewWorshipTitle("");
    setNewWorshipTime("");
    setNewWorshipDesc("");
    await handleSave(
      nextContent,
      `"${created.title}" 예배 안내가 등록되었습니다.`
    );
  }

  async function handleCreateStaffMember() {
    if (!newStaffName.trim()) {
      setErrorMessage("성함 및 직함을 입력해 주세요.");
      return;
    }
    const depts = splitRawStaffDepartmentTokens(newStaffDeptsText);
    const created: StaffMember = {
      id: createClientSafeId("staff"),
      name: newStaffName.trim(),
      role: newStaffRole.trim() || "부교역자",
      department: formatStaffDepartmentsField(depts),
      departments: depts,
      description: newStaffDesc.trim(),
      photoUrl: newStaffPhotoUrl || undefined,
    };
    const nextContent: SiteContent = {
      ...draft,
      staff: [...draft.staff, created],
    };
    setNewStaffName("");
    setNewStaffRole("부교역자");
    setNewStaffDeptsText("");
    setNewStaffDesc("");
    setNewStaffPhotoUrl("");
    await handleSave(
      nextContent,
      `"${created.name}" 섬기는 분 정보가 등록되었습니다.`
    );
  }

  async function handleCreateHistoryItem() {
    if (!newHistoryYear.trim() || !newHistoryTitle.trim()) {
      setErrorMessage("연도와 연혁 제목을 모두 입력해 주세요.");
      return;
    }
    const created: HistoryItem = {
      id: createClientSafeId("hist"),
      year: newHistoryYear.trim(),
      title: newHistoryTitle.trim(),
      description: newHistoryDesc.trim(),
      imageUrl: newHistoryImageUrl || undefined,
      imageCaption: newHistoryImageUrl
        ? newHistoryImageCaption.trim() ||
          `${newHistoryYear.trim()} ${newHistoryTitle.trim()}`
        : undefined,
    };
    const nextContent: SiteContent = {
      ...draft,
      history: [...draft.history, created],
    };
    setNewHistoryTitle("");
    setNewHistoryDesc("");
    setNewHistoryImageUrl("");
    setNewHistoryImageCaption("");
    await handleSave(
      nextContent,
      `"${created.year} ${created.title}" 연혁이 등록되었습니다.`
    );
  }

  async function handleCreateOfferingAccount() {
    if (
      !newOfferingPurpose.trim() ||
      !newOfferingBank.trim() ||
      !newOfferingNumber.trim()
    ) {
      setErrorMessage("헌금 구분, 은행명, 계좌번호를 모두 입력해 주세요.");
      return;
    }
    const created: OfferingAccount = {
      id: createClientSafeId("acc"),
      purpose: newOfferingPurpose.trim(),
      bankName: newOfferingBank.trim(),
      accountNumber: newOfferingNumber.trim(),
      holder: newOfferingHolder.trim() || "일광교회",
    };
    const nextContent: SiteContent = {
      ...draft,
      offeringAccounts: [...draft.offeringAccounts, created],
    };
    setNewOfferingPurpose("");
    setNewOfferingBank("");
    setNewOfferingNumber("");
    await handleSave(
      nextContent,
      `"${created.purpose}" 헌금 계좌가 등록되었습니다.`
    );
  }

  // Backup JSON Download & Restore
  function handleDownloadBackupJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ilkwang-site-backup-${getKstDateString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToastMessage("홈페이지 백업 파일이 다운로드되었습니다.");
  }

  async function handleImportBackupJson(file: File) {
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Partial<SiteContent>;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        !parsed.churchInfo ||
        !parsed.pastorProfile
      ) {
        throw new Error("유효한 일광교회 백업 파일이 아닙니다.");
      }
      const arrayKeys = [
        "navigation",
        "topBannerNotices",
        "history",
        "staff",
        "worshipSchedule",
        "youthDepartments",
        "sermons",
        "notices",
        "bulletins",
        "events",
        "offeringAccounts",
        "gallery",
        "resources",
        "communityPosts",
      ] as const satisfies readonly (keyof SiteContent)[];
      for (const key of arrayKeys) {
        if (parsed[key] !== undefined && !Array.isArray(parsed[key])) {
          throw new Error(`백업 파일 형식 오류: '${key}' 항목이 배열이 아닙니다.`);
        }
      }
      await handleSave(
        parsed as SiteContent,
        "백업 파일에서 홈페이지 데이터를 복원했습니다."
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "백업 파일 복원에 실패했습니다."
      );
    }
  }

  const normalizedInquiryQ = inquirySearch.trim().toLowerCase();
  const filteredInquiries = inquiries.filter((item) => {
    if (inquiryFilter !== "전체" && item.status !== inquiryFilter) return false;
    if (!normalizedInquiryQ) return true;
    return (
      item.name.toLowerCase().includes(normalizedInquiryQ) ||
      item.contact.toLowerCase().includes(normalizedInquiryQ) ||
      item.title.toLowerCase().includes(normalizedInquiryQ) ||
      item.message.toLowerCase().includes(normalizedInquiryQ) ||
      item.category.toLowerCase().includes(normalizedInquiryQ)
    );
  });
  const safeInquiryPage = Math.min(
    inquiryPage,
    Math.max(1, Math.ceil(filteredInquiries.length / inquiryPageSize))
  );
  const pagedInquiries = filteredInquiries.slice(
    (safeInquiryPage - 1) * inquiryPageSize,
    safeInquiryPage * inquiryPageSize
  );

  const normalizedSermonQ = sermonSearch.trim().toLowerCase();
  const filteredSermons = draft.sermons.filter((s) => {
    const normSvc = normalizeSermonServiceType(s.serviceType);
    if (sermonServiceFilter === "설교자 미기재") {
      if (s.preacher.trim()) return false;
    } else if (
      sermonServiceFilter !== "전체" &&
      normSvc !== sermonServiceFilter
    ) {
      return false;
    }
    if (!normalizedSermonQ) return true;
    return (
      s.title.toLowerCase().includes(normalizedSermonQ) ||
      s.scripture.toLowerCase().includes(normalizedSermonQ) ||
      s.preacher.toLowerCase().includes(normalizedSermonQ) ||
      s.date.toLowerCase().includes(normalizedSermonQ)
    );
  });
  const safeSermonPage = Math.min(
    sermonPage,
    Math.max(1, Math.ceil(filteredSermons.length / sermonPageSize))
  );
  const pagedSermons = filteredSermons.slice(
    (safeSermonPage - 1) * sermonPageSize,
    safeSermonPage * sermonPageSize
  );

  const normalizedNoticeQ = noticeSearch.trim().toLowerCase();
  const filteredNotices = draft.notices.filter((n) => {
    if (
      noticeCategoryFilter !== "전체" &&
      n.category !== noticeCategoryFilter
    ) {
      return false;
    }
    if (!normalizedNoticeQ) return true;
    return (
      n.title.toLowerCase().includes(normalizedNoticeQ) ||
      n.content.toLowerCase().includes(normalizedNoticeQ) ||
      n.category.toLowerCase().includes(normalizedNoticeQ)
    );
  });
  const safeNoticePage = Math.min(
    noticePage,
    Math.max(1, Math.ceil(filteredNotices.length / noticePageSize))
  );
  const pagedNotices = filteredNotices.slice(
    (safeNoticePage - 1) * noticePageSize,
    safeNoticePage * noticePageSize
  );

  const normalizedEventQ = eventSearch.trim().toLowerCase();
  const sortedAdminEvents = [...draft.events]
    .filter((ev) => {
      if (!normalizedEventQ) return true;
      return (
        ev.title.toLowerCase().includes(normalizedEventQ) ||
        ev.description.toLowerCase().includes(normalizedEventQ) ||
        ev.location.toLowerCase().includes(normalizedEventQ) ||
        resolveEventIsoDate(ev).includes(normalizedEventQ)
      );
    })
    .sort((a, b) =>
      resolveEventIsoDate(a).localeCompare(resolveEventIsoDate(b))
    );
  const safeEventPage = Math.min(
    eventPage,
    Math.max(1, Math.ceil(sortedAdminEvents.length / eventPageSize))
  );
  const pagedEvents = sortedAdminEvents.slice(
    (safeEventPage - 1) * eventPageSize,
    safeEventPage * eventPageSize
  );

  const normalizedResourceQ = resourceSearch.trim().toLowerCase();
  const filteredResources = draft.resources.filter((r) => {
    const normCat = normalizeResourceCategory(r.category);
    if (
      resourceCategoryFilter !== "전체" &&
      normCat !== resourceCategoryFilter
    ) {
      return false;
    }
    if (!normalizedResourceQ) return true;
    return (
      r.title.toLowerCase().includes(normalizedResourceQ) ||
      r.description.toLowerCase().includes(normalizedResourceQ) ||
      r.fileName.toLowerCase().includes(normalizedResourceQ) ||
      normCat.toLowerCase().includes(normalizedResourceQ)
    );
  });
  const safeResourcePage = Math.min(
    resourcePage,
    Math.max(1, Math.ceil(filteredResources.length / resourcePageSize))
  );
  const pagedResources = filteredResources.slice(
    (safeResourcePage - 1) * resourcePageSize,
    safeResourcePage * resourcePageSize
  );

  const normalizedCommunityQ = communitySearch.trim().toLowerCase();
  const filteredCommunityPosts = draft.communityPosts.filter((p) => {
    const normalizedDept = normalizeYouthDepartmentLabel(p.department);
    if (
      communityDeptFilter !== "전체" &&
      normalizedDept !== communityDeptFilter
    ) {
      return false;
    }
    if (!normalizedCommunityQ) return true;
    return (
      p.title.toLowerCase().includes(normalizedCommunityQ) ||
      p.content.toLowerCase().includes(normalizedCommunityQ) ||
      normalizedDept.toLowerCase().includes(normalizedCommunityQ)
    );
  });
  const safeCommunityPage = Math.min(
    communityPage,
    Math.max(1, Math.ceil(filteredCommunityPosts.length / communityPageSize))
  );
  const pagedCommunityPosts = filteredCommunityPosts.slice(
    (safeCommunityPage - 1) * communityPageSize,
    safeCommunityPage * communityPageSize
  );

  const normalizedLegacySearch = legacySearch.trim().replace(/^#+/, "").toLowerCase();
  const filteredLegacyAlbums = legacyAlbums.filter((album) => {
    if (legacyVisibilityFilter === "공개중" && !album.isVisible) return false;
    if (legacyVisibilityFilter === "숨김" && album.isVisible) return false;
    if (normalizedLegacySearch) {
      const albumTags = Array.isArray(album.tags) ? album.tags : [];
      const hitMeta =
        album.title.toLowerCase().includes(normalizedLegacySearch) ||
        (album.content ?? "").toLowerCase().includes(normalizedLegacySearch) ||
        album.date.toLowerCase().includes(normalizedLegacySearch) ||
        album.year.toLowerCase().includes(normalizedLegacySearch) ||
        (album.documentSrl ?? "").toLowerCase().includes(normalizedLegacySearch) ||
        albumTags.some((t) => t.toLowerCase().includes(normalizedLegacySearch));
      const hitCaption = album.photos.some((photo) =>
        photo.caption.toLowerCase().includes(normalizedLegacySearch)
      );
      if (!hitMeta && !hitCaption) return false;
    }
    return true;
  });

  const totalLegacyPhotosCount = legacyAlbums.reduce(
    (sum, album) => sum + album.photos.length,
    0
  );
  const visibleLegacyAlbumsCount = legacyAlbums.filter(
    (album) => album.isVisible
  ).length;
  const totalLegacyPages = Math.max(
    1,
    Math.ceil(filteredLegacyAlbums.length / LEGACY_ADMIN_PER_PAGE)
  );
  const safeLegacyPage = Math.min(legacyPage, totalLegacyPages);
  const paginatedLegacyAlbums = filteredLegacyAlbums.slice(
    (safeLegacyPage - 1) * LEGACY_ADMIN_PER_PAGE,
    safeLegacyPage * LEGACY_ADMIN_PER_PAGE
  );

  const adminGroups: readonly AdminGroupDef[] = [
    {
      key: "weekly",
      title: "주간 사역 및 소통",
      items: [
        {
          key: "bulletin",
          label: "주보 안내",
          countLabel: `${draft.bulletins.length}호`,
        },
        {
          key: "sermons",
          label: "설교 영상",
          countLabel: `${draft.sermons.length}편`,
        },
        {
          key: "inquiries",
          label: "새가족 및 문의함",
          countLabel: `${inquiries.length}건`,
          alertBadge:
            pendingInquiriesCount > 0 ? pendingInquiriesCount : undefined,
        },
      ],
    },
    {
      key: "boards",
      title: "나눔과 소식 게시판",
      items: [
        {
          key: "notices",
          label: "교회 소식",
          countLabel: `${draft.notices.length}건`,
        },
        {
          key: "events",
          label: "행사 안내",
          countLabel: `${draft.events.length}건`,
        },
        {
          key: "gallery",
          label: "앨범",
          countLabel: `${visibleLegacyAlbumsCount}개`,
        },
        {
          key: "resources",
          label: "교재 자료",
          countLabel: `${draft.resources.length}건`,
        },
      ],
    },
    {
      key: "ministry",
      title: "예배와 다음 세대",
      items: [
        {
          key: "worship",
          label: "예배 안내",
          countLabel: `${draft.worshipSchedule.length}개`,
        },
        {
          key: "youth",
          label: "다음 세대 안내",
          countLabel: `${draft.youthDepartments.length}부서`,
        },
        {
          key: "community",
          label: "다음 세대 부서 소식",
          countLabel: `${draft.communityPosts.length}건`,
        },
      ],
    },
    {
      key: "about",
      title: "교회 소개 및 헌금",
      items: [
        { key: "greeting", label: "인사말" },
        { key: "pastor-bio", label: "담임목사 약력" },
        {
          key: "history",
          label: "교회 역사",
          countLabel: `${draft.history.length}건`,
        },
        {
          key: "staff",
          label: "섬기는 사람들",
          countLabel: `${draft.staff.length}명`,
        },
        { key: "church-info", label: "오시는 길" },
        {
          key: "offering",
          label: "온라인 헌금",
          countLabel: `${draft.offeringAccounts.length}개`,
        },
      ],
    },
    {
      key: "system",
      title: "메뉴 및 시스템 설정",
      items: [
        {
          key: "hero-cube",
          label: "메인 3D 큐브 사진",
          countLabel: `${heroCubeCount}/6면`,
        },
        {
          key: "top-banner",
          label: "최상단 한 줄 알림바",
          countLabel: `${draft.topBannerNotices.length}줄`,
        },
        { key: "menus", label: "상단 메뉴 및 게시판 추가" },
        { key: "posts", label: "게시물 통합 이동 및 삭제" },
        { key: "backup", label: "데이터 백업 및 복원" },
      ],
    },
  ];

  function handleAssistantJump(
    nextTab: AssistantJumpTarget,
    boardKey?: string
  ) {
    selectAdminTab(nextTab, boardKey);
  }

  function handleInsertNoticeDraftFromAssistant(draftItem: {
    readonly category: NoticeItem["category"];
    readonly title: string;
    readonly author: string;
    readonly date: string;
    readonly content: string;
    readonly isPinned: boolean;
  }) {
    setNewNoticeCategory(draftItem.category);
    setNewNoticeTitle(draftItem.title);
    setNewNoticeDate(draftItem.date);
    setNewNoticeContent(draftItem.content);
    setNewNoticePinned(draftItem.isPinned);
    selectAdminTab("notices");
    setToastMessage(
      `공지 초안("${draftItem.title}")이 [교회 소식] 상단 등록 칸에 입력되었습니다. 내용을 확인한 뒤 [+ 새 소식 등록하기]를 눌러 게시해 주세요.`
    );
  }

  const activeGroup =
    adminGroups.find((g) => g.items.some((i) => i.key === activeTab)) ??
    adminGroups[0];
  const activeCategory =
    activeGroup.items.find((i) => i.key === activeTab) ??
    activeGroup.items[0];

  return (
    <div className="min-h-screen bg-[#F4F7F5] pb-24">
      {/* Admin Top Header Banner */}
      <div className="bg-[#1a2744] text-white border-t border-white/10">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-6 py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <span className="inline-block px-3 py-0.5 rounded-full bg-[#2E7D32] text-xs font-bold mb-1.5">
              사이트 관리자 모드
            </span>
            <h1 className="text-xl sm:text-2xl font-black">
              일광교회 홈페이지 관리
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {authRequired && (
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/admin-auth", { method: "DELETE" });
                  router.push("/");
                  router.refresh();
                }}
                className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/25 text-white border border-white/25 text-xs sm:text-sm font-bold transition-colors"
              >
                로그아웃
              </button>
            )}
            <Link
              href="/"
              className="px-4 py-2.5 rounded-full border border-white/40 text-white hover:bg-white hover:text-[#1a2744] text-xs sm:text-sm font-bold transition-colors"
            >
              홈페이지 메인 보기 ↗
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className={`px-6 py-2.5 rounded-full text-white text-sm font-black shadow-lg transition-colors ${
                isDirty
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-[#2E7D32] hover:bg-[#1B5E20]"
              } disabled:opacity-60`}
            >
              {saving
                ? "저장 중..."
                : isDirty
                  ? "● 미저장 변경사항 반영하기"
                  : "✓ 변경사항 저장하기"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-5 sm:px-6 pt-5">
        {/* Single-Purpose Quick Shortcut Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <button
            type="button"
            onClick={() => selectAdminTab("bulletin")}
            className={`rounded-2xl border p-3.5 sm:p-4 text-left transition-colors ${
              activeTab === "bulletin"
                ? "bg-[#F8FAF8] border-[#2E7D32]"
                : "bg-white border-gray-200 hover:border-[#2E7D32]"
            }`}
          >
            <p className="text-xs font-bold text-gray-500">주보 안내</p>
            <p className="text-base sm:text-xl font-black text-[#1a2744] mt-1">
              총 {draft.bulletins.length}호
            </p>
          </button>
          <button
            type="button"
            onClick={() => selectAdminTab("sermons")}
            className={`rounded-2xl border p-3.5 sm:p-4 text-left transition-colors ${
              activeTab === "sermons"
                ? "bg-[#F8FAF8] border-[#2E7D32]"
                : "bg-white border-gray-200 hover:border-[#2E7D32]"
            }`}
          >
            <p className="text-xs font-bold text-gray-500">설교 영상</p>
            <p className="text-base sm:text-xl font-black text-[#1a2744] mt-1">
              총 {draft.sermons.length}편
            </p>
          </button>
          <button
            type="button"
            onClick={() => selectAdminTab("inquiries")}
            className={`rounded-2xl border p-3.5 sm:p-4 text-left transition-colors ${
              activeTab === "inquiries"
                ? "bg-[#F8FAF8] border-[#2E7D32]"
                : "bg-white border-gray-200 hover:border-[#2E7D32]"
            }`}
          >
            <p className="text-xs font-bold text-gray-500">새가족 및 문의함</p>
            <p className="text-base sm:text-xl font-black text-[#1a2744] mt-1">
              미처리 {pendingInquiriesCount}건{" "}
              <span className="text-xs font-medium text-gray-400 block sm:inline">
                전체 {inquiries.length}건
              </span>
            </p>
          </button>
          <button
            type="button"
            onClick={() => selectAdminTab("gallery")}
            className={`rounded-2xl border p-3.5 sm:p-4 text-left transition-colors ${
              activeTab === "gallery"
                ? "bg-[#F8FAF8] border-[#2E7D32]"
                : "bg-white border-gray-200 hover:border-[#2E7D32]"
            }`}
          >
            <p className="text-xs font-bold text-gray-500">앨범</p>
            <p className="text-base sm:text-xl font-black text-[#1a2744] mt-1">
              공개 앨범 {visibleLegacyAlbumsCount}개{" "}
              <span className="text-xs font-medium text-gray-400 block sm:inline">
                전체 {legacyAlbums.length}개
              </span>
            </p>
          </button>
        </div>

        {/* Status / Upload / Error Alerts */}
        {uploadingLabel && (
          <div className="mb-4 rounded-xl bg-blue-50 border border-blue-300 px-5 py-3 text-sm font-bold text-blue-900">
            파일 업로드 중: {uploadingLabel}...
          </div>
        )}
        {toastMessage && (
          <div
            role="status"
            className="mb-4 rounded-xl bg-[#E8F5E9] border border-[#2E7D32] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-[#1B5E20]"
          >
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-xs underline"
            >
              닫기
            </button>
          </div>
        )}
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-red-50 border border-red-300 px-5 py-3.5 text-sm font-bold text-red-800"
          >
            {errorMessage}
          </div>
        )}
        {toastMessage && (
          <ActionFeedbackBubble
            key={`ok-${toastMessage}`}
            text={toastMessage}
            tone="success"
          />
        )}
        {errorMessage && (
          <ActionFeedbackBubble
            key={`err-${errorMessage}`}
            text={errorMessage}
            tone="error"
          />
        )}

        {/* Mobile / Tablet 2-Tier Category Selector (< 1024px) */}
        <div className="lg:hidden mb-5 bg-white rounded-2xl border border-gray-200 p-3.5 space-y-3 shadow-xs">
          <div className="flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {adminGroups.map((group) => {
              const isGroupActive = group.key === activeGroup.key;
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => selectAdminTab(group.items[0].key)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition-colors ${
                    isGroupActive
                      ? "bg-[#1a2744] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {group.title}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
            {activeGroup.items.map((item) => {
              const isActive = item.key === activeTab;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectAdminTab(item.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? "bg-[#2E7D32] text-white shadow-xs"
                      : "bg-[#F8FAF8] text-gray-700 border border-gray-200 hover:border-[#2E7D32]"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.alertBadge !== undefined ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black leading-none">
                      {item.alertBadge}
                    </span>
                  ) : item.countLabel ? (
                    <span
                      className={`text-[10px] font-semibold ${
                        isActive ? "text-white/85" : "text-gray-400"
                      }`}
                    >
                      {item.countLabel}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Left Categorized Sidebar + Right Dedicated Single-Category Workspace */}
        <div className="lg:flex lg:items-start lg:gap-6">
          <aside
            aria-label="관리자 상세 메뉴"
            className="hidden lg:block w-[260px] shrink-0 sticky top-24 bg-white rounded-2xl border border-gray-200 p-4 space-y-4 shadow-xs"
          >
            {adminGroups.map((group, gIdx) => (
              <div
                key={group.key}
                className={gIdx > 0 ? "pt-3.5 border-t border-gray-100" : ""}
              >
                <p className="px-2.5 mb-1.5 text-[11px] font-extrabold text-[#2E7D32] tracking-wide">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => selectAdminTab(item.key)}
                        className={`w-full px-3 py-2 rounded-xl text-left text-[13px] font-bold transition-colors flex items-center justify-between gap-2 ${
                          isActive
                            ? "bg-[#1a2744] text-white shadow-xs"
                            : "text-gray-700 hover:bg-[#F4F7F5] hover:text-[#1a2744]"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        {item.alertBadge !== undefined ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-black leading-none shrink-0">
                            {item.alertBadge}
                          </span>
                        ) : item.countLabel ? (
                          <span
                            className={`text-[11px] font-semibold shrink-0 ${
                              isActive ? "text-[#a3c9a8]" : "text-gray-400"
                            }`}
                          >
                            {item.countLabel}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </aside>

          <div className="min-w-0 flex-1">
            {/* Current Category Breadcrumb Bar */}
            <div className="mb-4 bg-white rounded-2xl border border-gray-200 px-4 sm:px-5 py-3 flex items-center gap-2 shadow-2xs text-xs sm:text-sm">
              <span className="font-bold text-[#2E7D32]">
                {activeGroup.title}
              </span>
              <span className="text-gray-300">/</span>
              <span className="font-black text-[#1a2744]">
                {activeCategory.label}
              </span>
            </div>

        {/* =========================================================
            SYSTEM: TOP MENUS & CUSTOM BOARDS STRUCTURE
           ========================================================= */}
        {activeTab === "menus" && (
          <AdminMenusAndBoardsStudio
            draft={draft}
            initialBoardSummaries={initialBoardSummaries}
            initialSelectedBoardKey={selectedBoardKeyForStudio}
            sectionMode="menus-only"
            onSaveNavigation={async (nextContent, toastText) => {
              await handleSave(nextContent, toastText);
            }}
            onSyncContentFromServer={(nextContent) => {
              setDraft(nextContent);
              setBaseline(nextContent);
              setIsDirty(false);
            }}
            onUploadFile={(file, bucket, label) =>
              uploadAsset(file, bucket, label)
            }
            onToast={(msg) => {
              setErrorMessage(null);
              setToastMessage(msg);
            }}
            onError={(msg) => {
              setToastMessage(null);
              setErrorMessage(msg);
            }}
          />
        )}

        {/* =========================================================
            SYSTEM: UNIFIED BOARD POST MOVE & BULK DELETE MANAGER
           ========================================================= */}
        {activeTab === "posts" && (
          <AdminMenusAndBoardsStudio
            key={selectedBoardKeyForStudio ?? "default-posts"}
            draft={draft}
            initialBoardSummaries={initialBoardSummaries}
            initialSelectedBoardKey={selectedBoardKeyForStudio}
            sectionMode="posts-only"
            onSaveNavigation={async (nextContent, toastText) => {
              await handleSave(nextContent, toastText);
            }}
            onSyncContentFromServer={(nextContent) => {
              setDraft(nextContent);
              setBaseline(nextContent);
              setIsDirty(false);
            }}
            onUploadFile={(file, bucket, label) =>
              uploadAsset(file, bucket, label)
            }
            onToast={(msg) => {
              setErrorMessage(null);
              setToastMessage(msg);
            }}
            onError={(msg) => {
              setToastMessage(null);
              setErrorMessage(msg);
            }}
          />
        )}

        {/* =========================================================
            TAB 1: INQUIRIES & NEWCOMER REGISTRATION INBOX
           ========================================================= */}
        {activeTab === "inquiries" && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                    새가족 및 온라인 문의함 ({inquiries.length}건)
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["전체", "접수대기", "연락완료"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setInquiryFilter(st);
                        setInquiryPage(1);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold ${
                        inquiryFilter === st
                          ? "bg-[#1a2744] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void refreshInquiries()}
                    className="px-3.5 py-1.5 rounded-full border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    새로고침
                  </button>
                  <Link
                    href="/contact"
                    className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold"
                  >
                    문의 접수 화면 보기 ↗
                  </Link>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="search"
                  value={inquirySearch}
                  onChange={(e) => {
                    setInquirySearch(e.target.value);
                    setInquiryPage(1);
                  }}
                  placeholder="성함, 연락처, 문의 제목, 본문 검색..."
                  className="flex-1 min-w-0 rounded-xl border border-gray-300 bg-[#F8FAF8] px-3.5 py-2 text-xs sm:text-sm"
                />
                {inquirySearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setInquirySearch("");
                      setInquiryPage(1);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-700"
                  >
                    검색 초기화
                  </button>
                )}
              </div>
            </div>

            {filteredInquiries.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-sm text-gray-500">
                해당 조건의 문의 내역이 없습니다.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-4">
                {pagedInquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className={`rounded-2xl border p-5 space-y-3.5 ${
                      inq.status === "접수대기"
                        ? "border-amber-300 bg-amber-50/20 shadow-xs"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-black ${
                            inq.status === "접수대기"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-[#E8F5E9] text-[#2E7D32]"
                          }`}
                        >
                          {inq.status}
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-gray-100 text-[#1a2744] text-xs font-bold">
                          {inq.category}
                        </span>
                        <span className="text-sm font-black text-[#1a2744]">
                          {inq.name}
                        </span>
                        <a
                          href={`tel:${inq.contact}`}
                          className="text-xs font-bold text-[#2E7D32] underline"
                        >
                          {inq.contact}
                        </a>
                        <span className="text-xs text-gray-400">
                          {inq.createdAt.slice(0, 16).replace("T", " ")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void patchInquiryItem(inq.id, {
                              status:
                                inq.status === "접수대기" ? "연락완료" : "접수대기",
                              adminMemo: memoDrafts[inq.id] ?? inq.adminMemo,
                            })
                          }
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                            inq.status === "접수대기"
                              ? "bg-[#2E7D32] text-white hover:bg-[#1B5E20]"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {inq.status === "접수대기"
                            ? "✓ 연락완료로 체크"
                            : "접수대기로 되돌리기"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `"${inq.name}" 님의 문의 내역을 삭제하시겠습니까?`
                              )
                            ) {
                              return;
                            }
                            void removeInquiryItem(inq.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-[#1a2744] text-base">
                        {inq.title}
                      </h3>
                      <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-line bg-[#F8FAF8] rounded-xl p-4 border border-gray-100">
                        {inq.message}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="교역자 및 사무실 처리 메모 (예: 11/13 새가족부 연결 완료)"
                        value={memoDrafts[inq.id] ?? inq.adminMemo}
                        onChange={(e) =>
                          setMemoDrafts((prev) => ({
                            ...prev,
                            [inq.id]: e.target.value,
                          }))
                        }
                        className="flex-1 min-w-0 rounded-xl border border-gray-300 px-3.5 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void patchInquiryItem(inq.id, {
                            adminMemo: memoDrafts[inq.id] ?? "",
                          })
                        }
                        className="px-4 py-2 rounded-xl bg-[#1a2744] text-white text-xs font-bold hover:bg-[#2E7D32] whitespace-nowrap shrink-0"
                      >
                        메모 저장
                      </button>
                    </div>
                  </div>
                ))}

                <AdminPaginationBar
                  currentPage={safeInquiryPage}
                  totalItems={filteredInquiries.length}
                  pageSize={inquiryPageSize}
                  onPageChange={setInquiryPage}
                  onPageSizeChange={setInquiryPageSize}
                  itemUnit="건"
                />
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 2: SERMONS WITH YOUTUBE OEMBED AUTO-FETCH
           ========================================================= */}
        {activeTab === "sermons" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                  새 설교 영상 등록
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={syncingYtChannel || saving}
                    onClick={() => void handleSyncYoutubeChannel()}
                    className="px-3.5 py-1.5 rounded-full border border-[#2E7D32] text-[#2E7D32] hover:bg-[#E8F5E9] text-xs font-bold transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    {syncingYtChannel
                      ? "채널 확인 중..."
                      : "↻ 유튜브 채널 최신 설교 불러오기"}
                  </button>
                  <Link
                    href="/worship/sermons"
                    target="_blank"
                    className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                  >
                    설교 영상 화면 보기 ↗
                  </Link>
                </div>
              </div>

              {/* Paste URL + Auto Fetch */}
              <div className="flex flex-col sm:flex-row gap-2.5 bg-[#F8FAF8] p-4 rounded-xl border border-[#2E7D32]/25">
                <input
                  type="text"
                  placeholder="유튜브 영상 주소 붙여넣기"
                  value={newSermonUrl}
                  onChange={(e) => setNewSermonUrl(e.target.value)}
                  className="flex-1 min-w-0 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                />
                <button
                  type="button"
                  disabled={fetchingYt}
                  onClick={() => void handleFetchYoutubeMeta()}
                  className="px-5 py-2.5 rounded-xl bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
                >
                  {fetchingYt ? "불러오는 중..." : "유튜브 정보 자동 불러오기"}
                </button>
              </div>

              {ytPreviewThumb && (
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <img
                    src={ytPreviewThumb}
                    alt="유튜브 썸네일 미리보기"
                    className="w-28 aspect-video rounded-lg object-cover border border-gray-200"
                  />
                  <span>
                    예배 종류, 제목, 성경 본문, 날짜가 입력되었습니다. 확인 후 등록을 눌러 주세요.
                  </span>
                </div>
              )}

              {/* Worship Type, Title, Scripture, Preacher, Date */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <select
                  aria-label="예배 구분"
                  value={newSermonService}
                  onChange={(e) =>
                    setNewSermonService(e.target.value as SermonServiceCategory)
                  }
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold text-[#1a2744]"
                >
                  {SERVICE_TYPES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="설교 제목"
                  value={newSermonTitle}
                  onChange={(e) => setNewSermonTitle(e.target.value)}
                  className="rounded-xl border border-gray-300 px-3.5 py-2 text-sm font-bold"
                />
                <input
                  type="text"
                  placeholder="본문 말씀 (예: 요한복음 14:1-6)"
                  value={newSermonScripture}
                  onChange={(e) => setNewSermonScripture(e.target.value)}
                  className="rounded-xl border border-gray-300 px-3.5 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="설교자 (선택)"
                  value={newSermonPreacher}
                  onChange={(e) => setNewSermonPreacher(e.target.value)}
                  className="rounded-xl border border-gray-300 px-3.5 py-2 text-sm"
                />
                <input
                  type="date"
                  value={newSermonDate}
                  onChange={(e) => setNewSermonDate(e.target.value)}
                  className="rounded-xl border border-gray-300 px-3.5 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-500 mr-1">
                    설교자 빠른 선택:
                  </span>
                  {[
                    `${draft.pastorProfile.name} 담임목사`,
                    ...draft.staff
                      .filter((p) => p.role !== "담임목사")
                      .map((p) => p.name),
                  ].map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setNewSermonPreacher(name)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                        newSermonPreacher === name
                          ? "bg-[#1a2744] text-white border-[#1a2744]"
                          : "bg-[#F8FAF8] text-gray-700 border-gray-200 hover:border-[#2E7D32]"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                  {newSermonPreacher && (
                    <button
                      type="button"
                      onClick={() => setNewSermonPreacher("")}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold text-gray-500 hover:text-gray-800"
                    >
                      비우기
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleAddAndPublishSermon()}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#2E7D32] text-white text-sm font-black hover:bg-[#1B5E20] whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  + 설교 등록하기
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <h3 className="text-lg font-black text-[#1a2744]">
                  등록된 설교 목록 ({draft.sermons.length}편)
                </h3>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    ["전체", ...SERVICE_TYPES, "설교자 미기재"] as const
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setSermonServiceFilter(st);
                        setSermonPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        sermonServiceFilter === st
                          ? "bg-[#1a2744] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="search"
                  value={sermonSearch}
                  onChange={(e) => {
                    setSermonSearch(e.target.value);
                    setSermonPage(1);
                  }}
                  placeholder="설교 제목, 성경 본문, 설교자, 날짜 검색..."
                  className="flex-1 min-w-0 rounded-xl border border-gray-300 bg-[#F8FAF8] px-3.5 py-2 text-xs sm:text-sm"
                />
                {(sermonSearch || sermonServiceFilter !== "전체") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSermonSearch("");
                      setSermonServiceFilter("전체");
                      setSermonPage(1);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-700"
                  >
                    필터 초기화
                  </button>
                )}
              </div>

              {pagedSermons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
                  검색 조건에 맞는 설교 영상이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                  {pagedSermons.map((sermon) => {
                    const isFeatured = draft.sermons[0]?.id === sermon.id;
                    const isExpanded = expandedSermonId === sermon.id;
                    const normService = normalizeSermonServiceType(
                      sermon.serviceType
                    );
                    const subMeta = [
                      normalizeScriptureText(sermon.scripture),
                      sermon.preacher.trim(),
                    ]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <div key={sermon.id} className="bg-white">
                        <div className="px-3.5 sm:px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 hover:bg-[#F8FAF8]/70 transition-colors">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <img
                              src={`https://i.ytimg.com/vi/${sermon.youtubeId}/mqdefault.jpg`}
                              alt={sermon.title}
                              loading="lazy"
                              className="w-16 sm:w-20 aspect-video rounded-lg object-cover shrink-0 bg-gray-100 border border-gray-200"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                {isFeatured && (
                                  <span className="px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-black">
                                    메인 대표설교
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded bg-gray-100 text-[#1a2744] text-[11px] font-bold">
                                  {normService}
                                </span>
                                <span className="text-xs text-gray-400 font-semibold">
                                  {sermon.date}
                                </span>
                              </div>
                              <p className="text-sm font-black text-[#1a2744] truncate">
                                {sermon.title}
                              </p>
                              {subMeta && (
                                <p className="text-xs text-gray-500 truncate">
                                  {subMeta}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap ml-auto">
                            {!isFeatured && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateDraft((prev) => {
                                    const target = prev.sermons.find(
                                      (s) => s.id === sermon.id
                                    );
                                    if (!target) return prev;
                                    return {
                                      ...prev,
                                      sermons: [
                                        target,
                                        ...prev.sermons.filter(
                                          (s) => s.id !== sermon.id
                                        ),
                                      ],
                                    };
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700"
                              >
                                대표 지정
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSermonId(
                                  isExpanded ? null : sermon.id
                                )
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                isExpanded
                                  ? "bg-[#1a2744] text-white"
                                  : "bg-[#F4F7F5] text-[#1a2744] hover:bg-gray-200"
                              }`}
                            >
                              {isExpanded ? "닫기 ▲" : "수정 ▼"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `"${sermon.title}" 설교 영상을 삭제하시겠습니까?`
                                  )
                                ) {
                                  return;
                                }
                                const nextContent: SiteContent = {
                                  ...draft,
                                  sermons: draft.sermons.filter(
                                    (s) => s.id !== sermon.id
                                  ),
                                };
                                void handleSave(
                                  nextContent,
                                  `"${sermon.title}" 설교 영상이 삭제되었습니다.`
                                );
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                            >
                              삭제
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 py-4 bg-[#F8FAF8] border-t border-gray-200 space-y-2.5">
                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                              <select
                                aria-label="예배 구분 수정"
                                value={normService}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    sermons: prev.sermons.map((s) =>
                                      s.id === sermon.id
                                        ? { ...s, serviceType: e.target.value }
                                        : s
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                              >
                                {SERVICE_TYPES.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="설교 제목"
                                value={sermon.title}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    sermons: prev.sermons.map((s) =>
                                      s.id === sermon.id
                                        ? { ...s, title: e.target.value }
                                        : s
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-bold min-w-0"
                              />
                              <input
                                type="text"
                                placeholder="본문 말씀"
                                value={sermon.scripture}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    sermons: prev.sermons.map((s) =>
                                      s.id === sermon.id
                                        ? { ...s, scripture: e.target.value }
                                        : s
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm min-w-0"
                              />
                              <input
                                type="date"
                                value={sermon.date}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    sermons: prev.sermons.map((s) =>
                                      s.id === sermon.id
                                        ? { ...s, date: e.target.value }
                                        : s
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm min-w-0"
                              />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="설교자 (비워두면 예배와 본문만 표시)"
                                value={sermon.preacher}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    sermons: prev.sermons.map((s) =>
                                      s.id === sermon.id
                                        ? { ...s, preacher: e.target.value }
                                        : s
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs min-w-0"
                              />
                              <input
                                type="text"
                                placeholder="유튜브 ID 또는 주소"
                                value={sermon.youtubeId}
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  const extracted = extractYoutubeId(rawVal);
                                  updateDraft((prev) => ({
                                    ...prev,
                                    sermons: prev.sermons.map((s) =>
                                      s.id === sermon.id
                                        ? {
                                            ...s,
                                            youtubeId: extracted || rawVal.trim(),
                                          }
                                        : s
                                    ),
                                  }));
                                }}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-mono min-w-0"
                              />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {[
                                  `${draft.pastorProfile.name} 담임목사`,
                                  ...draft.staff
                                    .filter((p) => p.role !== "담임목사")
                                    .map((p) => p.name),
                                ].map((name) => (
                                  <button
                                    key={`${sermon.id}-p-${name}`}
                                    type="button"
                                    onClick={() =>
                                      updateDraft((prev) => ({
                                        ...prev,
                                        sermons: prev.sermons.map((s) =>
                                          s.id === sermon.id
                                            ? { ...s, preacher: name }
                                            : s
                                        ),
                                      }))
                                    }
                                    className="px-2.5 py-0.5 rounded-full bg-white border border-gray-200 hover:border-[#2E7D32] text-[11px] font-semibold text-gray-700"
                                  >
                                    {name}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                  setExpandedSermonId(null);
                                  void handleSave(
                                    draft,
                                    `"${sermon.title}" 설교 수정사항이 저장되었습니다.`
                                  );
                                }}
                                className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                              >
                                수정 내용 저장
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
                currentPage={safeSermonPage}
                totalItems={filteredSermons.length}
                pageSize={sermonPageSize}
                onPageChange={setSermonPage}
                onPageSizeChange={setSermonPageSize}
                itemUnit="편"
              />
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: WEEKLY BULLETINS (HWP / HWPX AUTO-PARSE)
           ========================================================= */}
        {activeTab === "bulletin" && (
          <AdminBulletinStudio
            draft={draft}
            saving={saving}
            onUpdateBulletins={(nextBulletins) =>
              updateDraft((prev) => ({
                ...prev,
                bulletins: nextBulletins,
              }))
            }
            onSaveImmediate={(nextContent, toastMsg) =>
              handleSave(nextContent, toastMsg)
            }
            onUploadAsset={(file, bucket, label) =>
              uploadAsset(file, bucket, label)
            }
            onToast={(msg) => {
              setErrorMessage(null);
              setToastMessage(msg);
            }}
            onError={(msg) => {
              setToastMessage(null);
              setErrorMessage(msg);
            }}
          />
        )}

        {/* =========================================================
            CATEGORY: CHURCH NOTICES (UNIFIED CREATION CARD + LIST)
           ========================================================= */}
        {activeTab === "notices" && (
          <div className="space-y-6">
            {/* 1. Create New Notice Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                  새 교회 소식 등록
                </h2>
                <Link
                  href="/news"
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  교회 소식 화면 보기 ↗
                </Link>
              </div>

              <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      분류
                    </label>
                    <select
                      aria-label="새 소식 분류"
                      value={newNoticeCategory}
                      onChange={(e) =>
                        setNewNoticeCategory(
                          e.target.value as NoticeItem["category"]
                        )
                      }
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-[#1a2744]"
                    >
                      <option value="소식">소식</option>
                      <option value="필독">필독</option>
                      <option value="예배">예배</option>
                      <option value="모집">모집</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      게시일
                    </label>
                    <input
                      type="date"
                      aria-label="새 소식 게시일"
                      value={newNoticeDate}
                      onChange={(e) => setNewNoticeDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-[#1a2744] bg-white px-3.5 py-2.5 rounded-xl border border-gray-300 w-full cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newNoticePinned}
                        onChange={(e) => setNewNoticePinned(e.target.checked)}
                        className="rounded border-gray-300 text-[#2E7D32]"
                      />
                      <span>상단 고정 공지로 등록</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    소식 제목 *
                  </label>
                  <input
                    type="text"
                    value={newNoticeTitle}
                    onChange={(e) => setNewNoticeTitle(e.target.value)}
                    placeholder="교회 소식 제목을 입력해 주세요"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    소식 본문 *
                  </label>
                  <textarea
                    rows={4}
                    value={newNoticeContent}
                    onChange={(e) => setNewNoticeContent(e.target.value)}
                    placeholder="성도님들께 안내할 소식 내용을 입력해 주세요."
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 font-bold text-gray-700 cursor-pointer">
                      첨부파일 선택 (선택)
                      <input
                        type="file"
                        accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          const uploaded = await uploadAsset(
                            file,
                            "notices",
                            file.name
                          );
                          if (uploaded) {
                            setNewNoticeAttachUrl(uploaded.url);
                            setNewNoticeAttachName(uploaded.fileName);
                          }
                        }}
                      />
                    </label>
                    {newNoticeAttachName && (
                      <span className="inline-flex items-center gap-1.5 text-[#2E7D32] font-bold">
                        <span>첨부됨: {newNoticeAttachName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewNoticeAttachUrl("");
                            setNewNoticeAttachName("");
                          }}
                          className="text-red-600 underline"
                        >
                          해제
                        </button>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCreateNotice()}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
                  >
                    + 새 소식 등록하기
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Registered Notices List Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-black text-[#1a2744]">
                  등록된 교회 소식 ({draft.notices.length}건)
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["전체", "필독", "예배", "소식", "모집"] as const).map(
                    (catOpt) => (
                      <button
                        key={catOpt}
                        type="button"
                        onClick={() => {
                          setNoticeCategoryFilter(catOpt);
                          setNoticePage(1);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                          noticeCategoryFilter === catOpt
                            ? "bg-[#1a2744] text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {catOpt}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="search"
                  value={noticeSearch}
                  onChange={(e) => {
                    setNoticeSearch(e.target.value);
                    setNoticePage(1);
                  }}
                  placeholder="교회 소식 제목, 본문 검색..."
                  className="flex-1 min-w-0 rounded-xl border border-gray-300 bg-[#F8FAF8] px-3.5 py-2 text-xs sm:text-sm"
                />
                {(noticeSearch || noticeCategoryFilter !== "전체") && (
                  <button
                    type="button"
                    onClick={() => {
                      setNoticeSearch("");
                      setNoticeCategoryFilter("전체");
                      setNoticePage(1);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-700"
                  >
                    필터 초기화
                  </button>
                )}
              </div>

              {pagedNotices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  검색 조건에 맞는 교회 소식이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                  {pagedNotices.map((notice) => {
                    const isExpanded = expandedNoticeId === notice.id;
                    return (
                      <div key={notice.id} className="bg-white">
                        <div className="px-3.5 sm:px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 hover:bg-[#F8FAF8]/70 transition-colors">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {notice.isPinned && (
                              <span className="px-2 py-0.5 rounded bg-[#1a2744] text-white text-[11px] font-black shrink-0">
                                상단고정
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-bold shrink-0">
                              {notice.category}
                            </span>
                            <span className="text-sm font-bold text-[#1a2744] truncate">
                              {notice.title}
                            </span>
                            {notice.attachmentUrl && (
                              <span className="text-[11px] text-[#2E7D32] font-bold shrink-0">
                                첨부
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-auto">
                            <span className="text-xs text-gray-400">
                              {notice.date}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedNoticeId(
                                  isExpanded ? null : notice.id
                                )
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                isExpanded
                                  ? "bg-[#1a2744] text-white"
                                  : "bg-[#F4F7F5] text-[#1a2744] hover:bg-gray-200"
                              }`}
                            >
                              {isExpanded ? "닫기 ▲" : "수정 ▼"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `"${notice.title}" 소식을 삭제하시겠습니까?`
                                  )
                                ) {
                                  return;
                                }
                                const nextContent: SiteContent = {
                                  ...draft,
                                  notices: draft.notices.filter(
                                    (n) => n.id !== notice.id
                                  ),
                                };
                                void handleSave(
                                  nextContent,
                                  `"${notice.title}" 소식이 삭제되었습니다.`
                                );
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                            >
                              삭제
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 py-4 bg-[#F8FAF8] border-t border-gray-200 space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_150px] gap-2 items-center">
                              <select
                                aria-label="공지 분류"
                                value={notice.category}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    notices: prev.notices.map((n) =>
                                      n.id === notice.id
                                        ? {
                                            ...n,
                                            category: e.target
                                              .value as NoticeItem["category"],
                                          }
                                        : n
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs font-bold"
                              >
                                <option value="필독">필독</option>
                                <option value="예배">예배</option>
                                <option value="소식">소식</option>
                                <option value="모집">모집</option>
                              </select>
                              <label className="flex items-center gap-1.5 text-xs font-bold text-[#1a2744] bg-white px-3 py-2 rounded-lg border border-gray-300">
                                <input
                                  type="checkbox"
                                  checked={notice.isPinned}
                                  onChange={(e) =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      notices: prev.notices.map((n) =>
                                        n.id === notice.id
                                          ? { ...n, isPinned: e.target.checked }
                                          : n
                                      ),
                                    }))
                                  }
                                />
                                상단고정
                              </label>
                              <input
                                type="text"
                                value={notice.title}
                                placeholder="제목"
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    notices: prev.notices.map((n) =>
                                      n.id === notice.id
                                        ? { ...n, title: e.target.value }
                                        : n
                                    ),
                                  }))
                                }
                                className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
                              />
                              <input
                                type={
                                  /^\d{4}-\d{2}-\d{2}$/.test(notice.date)
                                    ? "date"
                                    : "text"
                                }
                                value={notice.date}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    notices: prev.notices.map((n) =>
                                      n.id === notice.id
                                        ? { ...n, date: e.target.value }
                                        : n
                                    ),
                                  }))
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs"
                              />
                            </div>
                            <textarea
                              rows={3}
                              value={notice.content}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  notices: prev.notices.map((n) =>
                                    n.id === notice.id
                                      ? { ...n, content: e.target.value }
                                      : n
                                  ),
                                }))
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-bold text-gray-700 cursor-pointer">
                                  공지 첨부파일 변경
                                  <input
                                    type="file"
                                    accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = "";
                                      if (!file) return;
                                      const uploaded = await uploadAsset(
                                        file,
                                        "notices",
                                        file.name
                                      );
                                      if (uploaded) {
                                        updateDraft((prev) => ({
                                          ...prev,
                                          notices: prev.notices.map((n) =>
                                            n.id === notice.id
                                              ? {
                                                  ...n,
                                                  attachmentUrl: uploaded.url,
                                                  attachmentName:
                                                    uploaded.fileName,
                                                }
                                              : n
                                          ),
                                        }));
                                      }
                                    }}
                                  />
                                </label>
                                {notice.attachmentUrl && (
                                  <span className="inline-flex items-center gap-1.5 text-[#2E7D32] font-bold">
                                    <span>첨부: {notice.attachmentName}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateDraft((prev) => ({
                                          ...prev,
                                          notices: prev.notices.map((n) =>
                                            n.id === notice.id
                                              ? {
                                                  ...n,
                                                  attachmentUrl: undefined,
                                                  attachmentName: undefined,
                                                }
                                              : n
                                          ),
                                        }))
                                      }
                                      className="text-red-600 underline"
                                    >
                                      해제
                                    </button>
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                  setExpandedNoticeId(null);
                                  void handleSave(
                                    draft,
                                    `"${notice.title}" 소식 수정사항이 저장되었습니다.`
                                  );
                                }}
                                className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                              >
                                수정 내용 저장
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
                currentPage={safeNoticePage}
                totalItems={filteredNotices.length}
                pageSize={noticePageSize}
                onPageChange={setNoticePage}
                onPageSizeChange={setNoticePageSize}
                itemUnit="건"
              />
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: ANNUAL CHURCH EVENTS (UNIFIED CREATION CARD + LIST)
           ========================================================= */}
        {activeTab === "events" && (
          <div className="space-y-6">
            {/* 1. Create New Event Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                  새 행사 일정 등록
                </h2>
                <Link
                  href="/news/events"
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  행사 안내 화면 보기 ↗
                </Link>
              </div>

              <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      행사 일자 *
                    </label>
                    <input
                      type="date"
                      aria-label="새 행사 일자"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      시간 안내
                    </label>
                    <input
                      type="text"
                      value={newEventTime}
                      onChange={(e) => setNewEventTime(e.target.value)}
                      placeholder="예: 오전 11:00"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      장소
                    </label>
                    <input
                      type="text"
                      value={newEventLocation}
                      onChange={(e) => setNewEventLocation(e.target.value)}
                      placeholder="예: 일광교회 본당"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    행사 제목 *
                  </label>
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="예: 추수감사주일 감사예배 및 찬양제"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    행사 상세 설명
                  </label>
                  <textarea
                    rows={3}
                    value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                    placeholder="행사 일정과 참석 안내 문구를 입력해 주세요."
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 font-bold text-gray-700 cursor-pointer">
                      안내문 첨부파일 선택 (선택)
                      <input
                        type="file"
                        accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          const uploaded = await uploadAsset(
                            file,
                            "notices",
                            file.name
                          );
                          if (uploaded) {
                            setNewEventAttachUrl(uploaded.url);
                            setNewEventAttachName(uploaded.fileName);
                          }
                        }}
                      />
                    </label>
                    {newEventAttachName && (
                      <span className="inline-flex items-center gap-1.5 text-[#2E7D32] font-bold">
                        <span>첨부됨: {newEventAttachName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewEventAttachUrl("");
                            setNewEventAttachName("");
                          }}
                          className="text-red-600 underline"
                        >
                          해제
                        </button>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCreateEvent()}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
                  >
                    + 새 행사 등록하기
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Registered Events List Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black text-[#1a2744]">
                  등록된 행사 일정 ({draft.events.length}건)
                </h3>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="search"
                  value={eventSearch}
                  onChange={(e) => {
                    setEventSearch(e.target.value);
                    setEventPage(1);
                  }}
                  placeholder="행사명, 날짜, 장소, 설명 검색..."
                  className="flex-1 min-w-0 rounded-xl border border-gray-300 bg-[#F8FAF8] px-3.5 py-2 text-xs sm:text-sm"
                />
                {eventSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setEventSearch("");
                      setEventPage(1);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-700"
                  >
                    검색 초기화
                  </button>
                )}
              </div>

              {pagedEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  등록된 행사 일정이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                  {pagedEvents.map((ev) => {
                    const isExpanded = expandedEventId === ev.id;
                    const evIsoDate = resolveEventIsoDate(ev);
                    return (
                      <div key={ev.id} className="bg-white">
                        <div className="px-3.5 sm:px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 hover:bg-[#F8FAF8]/70 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="px-2.5 py-1 rounded-lg bg-[#1a2744] text-white text-xs font-black shrink-0 font-mono">
                              {evIsoDate}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#1a2744] truncate">
                                {ev.title}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {[ev.timeText, ev.location]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedEventId(isExpanded ? null : ev.id)
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                isExpanded
                                  ? "bg-[#1a2744] text-white"
                                  : "bg-[#F4F7F5] text-[#1a2744] hover:bg-gray-200"
                              }`}
                            >
                              {isExpanded ? "닫기 ▲" : "수정 ▼"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `"${ev.title}" 행사 일정을 삭제하시겠습니까?`
                                  )
                                ) {
                                  return;
                                }
                                const nextContent: SiteContent = {
                                  ...draft,
                                  events: draft.events.filter(
                                    (item) => item.id !== ev.id
                                  ),
                                };
                                void handleSave(
                                  nextContent,
                                  `"${ev.title}" 행사가 삭제되었습니다.`
                                );
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                            >
                              삭제
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 py-4 bg-[#F8FAF8] border-t border-gray-200 space-y-2.5">
                            <div className="grid sm:grid-cols-4 gap-2">
                              <input
                                type="date"
                                aria-label="행사 일자 (YYYY-MM-DD)"
                                value={evIsoDate}
                                onChange={(e) => {
                                  const nextIso = e.target.value;
                                  if (!nextIso) return;
                                  const nextBadges =
                                    formatEventBadgesFromIsoDate(nextIso);
                                  updateDraft((prev) => ({
                                    ...prev,
                                    events: prev.events.map((item) =>
                                      item.id === ev.id
                                        ? {
                                            ...item,
                                            date: nextIso,
                                            dayBadge: nextBadges.dayBadge,
                                            monthYearBadge:
                                              nextBadges.monthYearBadge,
                                          }
                                        : item
                                    ),
                                  }));
                                }}
                                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                              />
                              <input
                                type="text"
                                value={ev.title}
                                placeholder="행사명"
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    events: prev.events.map((item) =>
                                      item.id === ev.id
                                        ? { ...item, title: e.target.value }
                                        : item
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-bold"
                              />
                              <input
                                type="text"
                                value={ev.timeText}
                                placeholder="시간"
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    events: prev.events.map((item) =>
                                      item.id === ev.id
                                        ? { ...item, timeText: e.target.value }
                                        : item
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                              />
                              <input
                                type="text"
                                value={ev.location}
                                placeholder="장소"
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    events: prev.events.map((item) =>
                                      item.id === ev.id
                                        ? { ...item, location: e.target.value }
                                        : item
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                              />
                            </div>
                            <textarea
                              rows={2}
                              value={ev.description}
                              placeholder="행사 상세 설명"
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  events: prev.events.map((item) =>
                                    item.id === ev.id
                                      ? { ...item, description: e.target.value }
                                      : item
                                  ),
                                }))
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-bold text-gray-700 cursor-pointer">
                                  안내문 첨부파일 변경
                                  <input
                                    type="file"
                                    accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = "";
                                      if (!file) return;
                                      const uploaded = await uploadAsset(
                                        file,
                                        "notices",
                                        file.name
                                      );
                                      if (uploaded) {
                                        updateDraft((prev) => ({
                                          ...prev,
                                          events: prev.events.map((item) =>
                                            item.id === ev.id
                                              ? {
                                                  ...item,
                                                  attachmentUrl: uploaded.url,
                                                  attachmentName:
                                                    uploaded.fileName,
                                                }
                                              : item
                                          ),
                                        }));
                                      }
                                    }}
                                  />
                                </label>
                                {ev.attachmentUrl && (
                                  <span className="inline-flex items-center gap-1.5 text-[#2E7D32] font-bold">
                                    <span>첨부: {ev.attachmentName}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateDraft((prev) => ({
                                          ...prev,
                                          events: prev.events.map((item) =>
                                            item.id === ev.id
                                              ? {
                                                  ...item,
                                                  attachmentUrl: undefined,
                                                  attachmentName: undefined,
                                                }
                                              : item
                                          ),
                                        }))
                                      }
                                      className="text-red-600 underline"
                                    >
                                      해제
                                    </button>
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                  setExpandedEventId(null);
                                  void handleSave(
                                    draft,
                                    `"${ev.title}" 행사 수정사항이 저장되었습니다.`
                                  );
                                }}
                                className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                              >
                                수정 내용 저장
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
                currentPage={safeEventPage}
                totalItems={sortedAdminEvents.length}
                pageSize={eventPageSize}
                onPageChange={setEventPage}
                onPageSizeChange={setEventPageSize}
                itemUnit="건"
              />
            </div>
          </div>
        )}

        {/* =========================================================
            SYSTEM: TOP BANNER NOTICES
           ========================================================= */}
        {activeTab === "top-banner" && (
          <div className="space-y-6">
            {/* 1. Create New Single-Line Top Banner Notice Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                    새 한 줄 알림 등록
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    등록한 알림 문구들이 홈페이지 최상단 바에서 순서대로 돌아가며 표시됩니다.
                  </p>
                </div>
                <Link
                  href="/"
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  메인 화면 보기 ↗
                </Link>
              </div>

              <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <input
                  type="text"
                  value={newTopBannerText}
                  onChange={(e) => setNewTopBannerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreateTopBannerNotice();
                    }
                  }}
                  placeholder="새 한 줄 알림 문구를 입력해 주세요"
                  className="flex-1 min-w-0 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-[#1a2744]"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleCreateTopBannerNotice()}
                  className="px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
                >
                  + 새 알림 등록하기
                </button>
              </div>
            </div>

            {/* 2. Registered Top Banner Notices — One Box Per Line */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-black text-[#1a2744]">
                  등록된 한 줄 알림 ({draft.topBannerNotices.length}건)
                </h3>
                {draft.topBannerNotices.length > 0 && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      const cleaned = draft.topBannerNotices
                        .map((line) => line.trim())
                        .filter(Boolean);
                      const nextContent: SiteContent = {
                        ...draft,
                        topBannerNotices: cleaned,
                      };
                      void handleSave(
                        nextContent,
                        "최상단 알림바 문구가 저장되었습니다."
                      );
                    }}
                    className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                  >
                    수정 내용 저장
                  </button>
                )}
              </div>

              {draft.topBannerNotices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  등록된 최상단 한 줄 알림이 없습니다. 위 입력 칸에서 새 알림을 추가해 보세요.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {draft.topBannerNotices.map((noticeLine, idx) => (
                    <div
                      key={`top-banner-row-${idx}`}
                      className="flex flex-col sm:flex-row sm:items-center gap-2.5 rounded-xl border border-gray-200 bg-[#F8FAF8] p-3"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-[#1a2744] text-white text-xs font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          aria-label={`한 줄 알림 ${idx + 1}번 문구`}
                          value={noticeLine}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateDraft((prev) => ({
                              ...prev,
                              topBannerNotices: prev.topBannerNotices.map(
                                (item, i) => (i === idx ? val : item)
                              ),
                            }));
                          }}
                          placeholder="한 줄 알림 문구를 입력해 주세요"
                          className="flex-1 min-w-0 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-[#1a2744]"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          aria-label={`${idx + 1}번 알림 위로 이동`}
                          onClick={() => {
                            if (idx === 0) return;
                            updateDraft((prev) => {
                              const next = [...prev.topBannerNotices];
                              const temp = next[idx - 1];
                              next[idx - 1] = next[idx];
                              next[idx] = temp;
                              return { ...prev, topBannerNotices: next };
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-35"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={idx === draft.topBannerNotices.length - 1}
                          aria-label={`${idx + 1}번 알림 아래로 이동`}
                          onClick={() => {
                            if (idx >= draft.topBannerNotices.length - 1) {
                              return;
                            }
                            updateDraft((prev) => {
                              const next = [...prev.topBannerNotices];
                              const temp = next[idx + 1];
                              next[idx + 1] = next[idx];
                              next[idx] = temp;
                              return { ...prev, topBannerNotices: next };
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-35"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `${idx + 1}번 알림 문구를 삭제하시겠습니까?`
                              )
                            ) {
                              return;
                            }
                            const nextContent: SiteContent = {
                              ...draft,
                              topBannerNotices: draft.topBannerNotices.filter(
                                (_, i) => i !== idx
                              ),
                            };
                            void handleSave(
                              nextContent,
                              "한 줄 알림 문구가 삭제되었습니다."
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: STUDY & ADMIN RESOURCES (UNIFIED CREATION CARD + LIST)
           ========================================================= */}
        {activeTab === "resources" && (
          <div className="space-y-6">
            {/* 1. Create New Study / Admin Resource Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                  새 교재 자료 등록
                </h2>
                <Link
                  href="/resources"
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  교재 자료 화면 보기 ↗
                </Link>
              </div>

              <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      자료 분류 *
                    </label>
                    <select
                      aria-label="새 자료 분류"
                      value={newResourceCategory}
                      onChange={(e) =>
                        setNewResourceCategory(
                          e.target.value as ResourceCategory
                        )
                      }
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-[#1a2744]"
                    >
                      {RESOURCE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      등록일
                    </label>
                    <input
                      type="date"
                      aria-label="새 자료 등록일"
                      value={newResourceDate}
                      onChange={(e) => setNewResourceDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    자료 제목 *
                  </label>
                  <input
                    type="text"
                    value={newResourceTitle}
                    onChange={(e) => setNewResourceTitle(e.target.value)}
                    placeholder="자료 제목 (파일을 선택하면 파일명이 자동 입력됩니다)"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    자료 안내 설명 (선택)
                  </label>
                  <textarea
                    rows={2}
                    value={newResourceDesc}
                    onChange={(e) => setNewResourceDesc(e.target.value)}
                    placeholder="성경 공부 교재나 부서 공과 자료에 관한 설명을 입력해 주세요."
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="px-4 py-2.5 rounded-xl bg-[#1a2744] hover:bg-[#2E7D32] text-white font-bold cursor-pointer transition-colors">
                      {newResourceFile
                        ? "다른 파일로 변경"
                        : "자료 파일 선택 (PDF, HWP, DOCX 등) *"}
                      <input
                        type="file"
                        accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          const uploaded = await uploadAsset(
                            file,
                            "resources",
                            file.name
                          );
                          if (uploaded) {
                            setNewResourceFile(uploaded);
                            if (!newResourceTitle.trim()) {
                              setNewResourceTitle(
                                file.name.replace(/\.[^.]+$/, "")
                              );
                            }
                          }
                        }}
                      />
                    </label>
                    {newResourceFile && (
                      <span className="inline-flex items-center gap-1.5 text-[#2E7D32] font-bold">
                        <span>
                          선택됨: {newResourceFile.fileName} (
                          {newResourceFile.sizeLabel})
                        </span>
                        <button
                          type="button"
                          onClick={() => setNewResourceFile(null)}
                          className="text-red-600 underline"
                        >
                          해제
                        </button>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCreateResource()}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
                  >
                    + 새 자료 등록하기
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Registered Resources List Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-black text-[#1a2744]">
                  등록된 교재 자료 ({draft.resources.length}건)
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["전체", ...RESOURCE_CATEGORIES] as const).map((catOpt) => (
                    <button
                      key={catOpt}
                      type="button"
                      onClick={() => {
                        setResourceCategoryFilter(catOpt);
                        setResourcePage(1);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        resourceCategoryFilter === catOpt
                          ? "bg-[#1a2744] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {catOpt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="search"
                  value={resourceSearch}
                  onChange={(e) => {
                    setResourceSearch(e.target.value);
                    setResourcePage(1);
                  }}
                  placeholder="자료 제목, 파일명, 분류 검색..."
                  className="flex-1 min-w-0 rounded-xl border border-gray-300 bg-[#F8FAF8] px-3.5 py-2 text-xs sm:text-sm"
                />
                {(resourceSearch || resourceCategoryFilter !== "전체") && (
                  <button
                    type="button"
                    onClick={() => {
                      setResourceSearch("");
                      setResourceCategoryFilter("전체");
                      setResourcePage(1);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-700"
                  >
                    필터 초기화
                  </button>
                )}
              </div>

              {pagedResources.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  등록된 교재 자료가 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                  {pagedResources.map((res) => {
                    const isExpanded = expandedResourceId === res.id;
                    return (
                      <div key={res.id} className="bg-white">
                        <div className="px-3.5 sm:px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 hover:bg-[#F8FAF8]/70 transition-colors">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-bold shrink-0">
                              {normalizeResourceCategory(res.category)}
                            </span>
                            <span className="text-sm font-bold text-[#1a2744] truncate">
                              {res.title}
                            </span>
                            <span className="text-xs text-gray-400 truncate hidden md:inline">
                              ({res.fileName}, {res.fileSizeLabel})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <span className="text-xs text-gray-400">
                              {res.date}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedResourceId(
                                  isExpanded ? null : res.id
                                )
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                isExpanded
                                  ? "bg-[#1a2744] text-white"
                                  : "bg-[#F4F7F5] text-[#1a2744] hover:bg-gray-200"
                              }`}
                            >
                              {isExpanded ? "닫기 ▲" : "수정 ▼"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `"${res.title}" 자료를 삭제하시겠습니까?`
                                  )
                                ) {
                                  return;
                                }
                                const nextContent: SiteContent = {
                                  ...draft,
                                  resources: draft.resources.filter(
                                    (r) => r.id !== res.id
                                  ),
                                };
                                void handleSave(
                                  nextContent,
                                  `"${res.title}" 자료가 삭제되었습니다.`
                                );
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                            >
                              삭제
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 py-4 bg-[#F8FAF8] border-t border-gray-200 space-y-2.5">
                            <div className="grid sm:grid-cols-[auto_1fr_150px] gap-2">
                              <select
                                aria-label="자료 분류"
                                value={normalizeResourceCategory(res.category)}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    resources: prev.resources.map((r) =>
                                      r.id === res.id
                                        ? {
                                            ...r,
                                            category: e.target
                                              .value as ResourceCategory,
                                          }
                                        : r
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                              >
                                {RESOURCE_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={res.title}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    resources: prev.resources.map((r) =>
                                      r.id === res.id
                                        ? { ...r, title: e.target.value }
                                        : r
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-bold"
                              />
                              <input
                                type={
                                  /^\d{4}-\d{2}-\d{2}$/.test(res.date)
                                    ? "date"
                                    : "text"
                                }
                                value={res.date}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    resources: prev.resources.map((r) =>
                                      r.id === res.id
                                        ? { ...r, date: e.target.value }
                                        : r
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                              />
                            </div>
                            <textarea
                              rows={2}
                              value={res.description}
                              placeholder="자료 설명"
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  resources: prev.resources.map((r) =>
                                    r.id === res.id
                                      ? { ...r, description: e.target.value }
                                      : r
                                  ),
                                }))
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-bold text-gray-700 cursor-pointer">
                                  파일 교체
                                  <input
                                    type="file"
                                    accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = "";
                                      if (!file) return;
                                      const uploaded = await uploadAsset(
                                        file,
                                        "resources",
                                        file.name
                                      );
                                      if (uploaded) {
                                        updateDraft((prev) => ({
                                          ...prev,
                                          resources: prev.resources.map((r) =>
                                            r.id === res.id
                                              ? {
                                                  ...r,
                                                  fileUrl: uploaded.url,
                                                  fileName: uploaded.fileName,
                                                  fileSizeLabel:
                                                    uploaded.sizeLabel,
                                                }
                                              : r
                                          ),
                                        }));
                                      }
                                    }}
                                  />
                                </label>
                                <span className="text-[#2E7D32] font-bold break-all">
                                  파일: {res.fileName} ({res.fileSizeLabel})
                                </span>
                              </div>

                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                  setExpandedResourceId(null);
                                  void handleSave(
                                    draft,
                                    `"${res.title}" 자료 수정사항이 저장되었습니다.`
                                  );
                                }}
                                className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                              >
                                수정 내용 저장
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
                currentPage={safeResourcePage}
                totalItems={filteredResources.length}
                pageSize={resourcePageSize}
                onPageChange={setResourcePage}
                onPageSizeChange={setResourcePageSize}
                itemUnit="건"
              />
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: NEXT-GEN DEPARTMENT NEWS (UNIFIED CREATION CARD + LIST)
           ========================================================= */}
        {activeTab === "community" && (
          <div className="space-y-6">
            {/* 1. Create New Department News Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                  새 부서 소식 등록
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href="/youth/sunday#dept-news"
                    target="_blank"
                    className="px-3 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    유초등부 화면 ↗
                  </Link>
                  <Link
                    href="/youth/teens#dept-news"
                    target="_blank"
                    className="px-3 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    중고등부 화면 ↗
                  </Link>
                  <Link
                    href="/youth/young-adults#dept-news"
                    target="_blank"
                    className="px-3 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    청년부 화면 ↗
                  </Link>
                </div>
              </div>

              <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      부서 선택 *
                    </label>
                    <select
                      aria-label="새 소식 부서 선택"
                      value={newCommDept}
                      onChange={(e) =>
                        setNewCommDept(
                          e.target.value as "유초등부" | "중고등부" | "청년부"
                        )
                      }
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-[#1a2744]"
                    >
                      {COMMUNITY_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      게시일
                    </label>
                    <input
                      type="date"
                      aria-label="새 부서 소식 게시일"
                      value={newCommDate}
                      onChange={(e) => setNewCommDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    부서 소식 제목 *
                  </label>
                  <input
                    type="text"
                    value={newCommTitle}
                    onChange={(e) => setNewCommTitle(e.target.value)}
                    placeholder={`예: ${newCommDept} 수련회 및 예배 스케치`}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    소식 본문 (선택)
                  </label>
                  <textarea
                    rows={3}
                    value={newCommContent}
                    onChange={(e) => setNewCommContent(e.target.value)}
                    placeholder="부서 예배, 성경학교, 수련회, 찬양 및 소그룹 사역 내용을 입력해 주세요."
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-600">
                    유튜브 영상 주소 (선택)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                    <input
                      type="url"
                      value={newCommYoutubeUrl}
                      onChange={(e) => setNewCommYoutubeUrl(e.target.value)}
                      placeholder="유튜브 링크 그대로 붙여넣기 (예: https://youtu.be/... 또는 https://www.youtube.com/watch?v=...)"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs sm:text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer">
                        대표 사진 선택 (선택)
                        <input
                          type="file"
                          accept={ADMIN_IMAGE_ACCEPT}
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            const uploaded = await uploadAsset(
                              file,
                              "gallery",
                              file.name
                            );
                            if (uploaded) {
                              setNewCommImageUrl(uploaded.url);
                            }
                          }}
                        />
                      </label>
                      {newCommImageUrl && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E7D32]">
                          <span>사진 선택됨</span>
                          <button
                            type="button"
                            onClick={() => setNewCommImageUrl("")}
                            className="text-red-600 underline"
                          >
                            해제
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const trimmedYt = newCommYoutubeUrl.trim();
                    if (!trimmedYt) return null;
                    const previewId = extractYoutubeId(trimmedYt);
                    if (!previewId) {
                      return (
                        <p className="text-xs font-semibold text-amber-700">
                          유튜브 공유 링크(youtu.be/...), 일반 영상 주소(youtube.com/watch?v=...), 또는 Shorts 주소를 그대로 붙여넣어 주세요.
                        </p>
                      );
                    }
                    return (
                      <div className="flex items-center gap-3 rounded-xl border border-[#2E7D32]/25 bg-white px-3 py-2">
                        <img
                          src={`https://i.ytimg.com/vi/${previewId}/mqdefault.jpg`}
                          alt="유튜브 영상 썸네일 미리보기"
                          className="w-20 aspect-video rounded-lg object-cover border border-gray-200 shrink-0"
                        />
                        <div className="min-w-0 text-xs space-y-0.5">
                          <p className="font-bold text-[#2E7D32]">
                            유튜브 영상 연결됨 ({previewId})
                          </p>
                          <p className="text-gray-500">
                            대표 사진을 따로 올리지 않으면 이 영상의 썸네일이 자동으로 대표 사진으로 표시됩니다.
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCreateCommunityPost()}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
                  >
                    + 새 부서 소식 등록하기
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Registered Department News List Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-black text-[#1a2744]">
                  등록된 부서 소식 ({draft.communityPosts.length}건)
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["전체", ...COMMUNITY_DEPARTMENTS] as const).map(
                    (deptOpt) => (
                      <button
                        key={deptOpt}
                        type="button"
                        onClick={() => {
                          setCommunityDeptFilter(deptOpt);
                          if (deptOpt !== "전체") {
                            setNewCommDept(deptOpt);
                          }
                          setCommunityPage(1);
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                          communityDeptFilter === deptOpt
                            ? "bg-[#1a2744] text-white"
                            : "bg-[#F4F7F5] text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {deptOpt}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="search"
                  value={communitySearch}
                  onChange={(e) => {
                    setCommunitySearch(e.target.value);
                    setCommunityPage(1);
                  }}
                  placeholder="부서 소식 제목, 부서명, 내용 검색..."
                  className="flex-1 min-w-0 rounded-xl border border-gray-300 bg-[#F8FAF8] px-3.5 py-2 text-xs sm:text-sm"
                />
                {(communitySearch || communityDeptFilter !== "전체") && (
                  <button
                    type="button"
                    onClick={() => {
                      setCommunitySearch("");
                      setCommunityDeptFilter("전체");
                      setCommunityPage(1);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-700"
                  >
                    필터 초기화
                  </button>
                )}
              </div>

              {pagedCommunityPosts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  등록된 부서 소식이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                  {pagedCommunityPosts.map((post) => {
                    const isExpanded = expandedCommunityId === post.id;
                    const deptLabel = normalizeYouthDepartmentLabel(
                      post.department
                    );
                    return (
                      <div key={post.id} className="bg-white">
                        <div className="px-3.5 sm:px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 hover:bg-[#F8FAF8]/70 transition-colors">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-bold shrink-0">
                              {deptLabel}
                            </span>
                            {post.youtubeId && (
                              <span className="px-2 py-0.5 rounded bg-[#1a2744] text-white text-[10px] font-bold shrink-0">
                                영상
                              </span>
                            )}
                            <span className="text-sm font-bold text-[#1a2744] truncate">
                              {post.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <span className="text-xs text-gray-400">
                              {post.date}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCommunityId(
                                  isExpanded ? null : post.id
                                )
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                isExpanded
                                  ? "bg-[#1a2744] text-white"
                                  : "bg-[#F4F7F5] text-[#1a2744] hover:bg-gray-200"
                              }`}
                            >
                              {isExpanded ? "닫기 ▲" : "수정 ▼"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `"${post.title}" 부서 소식을 삭제하시겠습니까?`
                                  )
                                ) {
                                  return;
                                }
                                const nextContent: SiteContent = {
                                  ...draft,
                                  communityPosts: draft.communityPosts.filter(
                                    (p) => p.id !== post.id
                                  ),
                                };
                                void handleSave(
                                  nextContent,
                                  `"${post.title}" 부서 소식이 삭제되었습니다.`
                                );
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                            >
                              삭제
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 py-4 bg-[#F8FAF8] border-t border-gray-200 space-y-2.5">
                            <div className="grid sm:grid-cols-[auto_1fr_150px] gap-2">
                              <select
                                aria-label="부서 선택"
                                value={deptLabel}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    communityPosts: prev.communityPosts.map(
                                      (p) =>
                                        p.id === post.id
                                          ? {
                                              ...p,
                                              department: e.target
                                                .value as CommunityDepartment,
                                            }
                                          : p
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                              >
                                {COMMUNITY_DEPARTMENTS.map((dept) => (
                                  <option key={dept} value={dept}>
                                    {dept}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={post.title}
                                placeholder="제목"
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    communityPosts: prev.communityPosts.map(
                                      (p) =>
                                        p.id === post.id
                                          ? { ...p, title: e.target.value }
                                          : p
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-bold"
                              />
                              <input
                                type={
                                  /^\d{4}-\d{2}-\d{2}$/.test(post.date)
                                    ? "date"
                                    : "text"
                                }
                                value={post.date}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    communityPosts: prev.communityPosts.map(
                                      (p) =>
                                        p.id === post.id
                                          ? { ...p, date: e.target.value }
                                          : p
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                              />
                            </div>
                            <textarea
                              rows={3}
                              value={post.content}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  communityPosts: prev.communityPosts.map((p) =>
                                    p.id === post.id
                                      ? { ...p, content: e.target.value }
                                      : p
                                  ),
                                }))
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                                <input
                                  type="url"
                                  value={
                                    commYtInputDrafts[post.id] ??
                                    (post.youtubeId
                                      ? `https://youtu.be/${post.youtubeId}`
                                      : "")
                                  }
                                  onChange={(e) => {
                                    const rawInput = e.target.value;
                                    setCommYtInputDrafts((prev) => ({
                                      ...prev,
                                      [post.id]: rawInput,
                                    }));
                                    const trimmedVal = rawInput.trim();
                                    if (!trimmedVal) {
                                      updateDraft((prev) => ({
                                        ...prev,
                                        communityPosts: prev.communityPosts.map(
                                          (p) =>
                                            p.id === post.id
                                              ? { ...p, youtubeId: undefined }
                                              : p
                                        ),
                                      }));
                                      return;
                                    }
                                    const parsedYt =
                                      extractYoutubeId(trimmedVal);
                                    if (!parsedYt) {
                                      return;
                                    }
                                    updateDraft((prev) => ({
                                      ...prev,
                                      communityPosts: prev.communityPosts.map(
                                        (p) =>
                                          p.id === post.id
                                            ? {
                                                ...p,
                                                youtubeId: parsedYt,
                                                imageUrl:
                                                  !p.imageUrl ||
                                                  p.imageUrl ===
                                                    "/c01/cube-2.png" ||
                                                  p.imageUrl.startsWith(
                                                    "https://i.ytimg.com/vi/"
                                                  )
                                                    ? `https://i.ytimg.com/vi/${parsedYt}/hqdefault.jpg`
                                                    : p.imageUrl,
                                              }
                                            : p
                                      ),
                                    }));
                                  }}
                                  placeholder="유튜브 영상 링크 붙여넣기 (선택)"
                                  className="flex-1 min-w-[200px] rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                                />
                                <label className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 font-bold cursor-pointer">
                                  대표 사진 변경
                                  <input
                                    type="file"
                                    accept={ADMIN_IMAGE_ACCEPT}
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = "";
                                      if (!file) return;
                                      const uploaded = await uploadAsset(
                                        file,
                                        "gallery",
                                        file.name
                                      );
                                      if (uploaded) {
                                        updateDraft((prev) => ({
                                          ...prev,
                                          communityPosts:
                                            prev.communityPosts.map((p) =>
                                              p.id === post.id
                                                ? {
                                                    ...p,
                                                    imageUrl: uploaded.url,
                                                  }
                                                : p
                                            ),
                                        }));
                                      }
                                    }}
                                  />
                                </label>
                                {post.imageUrl && (
                                  <span className="text-[#2E7D32] font-semibold">
                                    대표 사진 등록됨
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                  const rawDraftYt = (
                                    commYtInputDrafts[post.id] ?? ""
                                  ).trim();
                                  if (
                                    rawDraftYt &&
                                    !extractYoutubeId(rawDraftYt)
                                  ) {
                                    setErrorMessage(
                                      "올바른 유튜브 영상 주소를 입력해 주세요. (예: https://youtu.be/... 또는 https://www.youtube.com/watch?v=...)"
                                    );
                                    return;
                                  }
                                  setExpandedCommunityId(null);
                                  void handleSave(
                                    draft,
                                    `"${post.title}" 부서 소식 수정사항이 저장되었습니다.`
                                  );
                                }}
                                className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                              >
                                수정 내용 저장
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
                currentPage={safeCommunityPage}
                totalItems={filteredCommunityPosts.length}
                pageSize={communityPageSize}
                onPageChange={setCommunityPage}
                onPageSizeChange={setCommunityPageSize}
                itemUnit="건"
              />
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: GALLERY ALBUMS (NEW ALBUM + ALBUM LIST)
           ========================================================= */}
        {activeTab === "gallery" && (
          <div className="space-y-6">
            {/* 1. Create New Gallery Album */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                  새 앨범 등록
                </h2>
                <Link
                  href="/news/gallery"
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  앨범 화면 보기 ↗
                </Link>
              </div>

              <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3">
                  <input
                    type="text"
                    placeholder="앨범 제목 (예: 추수감사주일 예배 및 애찬)"
                    value={newAlbumTitle}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setNewAlbumTitle(nextVal);
                      if (!newAlbumTagsTouched && nextVal.trim()) {
                        setNewAlbumTagsText(
                          inferGalleryTagsFromTitle(nextVal).join(", ")
                        );
                      }
                    }}
                    className="min-w-0 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold"
                  />
                  <input
                    type="date"
                    aria-label="앨범 게시일"
                    value={newAlbumDate}
                    onChange={(e) => setNewAlbumDate(e.target.value)}
                    className="min-w-0 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-600 mb-1.5">
                    분류 태그 선택
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_GALLERY_TAGS.map((tag) => {
                      const currentSelected = parseTagsText(newAlbumTagsText);
                      const isSelected = currentSelected.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setNewAlbumTagsTouched(true);
                            const next = toggleGalleryTag(currentSelected, tag);
                            setNewAlbumTagsText(next.join(", "));
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                            isSelected
                              ? "bg-[#2E7D32] text-white"
                              : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <textarea
                  rows={3}
                  placeholder="앨범 설명 본문 (선택)"
                  value={newAlbumContent}
                  onChange={(e) => setNewAlbumContent(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed"
                />

                <label
                  className={`block w-full sm:w-auto sm:inline-block px-5 py-3 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black text-center cursor-pointer transition-colors ${
                    creatingAlbum ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  {creatingAlbum
                    ? "업로드 중..."
                    : "+ 사진 또는 동영상 선택 후 등록"}
                  <input
                    type="file"
                    multiple
                    accept={ADMIN_GALLERY_MEDIA_ACCEPT}
                    className="hidden"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      await handleCreateGalleryAlbum(files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            {/* 2. Unified Church Album List Management */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-black text-[#1a2744] break-keep">
                  등록된 앨범 ({legacyAlbums.length}개, 공개{" "}
                  {visibleLegacyAlbumsCount}개, 총 {totalLegacyPhotosCount}개)
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshLegacyAlbums()}
                    className="px-3.5 py-1.5 rounded-full border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap shrink-0"
                  >
                    새로고침
                  </button>
                  <Link
                    href="/news/gallery"
                    target="_blank"
                    className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                  >
                    앨범 화면 보기 ↗
                  </Link>
                </div>
              </div>

              {/* Search & Visibility Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAF8] p-3.5 rounded-xl border border-gray-200">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["전체", "공개중", "숨김"] as const).map((vis) => (
                    <button
                      key={vis}
                      type="button"
                      onClick={() => {
                        setLegacyVisibilityFilter(vis);
                        setLegacyPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                        legacyVisibilityFilter === vis
                          ? "bg-[#1a2744] text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {vis}
                    </button>
                  ))}
                  <span className="text-xs font-semibold text-gray-500 ml-1">
                    조회 {filteredLegacyAlbums.length}개
                  </span>
                </div>

                <div className="flex items-center gap-2 min-w-0 sm:w-80">
                  <input
                    type="search"
                    value={legacySearch}
                    onChange={(e) => {
                      setLegacySearch(e.target.value);
                      setLegacyPage(1);
                    }}
                    placeholder="앨범 제목, 날짜, #태그 검색..."
                    className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs sm:text-sm"
                  />
                  {legacySearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setLegacySearch("");
                        setLegacyPage(1);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs font-bold whitespace-nowrap shrink-0"
                    >
                      지우기
                    </button>
                  )}
                </div>
              </div>

              {legacyAlbums.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
                  등록된 앨범이 아직 없습니다.
                </div>
              ) : filteredLegacyAlbums.length === 0 ? (
                <div className="rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">
                  검색 조건에 일치하는 앨범이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedLegacyAlbums.map((album) => {
                    const currentTagsText = Array.isArray(album.tags)
                      ? album.tags.join(", ")
                      : "";
                    const originalContent = (album.content ?? "").trim();
                    const editState = legacyEditDrafts[album.id] ?? {
                      title: album.title,
                      content: album.content ?? "",
                      date: album.date,
                      tagsText: currentTagsText,
                    };
                    const parsedDraftTags = parseTagsText(editState.tagsText);
                    const normalizedOriginalTags = Array.isArray(album.tags)
                      ? album.tags
                      : [];
                    const tagsChanged =
                      parsedDraftTags.length !== normalizedOriginalTags.length ||
                      parsedDraftTags.some(
                        (t, idx) => t !== normalizedOriginalTags[idx]
                      );
                    const hasAlbumEdits =
                      editState.title.trim() !== album.title ||
                      editState.content.trim() !== originalContent ||
                      editState.date.trim() !== album.date ||
                      tagsChanged;
                    const isExpanded = expandedAlbumId === album.id;
                    const isBusy = legacyBusyId === album.id;
                    const coverSrc =
                      album.coverImageUrl || album.photos[0]?.imageUrl || "";

                    return (
                      <div
                        key={album.id}
                        className={`rounded-2xl border p-4 space-y-3.5 min-w-0 transition-colors ${
                          album.isVisible
                            ? "border-gray-200 bg-white"
                            : "border-gray-200 bg-gray-50/80"
                        }`}
                      >
                        <div className="flex flex-col xl:flex-row xl:items-center gap-3.5 min-w-0">
                          {/* Cover Preview + Status Badges */}
                          <div className="flex items-center gap-3 min-w-0 xl:w-64 shrink-0">
                            <div className="w-20 h-15 rounded-xl bg-gray-100 overflow-hidden border border-gray-200 shrink-0">
                              {coverSrc &&
                                (isVideoAssetUrl(coverSrc) ? (
                                  <video
                                    src={coverSrc}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <img
                                    src={coverSrc}
                                    alt={album.title}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                  />
                                ))}
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-black whitespace-nowrap shrink-0 ${
                                    album.isVisible
                                      ? "bg-[#E8F5E9] text-[#2E7D32]"
                                      : "bg-gray-200 text-gray-600"
                                  }`}
                                >
                                  {album.isVisible ? "공개중" : "숨김"}
                                </span>
                                <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap shrink-0">
                                  {album.photos.length}장
                                </span>
                                {originalContent.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#1a2744]/10 text-[#1a2744] text-[10px] font-bold whitespace-nowrap shrink-0">
                                    본문 있음
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-400 truncate">
                                게시일 {album.date}
                              </p>
                            </div>
                          </div>

                          {/* Inline Title / Date Inputs */}
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 flex-1 min-w-0">
                            <input
                              type="text"
                              value={editState.title}
                              aria-label={`${album.title} 앨범 제목`}
                              onChange={(e) =>
                                setLegacyEditDrafts((prev) => ({
                                  ...prev,
                                  [album.id]: {
                                    ...editState,
                                    title: e.target.value,
                                  },
                                }))
                              }
                              className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-[#1a2744]"
                            />
                            <input
                              type={
                                /^\d{4}-\d{2}-\d{2}$/.test(editState.date)
                                  ? "date"
                                  : "text"
                              }
                              value={editState.date}
                              aria-label={`${album.title} 게시일`}
                              placeholder="YYYY-MM-DD"
                              onChange={(e) =>
                                setLegacyEditDrafts((prev) => ({
                                  ...prev,
                                  [album.id]: {
                                    ...editState,
                                    date: e.target.value,
                                  },
                                }))
                              }
                              className="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold"
                            />
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={isBusy || !hasAlbumEdits}
                              onClick={() =>
                                void patchLegacyAlbumItem(
                                  album.id,
                                  {
                                    title: editState.title,
                                    content: editState.content,
                                    date: editState.date,
                                    tags: parsedDraftTags,
                                  },
                                  `앨범("${editState.title.trim()}") 제목과 본문 정보가 저장되었습니다.`
                                )
                              }
                              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                                hasAlbumEdits
                                  ? "bg-[#2E7D32] text-white hover:bg-[#1B5E20]"
                                  : "bg-gray-100 text-gray-400"
                              } disabled:opacity-60`}
                            >
                              정보 저장
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void patchLegacyAlbumItem(
                                  album.id,
                                  { isVisible: !album.isVisible },
                                  album.isVisible
                                    ? `"${album.title}" 앨범을 숨김 처리했습니다.`
                                    : `"${album.title}" 앨범을 다시 공개했습니다.`
                                )
                              }
                              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                                album.isVisible
                                  ? "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
                                  : "bg-[#1a2744] text-white hover:bg-[#2E7D32]"
                              } disabled:opacity-60`}
                            >
                              {album.isVisible ? "숨김으로 전환" : "공개로 전환"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedAlbumId(
                                  isExpanded ? null : album.id
                                )
                              }
                              className="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-[#1a2744] whitespace-nowrap shrink-0"
                            >
                              {isExpanded
                                ? "접기 ▲"
                                : `상세 보기 (${album.photos.length}개) ▼`}
                            </button>
                          </div>
                        </div>

                        {/* 1-Tap Preset Tag Chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {PRESET_GALLERY_TAGS.map((tag) => {
                            const selected = parsedDraftTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  const next = toggleGalleryTag(
                                    parsedDraftTags,
                                    tag
                                  );
                                  setLegacyEditDrafts((prev) => ({
                                    ...prev,
                                    [album.id]: {
                                      ...editState,
                                      tagsText: next.join(", "),
                                    },
                                  }));
                                }}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                                  selected
                                    ? "bg-[#2E7D32] text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                #{tag}
                              </button>
                            );
                          })}
                        </div>

                        {/* Inline Post Body Editor */}
                        <div>
                          <textarea
                            rows={2}
                            value={editState.content}
                            aria-label={`${album.title} 게시물 본문`}
                            placeholder="앨범 설명 본문 (선택)"
                            onChange={(e) =>
                              setLegacyEditDrafts((prev) => ({
                                ...prev,
                                [album.id]: {
                                  ...editState,
                                  content: e.target.value,
                                },
                              }))
                            }
                            className="w-full rounded-xl border border-gray-200 bg-[#F8FAF8] focus:bg-white px-3.5 py-2 text-xs sm:text-sm leading-relaxed text-gray-800 focus:border-[#2E7D32] focus:outline-none"
                          />
                        </div>

                        {/* Expanded Photos Drawer */}
                        {isExpanded && (
                          <div className="pt-3 border-t border-gray-100 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `"${album.title}" 앨범 전체를 삭제하시겠습니까?`
                                    )
                                  ) {
                                    return;
                                  }
                                  void deleteEntireLegacyAlbum(
                                    album.id,
                                    album.title
                                  );
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-bold"
                              >
                                앨범 전체 삭제
                              </button>
                              <label className="px-3.5 py-2 rounded-lg bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors">
                                + 사진 및 영상 추가
                                <input
                                  type="file"
                                  multiple
                                  accept={ADMIN_GALLERY_MEDIA_ACCEPT}
                                  className="hidden"
                                  onChange={async (e) => {
                                    const files = e.target.files;
                                    if (!files || files.length === 0) return;
                                    await handleAppendPhotosToAlbum(album, files);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            </div>
                            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                              {album.photos.map((photo, idx) => {
                                const inHeroCube = draft.gallery.some(
                                  (g) =>
                                    g.imageUrl === photo.imageUrl &&
                                    Boolean(g.showInHeroCube)
                                );
                                const isCover =
                                  album.coverImageUrl === photo.imageUrl;

                                return (
                                  <div
                                    key={photo.id}
                                    className="rounded-xl border border-gray-200 bg-[#F8FAF8] overflow-hidden flex flex-col min-w-0"
                                  >
                                    <div className="relative aspect-[4/3] bg-gray-100">
                                      {isVideoAssetUrl(photo.imageUrl) ? (
                                        <video
                                          src={photo.imageUrl}
                                          muted
                                          playsInline
                                          preload="metadata"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <img
                                          src={photo.imageUrl}
                                          alt={
                                            photo.caption ||
                                            `${album.title} ${idx + 1}`
                                          }
                                          loading="lazy"
                                          className="w-full h-full object-cover"
                                        />
                                      )}
                                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
                                        {isVideoAssetUrl(photo.imageUrl)
                                          ? "▶ 영상"
                                          : `#${idx + 1}`}
                                      </span>
                                      {isCover && (
                                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#2E7D32] text-white text-[10px] font-bold">
                                          대표표지
                                        </span>
                                      )}
                                    </div>
                                    <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between min-w-0">
                                      <p className="text-[11px] text-gray-600 line-clamp-1">
                                        {photo.caption || `${album.title} (${idx + 1})`}
                                      </p>
                                      <div className="space-y-1.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleAddLegacyPhotoToCube(
                                              album,
                                              photo
                                            )
                                          }
                                          className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap transition-colors ${
                                            inHeroCube
                                              ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/40"
                                              : "bg-[#1a2744] hover:bg-[#2E7D32] text-white"
                                          }`}
                                        >
                                          {inHeroCube
                                            ? "✓ 메인 3D 큐브 등록됨"
                                            : "메인 3D 큐브로 추가"}
                                        </button>
                                        <div className="flex items-center justify-between gap-1">
                                          {!isCover ? (
                                            <button
                                              type="button"
                                              disabled={isBusy}
                                              onClick={() =>
                                                void patchLegacyAlbumItem(
                                                  album.id,
                                                  {
                                                    coverImageUrl:
                                                      photo.imageUrl,
                                                  },
                                                  `"${album.title}" 앨범의 대표 표지 사진이 변경되었습니다.`
                                                )
                                              }
                                              className="flex-1 px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-100 text-[10px] font-bold text-gray-700 whitespace-nowrap"
                                            >
                                              표지 지정
                                            </button>
                                          ) : (
                                            <span className="text-[10px] font-bold text-[#2E7D32] px-1">
                                              현재 표지
                                            </span>
                                          )}
                                          {album.photos.length > 1 && (
                                            <button
                                              type="button"
                                              disabled={isBusy}
                                              onClick={() =>
                                                void removeLegacyPhotoItem(
                                                  album.id,
                                                  photo.id
                                                )
                                              }
                                              className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-[10px] font-bold text-red-600 whitespace-nowrap shrink-0"
                                            >
                                              제외
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Album Admin Pagination (10 per page) */}
              {totalLegacyPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-500">
                    페이지 {safeLegacyPage} / {totalLegacyPages} (페이지당 {LEGACY_ADMIN_PER_PAGE}개)
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeLegacyPage <= 1}
                      onClick={() => setLegacyPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-[#1a2744] disabled:opacity-40 whitespace-nowrap shrink-0"
                    >
                      ← 이전
                    </button>
                    {Array.from(
                      { length: totalLegacyPages },
                      (_, idx) => idx + 1
                    ).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setLegacyPage(pageNum)}
                        className={`min-w-[34px] px-2.5 py-1.5 rounded-lg text-xs font-black shrink-0 ${
                          pageNum === safeLegacyPage
                            ? "bg-[#1a2744] text-white"
                            : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={safeLegacyPage >= totalLegacyPages}
                      onClick={() =>
                        setLegacyPage((p) => Math.min(totalLegacyPages, p + 1))
                      }
                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-[#1a2744] disabled:opacity-40 whitespace-nowrap shrink-0"
                    >
                      다음 →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            SYSTEM: ADMIN-ONLY HOMEPAGE 3D ROTATING CUBE SETTINGS
           ========================================================= */}
        {activeTab === "hero-cube" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                    새 3D 큐브 사진 등록
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    홈페이지 첫 화면 회전 큐브에 노출할 사진 6장을 지정합니다.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => selectAdminTab("gallery")}
                    className="px-3.5 py-1.5 rounded-full bg-[#F8FAF8] border border-gray-300 hover:border-[#2E7D32] text-xs font-bold text-[#1a2744] whitespace-nowrap"
                  >
                    앨범에서 고르기 →
                  </button>
                  <Link
                    href="/"
                    target="_blank"
                    className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                  >
                    메인 화면 보기 ↗
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 items-center bg-[#F8FAF8] p-4 rounded-xl border border-gray-200">
                <input
                  type="text"
                  placeholder="사진 설명 (예: 본당 주일예배)"
                  value={newPhotoTitle}
                  onChange={(e) => setNewPhotoTitle(e.target.value)}
                  className="min-w-0 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold"
                />
                <input
                  type="date"
                  aria-label="사진 일자"
                  value={newPhotoDate}
                  onChange={(e) => setNewPhotoDate(e.target.value)}
                  className="min-w-0 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                />
                <label className="px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black text-center cursor-pointer whitespace-nowrap shrink-0 transition-colors">
                  + 사진 선택 후 등록
                  <input
                    type="file"
                    accept={ADMIN_IMAGE_ACCEPT}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const uploaded = await uploadAsset(
                        file,
                        "gallery",
                        file.name
                      );
                      if (uploaded) {
                        const created: GalleryPhoto = {
                          id: createClientSafeId("gal-cube"),
                          title:
                            newPhotoTitle.trim() ||
                            file.name.replace(/\.[^.]+$/, ""),
                          date: newPhotoDate,
                          imageUrl: uploaded.url,
                          showInHeroCube: true,
                        };
                        const nextContent: SiteContent = {
                          ...draft,
                          gallery: [created, ...draft.gallery],
                        };
                        setNewPhotoTitle("");
                        await handleSave(
                          nextContent,
                          `"${created.title}" 사진이 메인 3D 큐브에 등록되었습니다.`
                        );
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black text-[#1a2744]">
                  등록된 3D 큐브 사진 ({heroCubeCount}/6면 활성)
                </h3>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void handleSave(draft, "메인 3D 큐브 설정이 저장되었습니다.")
                  }
                  className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                >
                  큐브 설정 저장
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {draft.gallery.map((photo) => (
                  <div
                    key={photo.id}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs min-w-0"
                  >
                    <div className="aspect-[4/3] bg-gray-100 relative">
                      <img
                        src={photo.imageUrl}
                        alt={photo.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {photo.showInHeroCube && (
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-[#2E7D32]/95 text-white text-[11px] font-bold">
                          메인 3D 큐브 활성
                        </span>
                      )}
                    </div>
                    <div className="p-4 space-y-2.5 min-w-0">
                      <input
                        type="text"
                        value={photo.title}
                        aria-label="큐브 사진 설명"
                        onChange={(e) =>
                          updateDraft((prev) => ({
                            ...prev,
                            gallery: prev.gallery.map((p) =>
                              p.id === photo.id
                                ? { ...p, title: e.target.value }
                                : p
                            ),
                          }))
                        }
                        className="w-full min-w-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm font-bold"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-[#2E7D32] cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={Boolean(photo.showInHeroCube)}
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                gallery: prev.gallery.map((p) =>
                                  p.id === photo.id
                                    ? { ...p, showInHeroCube: e.target.checked }
                                    : p
                                ),
                              }))
                            }
                            className="shrink-0"
                          />
                          <span className="truncate">메인 3D 큐브에 노출</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `"${photo.title}" 사진을 큐브 목록에서 제외하시겠습니까?`
                              )
                            ) {
                              return;
                            }
                            const nextContent: SiteContent = {
                              ...draft,
                              gallery: draft.gallery.filter(
                                (p) => p.id !== photo.id
                              ),
                            };
                            void handleSave(
                              nextContent,
                              `"${photo.title}" 사진이 큐브 목록에서 제외되었습니다.`
                            );
                          }}
                          className="px-2.5 py-1 rounded bg-red-50 text-red-600 text-xs font-bold whitespace-nowrap shrink-0 hover:bg-red-100"
                        >
                          목록 제외
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: SENIOR PASTOR BIOGRAPHY (EDUCATION & CAREER)
           ========================================================= */}
        {activeTab === "pastor-bio" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                담임목사 약력
              </h2>
              <Link
                href="/about"
                target="_blank"
                className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
              >
                인사말 화면 보기 ↗
              </Link>
            </div>

              {/* 학력 관리 */}
              <div className="space-y-2.5">
                <label className="block text-sm font-black text-[#1a2744]">
                  학력 목록 ({draft.pastorProfile.education.length}건)
                </label>
                {draft.pastorProfile.education.map((edu, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={edu}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          pastorProfile: {
                            ...prev.pastorProfile,
                            education: prev.pastorProfile.education.map(
                              (item, i) => (i === idx ? e.target.value : item)
                            ),
                          },
                        }))
                      }
                      className="flex-1 min-w-0 rounded-xl border border-gray-300 px-3.5 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          pastorProfile: {
                            ...prev.pastorProfile,
                            education: prev.pastorProfile.education.filter(
                              (_, i) => i !== idx
                            ),
                          },
                        }))
                      }
                      className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold whitespace-nowrap shrink-0"
                    >
                      삭제
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="새 학력 입력 (예: 총신대학교 신학대학원 졸업)"
                    value={newEduText}
                    onChange={(e) => setNewEduText(e.target.value)}
                    className="flex-1 min-w-0 rounded-xl border border-dashed border-[#2E7D32] bg-[#F8FAF8] px-3.5 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newEduText.trim()) return;
                      updateDraft((prev) => ({
                        ...prev,
                        pastorProfile: {
                          ...prev.pastorProfile,
                          education: [
                            ...prev.pastorProfile.education,
                            newEduText.trim(),
                          ],
                        },
                      }));
                      setNewEduText("");
                    }}
                    className="px-4 py-2 rounded-xl bg-[#2E7D32] text-white text-xs font-bold whitespace-nowrap shrink-0"
                  >
                    + 학력 추가
                  </button>
                </div>
              </div>

              {/* 경력 관리 */}
              <div className="space-y-2.5 pt-4 border-t border-gray-100">
                <label className="block text-sm font-black text-[#1a2744]">
                  경력 및 사역 이력 ({draft.pastorProfile.career.length}건)
                </label>
                {draft.pastorProfile.career.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <select
                      value={item.status}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          pastorProfile: {
                            ...prev.pastorProfile,
                            career: prev.pastorProfile.career.map((c) =>
                              c.id === item.id
                                ? { ...c, status: e.target.value as "현" | "전" }
                                : c
                            ),
                          },
                        }))
                      }
                      className="rounded-xl border border-gray-300 px-2.5 py-2 text-xs font-bold shrink-0"
                    >
                      <option value="현">현)</option>
                      <option value="전">전)</option>
                    </select>
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          pastorProfile: {
                            ...prev.pastorProfile,
                            career: prev.pastorProfile.career.map((c) =>
                              c.id === item.id
                                ? { ...c, label: e.target.value }
                                : c
                            ),
                          },
                        }))
                      }
                      className="flex-1 min-w-0 rounded-xl border border-gray-300 px-3.5 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          pastorProfile: {
                            ...prev.pastorProfile,
                            career: prev.pastorProfile.career.filter(
                              (c) => c.id !== item.id
                            ),
                          },
                        }))
                      }
                      className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold whitespace-nowrap shrink-0"
                    >
                      삭제
                    </button>
                  </div>
                ))}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <select
                      value={newCareerStatus}
                      onChange={(e) =>
                        setNewCareerStatus(e.target.value as "현" | "전")
                      }
                      className="rounded-xl border border-[#2E7D32] bg-[#F8FAF8] px-2.5 py-2 text-xs font-bold shrink-0"
                    >
                      <option value="현">현)</option>
                      <option value="전">전)</option>
                    </select>
                    <input
                      type="text"
                      placeholder="새 경력 입력 (예: 일광교회 담임목사)"
                      value={newCareerText}
                      onChange={(e) => setNewCareerText(e.target.value)}
                      className="flex-1 min-w-0 rounded-xl border border-dashed border-[#2E7D32] bg-[#F8FAF8] px-3.5 py-2 text-sm"
                    />
                  </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newCareerText.trim()) return;
                        const entry: CareerEntry = {
                          id: createClientSafeId("career"),
                          status: newCareerStatus,
                          label: newCareerText.trim(),
                        };
                        updateDraft((prev) => ({
                          ...prev,
                          pastorProfile: {
                            ...prev.pastorProfile,
                            career: [...prev.pastorProfile.career, entry],
                          },
                        }));
                        setNewCareerText("");
                      }}
                      className="px-4 py-2 rounded-xl bg-[#2E7D32] text-white text-xs font-bold whitespace-nowrap shrink-0"
                    >
                      + 경력 추가
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void handleSave(draft, "담임목사 약력이 저장되었습니다.")
                    }
                    className="px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black transition-colors disabled:opacity-60"
                  >
                    약력 저장하기
                  </button>
                </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: SENIOR PASTOR GREETING & PORTRAIT
           ========================================================= */}
        {activeTab === "greeting" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                인사말
              </h2>
              <Link
                href="/about"
                target="_blank"
                className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
              >
                인사말 화면 보기 ↗
              </Link>
            </div>

            <div className="flex items-center gap-4 bg-[#F8FAF8] p-3.5 rounded-xl border border-gray-200">
              <img
                src={draft.pastorProfile.photoUrl}
                alt={draft.pastorProfile.name}
                className="w-24 aspect-[4/3] rounded-xl object-cover object-[68%_center] border border-gray-200 shrink-0"
              />
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-[#1a2744]">
                  담임목사 프로필 사진
                </p>
                <label className="inline-block px-3.5 py-1.5 rounded-lg bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs font-bold cursor-pointer">
                  새 사진 업로드
                  <input
                    type="file"
                    accept={ADMIN_IMAGE_ACCEPT}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      const uploaded = await uploadAsset(
                        file,
                        "profiles",
                        file.name
                      );
                      if (uploaded) {
                        updateDraft((prev) => ({
                          ...prev,
                          pastorProfile: {
                            ...prev.pastorProfile,
                            photoUrl: uploaded.url,
                          },
                        }));
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  성함
                </label>
                <input
                  type="text"
                  value={draft.pastorProfile.name}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      pastorProfile: {
                        ...prev.pastorProfile,
                        name: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  서명 표기
                </label>
                <input
                  type="text"
                  value={draft.pastorProfile.displayName}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      pastorProfile: {
                        ...prev.pastorProfile,
                        displayName: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                인사말 제목
              </label>
              <input
                type="text"
                value={draft.pastorProfile.greetingTitle}
                onChange={(e) =>
                  updateDraft((prev) => ({
                    ...prev,
                    pastorProfile: {
                      ...prev.pastorProfile,
                      greetingTitle: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                인사말 문단 (빈 줄로 문단 구분)
              </label>
              <textarea
                rows={7}
                value={draft.pastorProfile.greetingBody.join("\n\n")}
                onChange={(e) =>
                  updateDraft((prev) => ({
                    ...prev,
                    pastorProfile: {
                      ...prev.pastorProfile,
                      greetingBody: e.target.value
                        .split(/\n{2,}/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  }))
                }
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm leading-relaxed"
              />
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave(draft, "인사말이 저장되었습니다.")}
                className="px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black transition-colors disabled:opacity-60"
              >
                인사말 저장하기
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: WORSHIP SCHEDULE (UNIFIED CREATION CARD + LIST)
           ========================================================= */}
        {activeTab === "worship" && (
          <div className="space-y-6">
            {/* 1. Create New Worship Service Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                  새 예배 안내 등록
                </h2>
                <Link
                  href="/worship"
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  예배 안내 화면 보기 ↗
                </Link>
              </div>

              <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      예배 명칭 *
                    </label>
                    <input
                      type="text"
                      value={newWorshipTitle}
                      onChange={(e) => setNewWorshipTitle(e.target.value)}
                      placeholder="예: 주일 1부 예배"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      예배 시간 *
                    </label>
                    <input
                      type="text"
                      value={newWorshipTime}
                      onChange={(e) => setNewWorshipTime(e.target.value)}
                      placeholder="예: 주일 오전 9:30"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      장소
                    </label>
                    <input
                      type="text"
                      value={newWorshipLocation}
                      onChange={(e) => setNewWorshipLocation(e.target.value)}
                      placeholder="예: 본당"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    예배 소개 문구
                  </label>
                  <textarea
                    rows={2}
                    value={newWorshipDesc}
                    onChange={(e) => setNewWorshipDesc(e.target.value)}
                    placeholder="예배 안내 화면에 표시할 소개 문구를 입력해 주세요."
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCreateWorshipItem()}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
                  >
                    + 새 예배 등록하기
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Registered Worship Schedule List Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black text-[#1a2744]">
                  등록된 예배 시간표 ({draft.worshipSchedule.length}개)
                </h3>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void handleSave(draft, "예배 안내 시간표가 저장되었습니다.")
                  }
                  className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                >
                  시간표 저장하기
                </button>
              </div>
              {draft.worshipSchedule.map((svc) => (
                <div
                  key={svc.id}
                  className="rounded-xl border border-gray-200 p-3.5 space-y-2 bg-[#F8FAF8]/60"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={svc.title}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          worshipSchedule: prev.worshipSchedule.map((w) =>
                            w.id === svc.id
                              ? { ...w, title: e.target.value }
                              : w
                          ),
                        }))
                      }
                      className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-bold"
                    />
                    <input
                      type="text"
                      value={svc.time}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          worshipSchedule: prev.worshipSchedule.map((w) =>
                            w.id === svc.id
                              ? { ...w, time: e.target.value }
                              : w
                          ),
                        }))
                      }
                      className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      value={svc.location}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          worshipSchedule: prev.worshipSchedule.map((w) =>
                            w.id === svc.id
                              ? { ...w, location: e.target.value }
                              : w
                          ),
                        }))
                      }
                      className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-gray-500">
                      예배 소개 문구
                    </label>
                    <textarea
                      rows={2}
                      value={svc.description}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          worshipSchedule: prev.worshipSchedule.map((w) =>
                            w.id === svc.id
                              ? { ...w, description: e.target.value }
                              : w
                          ),
                        }))
                      }
                      placeholder="예배 안내 페이지에 표시할 소개 문구"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed focus:border-[#2E7D32] focus:outline-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `"${svc.title}" 예배 항목을 삭제하시겠습니까?`
                            )
                          ) {
                            return;
                          }
                          const nextContent: SiteContent = {
                            ...draft,
                            worshipSchedule: draft.worshipSchedule.filter(
                              (w) => w.id !== svc.id
                            ),
                          };
                          void handleSave(
                            nextContent,
                            `"${svc.title}" 예배 항목이 삭제되었습니다.`
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-bold whitespace-nowrap shrink-0 hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: SERVING PEOPLE (UNIFIED CREATION CARD + LIST)
           ========================================================= */}
        {activeTab === "staff" && (
          <div className="space-y-6">
            {/* 1. Create New Serving Person Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                  새 섬기는 분 등록
                </h2>
                <Link
                  href="/about/pastor"
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  섬기는 사람들 화면 보기 ↗
                </Link>
              </div>

              <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      성함 및 직함 *
                    </label>
                    <input
                      type="text"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="예: 홍길동 목사"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      직분 구분
                    </label>
                    <input
                      type="text"
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value)}
                      placeholder="예: 부교역자, 장로"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      담당 사역 (쉼표로 구분)
                    </label>
                    <input
                      type="text"
                      value={newStaffDeptsText}
                      onChange={(e) => setNewStaffDeptsText(e.target.value)}
                      placeholder="예: 청년부, 찬양사역"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    사역 소개 문구
                  </label>
                  <textarea
                    rows={2}
                    value={newStaffDesc}
                    onChange={(e) => setNewStaffDesc(e.target.value)}
                    placeholder="담당 사역과 소개 문구를 입력해 주세요."
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 font-bold text-gray-700 cursor-pointer">
                      프로필 사진 선택 (선택)
                      <input
                        type="file"
                        accept={ADMIN_IMAGE_ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          const objectUrl = URL.createObjectURL(file);
                          setStaffCropSession((prev) => {
                            if (prev?.revokeOnClose) {
                              URL.revokeObjectURL(prev.imageSrc);
                            }
                            return {
                              sessionKey: createClientSafeId("crop"),
                              staffId: "__new_staff__",
                              staffName: newStaffName.trim() || "새 사역자",
                              imageSrc: objectUrl,
                              sourceFileName: file.name,
                              revokeOnClose: true,
                            };
                          });
                        }}
                      />
                    </label>
                    {newStaffPhotoUrl && (
                      <span className="inline-flex items-center gap-2 text-[#2E7D32] font-bold">
                        <img
                          src={newStaffPhotoUrl}
                          alt="새 프로필 사진 미리보기"
                          className="w-6 h-8 rounded-xs object-cover border border-gray-200"
                        />
                        <span>사진 준비됨</span>
                        <button
                          type="button"
                          onClick={() => setNewStaffPhotoUrl("")}
                          className="text-red-600 underline"
                        >
                          해제
                        </button>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCreateStaffMember()}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
                  >
                    + 새 섬기는 분 등록하기
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Registered Serving People List Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black text-[#1a2744]">
                  등록된 섬기는 사람들 ({draft.staff.length}명)
                </h3>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void handleSave(draft, "섬기는 사람들 정보가 저장되었습니다.")
                  }
                  className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                >
                  변경사항 저장
                </button>
              </div>
            {draft.staff.map((person, staffIndex) => {
              const deptTags = parseStaffDepartments(person);
              const isDeptInputOpen = openDeptInputStaffId === person.id;
              const pendingDeptValue = staffDeptDrafts[person.id] ?? "";
              const isDraggingThis = draggingStaffId === person.id;
              const isDragTarget =
                dragOverStaffId === person.id && draggingStaffId !== person.id;

              return (
                <div
                  key={person.id}
                  draggable={armedDragStaffId === person.id}
                  onDragStart={(e) => {
                    if (draggingStaffTag || armedDragStaffId !== person.id) {
                      e.preventDefault();
                      return;
                    }
                    setDraggingStaffId(person.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("application/x-staff-card", person.id);
                  }}
                  onDragOver={(e) => {
                    if (
                      draggingStaffTag ||
                      !draggingStaffId ||
                      draggingStaffId === person.id
                    ) {
                      return;
                    }
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverStaffId !== person.id) {
                      setDragOverStaffId(person.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (
                      !e.currentTarget.contains(e.relatedTarget as Node | null) &&
                      dragOverStaffId === person.id
                    ) {
                      setDragOverStaffId(null);
                    }
                  }}
                  onDrop={(e) => {
                    if (draggingStaffTag) {
                      return;
                    }
                    const sourceId =
                      draggingStaffId ||
                      e.dataTransfer.getData("application/x-staff-card");
                    if (!sourceId) {
                      return;
                    }
                    e.preventDefault();
                    reorderStaffById(sourceId, person.id);
                    setDraggingStaffId(null);
                    setDragOverStaffId(null);
                    setArmedDragStaffId(null);
                  }}
                  onDragEnd={() => {
                    setDraggingStaffId(null);
                    setDragOverStaffId(null);
                    setArmedDragStaffId(null);
                  }}
                  className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                    isDraggingThis
                      ? "opacity-55 border-[#2E7D32] bg-[#F8FAF8]"
                      : isDragTarget
                        ? "border-[#2E7D32] ring-2 ring-[#2E7D32]/30 bg-[#F8FAF8]"
                        : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        onMouseDown={() => setArmedDragStaffId(person.id)}
                        onMouseUp={() => setArmedDragStaffId(null)}
                        onTouchStart={() => setArmedDragStaffId(person.id)}
                        onTouchEnd={() => setArmedDragStaffId(null)}
                        title="드래그하여 표시 순서 변경"
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 hover:bg-[#E8F5E9] text-gray-700 hover:text-[#1B5E20] text-[11px] font-bold cursor-grab active:cursor-grabbing select-none transition-colors shrink-0"
                      >
                        <span
                          aria-hidden="true"
                          className="text-xs leading-none tracking-tighter text-gray-400"
                        >
                          ⋮⋮
                        </span>
                        <span>{staffIndex + 1}번째 표시</span>
                      </span>
                      <span className="text-[11px] text-gray-400 truncate hidden sm:inline">
                        드래그 이동 가능
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={staffIndex === 0}
                        onClick={() =>
                          moveStaffMember(staffIndex, staffIndex - 1)
                        }
                        aria-label={`${person.name || "사역자"} 위로 이동`}
                        className="px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-[11px] font-bold text-gray-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                      >
                        ▲ 위로
                      </button>
                      <button
                        type="button"
                        disabled={staffIndex === draft.staff.length - 1}
                        onClick={() =>
                          moveStaffMember(staffIndex, staffIndex + 1)
                        }
                        aria-label={`${person.name || "사역자"} 아래로 이동`}
                        className="px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-[11px] font-bold text-gray-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                      >
                        ▼ 아래로
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-[0.88fr_0.65fr_1.67fr] gap-2.5 items-start">
                    <div>
                      <span className="block text-[11px] font-bold text-gray-500 mb-1">
                        성함 및 직함
                      </span>
                      <input
                        type="text"
                        value={person.name}
                        placeholder="예: 이준형 강도사"
                        onChange={(e) =>
                          updateDraft((prev) => ({
                            ...prev,
                            staff: prev.staff.map((p) =>
                              p.id === person.id
                                ? { ...p, name: e.target.value }
                                : p
                            ),
                          }))
                        }
                        className="w-full h-[38px] rounded-lg border border-gray-300 px-2.5 text-sm font-bold text-[#1a2744] focus:outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/15"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-gray-500 mb-1">
                        직분 구분
                      </span>
                      <input
                        type="text"
                        value={person.role}
                        placeholder="예: 담임목사, 부교역자, 장로"
                        onChange={(e) =>
                          updateDraft((prev) => ({
                            ...prev,
                            staff: prev.staff.map((p) =>
                              p.id === person.id
                                ? { ...p, role: e.target.value }
                                : p
                            ),
                          }))
                        }
                        className="w-full h-[38px] rounded-lg border border-gray-300 px-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/15"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-gray-500 mb-1">
                        담당 사역 태그
                      </span>
                      <div
                        onDragOver={(e) => {
                          if (
                            !draggingStaffTag ||
                            draggingStaffTag.staffId !== person.id
                          ) {
                            return;
                          }
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          let sourceStaffId = draggingStaffTag?.staffId ?? "";
                          let sourceTag = draggingStaffTag?.tag ?? "";
                          if (!sourceStaffId || !sourceTag) {
                            const raw = e.dataTransfer.getData(
                              "application/x-staff-tag"
                            );
                            if (raw) {
                              try {
                                const parsed = JSON.parse(raw) as {
                                  readonly staffId?: string;
                                  readonly tag?: string;
                                };
                                sourceStaffId = parsed.staffId ?? "";
                                sourceTag = parsed.tag ?? "";
                              } catch {
                                // Ignore malformed drag payload
                              }
                            }
                          }
                          if (sourceStaffId !== person.id || !sourceTag) {
                            return;
                          }
                          e.preventDefault();
                          e.stopPropagation();
                          moveStaffDepartmentTagToEnd(person.id, sourceTag);
                          setDraggingStaffTag(null);
                          setDragOverStaffTag(null);
                        }}
                        className="min-h-[38px] rounded-lg border border-gray-300 bg-white px-2 py-1 flex flex-wrap items-center gap-1.5 focus-within:border-[#2E7D32] focus-within:ring-2 focus-within:ring-[#2E7D32]/15 transition-colors"
                      >
                        {deptTags.map((tag) => {
                          const isDraggingThisTag =
                            draggingStaffTag?.staffId === person.id &&
                            draggingStaffTag.tag === tag;
                          const isDragOverThisTag =
                            dragOverStaffTag?.staffId === person.id &&
                            dragOverStaffTag.tag === tag &&
                            !isDraggingThisTag;

                          return (
                            <span
                              key={`${person.id}-dept-${tag}`}
                              draggable
                              title="드래그하여 태그 순서 변경"
                              onDragStart={(e) => {
                                if (
                                  (e.target as HTMLElement).closest("button")
                                ) {
                                  e.preventDefault();
                                  return;
                                }
                                e.stopPropagation();
                                setDraggingStaffTag({
                                  staffId: person.id,
                                  tag,
                                });
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData(
                                  "application/x-staff-tag",
                                  JSON.stringify({ staffId: person.id, tag })
                                );
                              }}
                              onDragOver={(e) => {
                                const isSamePersonDrag =
                                  draggingStaffTag?.staffId === person.id ||
                                  e.dataTransfer.types.includes(
                                    "application/x-staff-tag"
                                  );
                                if (!isSamePersonDrag) {
                                  return;
                                }
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = "move";
                                if (
                                  draggingStaffTag?.staffId === person.id &&
                                  draggingStaffTag.tag !== tag &&
                                  (dragOverStaffTag?.staffId !== person.id ||
                                    dragOverStaffTag.tag !== tag)
                                ) {
                                  setDragOverStaffTag({
                                    staffId: person.id,
                                    tag,
                                  });
                                }
                              }}
                              onDragLeave={(e) => {
                                e.stopPropagation();
                                if (
                                  !e.currentTarget.contains(
                                    e.relatedTarget as Node | null
                                  ) &&
                                  dragOverStaffTag?.staffId === person.id &&
                                  dragOverStaffTag.tag === tag
                                ) {
                                  setDragOverStaffTag(null);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                let sourceStaffId =
                                  draggingStaffTag?.staffId ?? "";
                                let sourceTag = draggingStaffTag?.tag ?? "";
                                if (!sourceStaffId || !sourceTag) {
                                  const raw = e.dataTransfer.getData(
                                    "application/x-staff-tag"
                                  );
                                  if (raw) {
                                    try {
                                      const parsed = JSON.parse(raw) as {
                                        readonly staffId?: string;
                                        readonly tag?: string;
                                      };
                                      sourceStaffId = parsed.staffId ?? "";
                                      sourceTag = parsed.tag ?? "";
                                    } catch {
                                      // Ignore malformed drag payload
                                    }
                                  }
                                }
                                if (
                                  sourceStaffId === person.id &&
                                  sourceTag &&
                                  sourceTag !== tag
                                ) {
                                  reorderStaffDepartmentTag(
                                    person.id,
                                    sourceTag,
                                    tag
                                  );
                                }
                                setDraggingStaffTag(null);
                                setDragOverStaffTag(null);
                              }}
                              onDragEnd={(e) => {
                                e.stopPropagation();
                                setDraggingStaffTag(null);
                                setDragOverStaffTag(null);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold select-none cursor-grab active:cursor-grabbing transition-all ${
                                isDraggingThisTag
                                  ? "opacity-45 bg-[#E8F5E9] text-[#1B5E20] border-[#2E7D32]"
                                  : isDragOverThisTag
                                    ? "bg-white text-[#1B5E20] border-[#2E7D32] ring-2 ring-[#2E7D32]/35 scale-[1.03]"
                                    : "bg-[#E8F5E9] text-[#1B5E20] border-[#2E7D32]/20 hover:border-[#2E7D32]/55"
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className="text-[10px] leading-none tracking-tighter text-[#2E7D32]/55"
                              >
                                ⋮⋮
                              </span>
                              <span>{tag}</span>
                              <button
                                type="button"
                                draggable={false}
                                onMouseDown={(e) => e.stopPropagation()}
                                onDragStart={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={() =>
                                  removeStaffDepartmentTag(person.id, tag)
                                }
                                aria-label={`${tag} 담당 사역 태그 삭제`}
                                title={`${tag} 삭제`}
                                className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[#2E7D32]/75 hover:bg-[#2E7D32] hover:text-white transition-colors text-[11px] leading-none cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}

                        {isDeptInputOpen ? (
                          <div className="inline-flex items-center gap-1 flex-1 min-w-[165px]">
                            <input
                              type="text"
                              autoFocus
                              value={pendingDeptValue}
                              placeholder="사역 입력 (예: 중고등부, 예배찬양)"
                              onChange={(e) =>
                                setStaffDeptDrafts((prev) => ({
                                  ...prev,
                                  [person.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (
                                  e.nativeEvent.isComposing ||
                                  e.keyCode === 229
                                ) {
                                  return;
                                }
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (pendingDeptValue.trim()) {
                                    commitStaffDepartmentTag(person.id);
                                  } else {
                                    setOpenDeptInputStaffId(null);
                                  }
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setStaffDeptDrafts((prev) => ({
                                    ...prev,
                                    [person.id]: "",
                                  }));
                                  setOpenDeptInputStaffId(null);
                                } else if (
                                  e.key === "Backspace" &&
                                  !pendingDeptValue &&
                                  deptTags.length > 0
                                ) {
                                  e.preventDefault();
                                  removeStaffDepartmentTag(
                                    person.id,
                                    deptTags[deptTags.length - 1]
                                  );
                                }
                              }}
                              onBlur={() => {
                                commitStaffDepartmentTag(person.id);
                                setOpenDeptInputStaffId((curr) =>
                                  curr === person.id ? null : curr
                                );
                              }}
                              className="flex-1 min-w-0 bg-transparent px-1 py-0.5 text-xs text-[#1a2744] placeholder:text-gray-400 focus:outline-none"
                            />
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                commitStaffDepartmentTag(person.id);
                              }}
                              onClick={() => commitStaffDepartmentTag(person.id)}
                              className="px-2 py-0.5 rounded-md bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors"
                            >
                              + 추가
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                commitStaffDepartmentTag(person.id);
                                setOpenDeptInputStaffId(null);
                              }}
                              onClick={() => {
                                commitStaffDepartmentTag(person.id);
                                setOpenDeptInputStaffId(null);
                              }}
                              className="px-1.5 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors"
                            >
                              완료
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setOpenDeptInputStaffId(person.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed border-[#2E7D32]/55 bg-[#F8FAFC] hover:bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold transition-colors whitespace-nowrap"
                          >
                            {deptTags.length === 0
                              ? "+ 담당 사역 추가"
                              : "+ 사역 추가"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Full-width Ministry Description (Mobile-friendly) */}
                  <div>
                    <span className="block text-[11px] font-bold text-gray-500 mb-1">
                      사역 소개 문구
                    </span>
                    <textarea
                      rows={2}
                      value={person.description}
                      placeholder="사역 소개 문구를 입력해 주세요."
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          staff: prev.staff.map((p) =>
                            p.id === person.id
                              ? { ...p, description: e.target.value }
                              : p
                          ),
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/15"
                    />
                  </div>

                  {/* Photo & Delete Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {person.photoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            const existingUrl = person.photoUrl;
                            if (!existingUrl) return;
                            setStaffCropSession((prev) => {
                              if (prev?.revokeOnClose) {
                                URL.revokeObjectURL(prev.imageSrc);
                              }
                              return {
                                sessionKey: createClientSafeId("crop"),
                                staffId: person.id,
                                staffName: person.name || "사역자",
                                imageSrc: existingUrl,
                                sourceFileName: person.name || "staff-portrait",
                                revokeOnClose: false,
                              };
                            });
                          }}
                          title="현재 사진 크기 조절 및 크롭"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F8FAF8] hover:bg-[#E8F5E9] border border-[#2E7D32]/30 text-[#1B5E20] text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                        >
                          <img
                            src={person.photoUrl}
                            alt={person.name}
                            className={`w-6 h-8 rounded-xs object-cover border border-gray-200 shrink-0 ${
                              person.photoUrl === "/pastor.png"
                                ? "object-[68%_20%]"
                                : "object-center"
                            }`}
                          />
                          <span>사진 조절</span>
                        </button>
                      )}
                      <label className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors">
                        사진 업로드
                        <input
                          type="file"
                          accept={ADMIN_IMAGE_ACCEPT}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            const objectUrl = URL.createObjectURL(file);
                            setStaffCropSession((prev) => {
                              if (prev?.revokeOnClose) {
                                URL.revokeObjectURL(prev.imageSrc);
                              }
                              return {
                                sessionKey: createClientSafeId("crop"),
                                staffId: person.id,
                                staffName: person.name || "사역자",
                                imageSrc: objectUrl,
                                sourceFileName: file.name,
                                revokeOnClose: true,
                              };
                            });
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={!person.photoUrl}
                        onClick={() =>
                          updateDraft((prev) => ({
                            ...prev,
                            staff: prev.staff.map((p) =>
                              p.id === person.id
                                ? { ...p, photoUrl: undefined }
                                : p
                            ),
                          }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                          person.photoUrl
                            ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        사진 삭제
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `"${person.name}" 섬기는 분 정보를 삭제하시겠습니까?`
                          )
                        ) {
                          return;
                        }
                        const nextContent: SiteContent = {
                          ...draft,
                          staff: draft.staff.filter((p) => p.id !== person.id),
                        };
                        void handleSave(
                          nextContent,
                          `"${person.name}" 섬기는 분 정보가 삭제되었습니다.`
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                    >
                      사역자 삭제
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: NEXT-GENERATION DEPARTMENTS
           ========================================================= */}
        {activeTab === "youth" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                다음 세대 안내
              </h2>
              <Link
                href="/youth"
                target="_blank"
                className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
              >
                다음 세대 화면 보기 ↗
              </Link>
            </div>
            <div className="grid lg:grid-cols-3 gap-4">
              {draft.youthDepartments.map((dept: YouthDepartmentConfig) => (
                <div
                  key={dept.id}
                  className="rounded-xl border border-gray-200 p-4 space-y-2.5 bg-[#F8FAF8]"
                >
                  <h3 className="font-black text-[#1a2744]">
                    {dept.emoji} {dept.title}
                  </h3>
                  <input
                    type="text"
                    value={dept.targetAge}
                    placeholder="대상 연령"
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        youthDepartments: prev.youthDepartments.map((d) =>
                          d.id === dept.id
                            ? { ...d, targetAge: e.target.value }
                            : d
                        ),
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={dept.worshipTime}
                    placeholder="예배 시간"
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        youthDepartments: prev.youthDepartments.map((d) =>
                          d.id === dept.id
                            ? { ...d, worshipTime: e.target.value }
                            : d
                        ),
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={dept.location}
                    placeholder="예배 장소"
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        youthDepartments: prev.youthDepartments.map((d) =>
                          d.id === dept.id
                            ? { ...d, location: e.target.value }
                            : d
                        ),
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={dept.directorInfo}
                    placeholder="담당 교역자 및 부장"
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        youthDepartments: prev.youthDepartments.map((d) =>
                          d.id === dept.id
                            ? { ...d, directorInfo: e.target.value }
                            : d
                        ),
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                  />
                  <textarea
                    rows={3}
                    value={dept.intro}
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        youthDepartments: prev.youthDepartments.map((d) =>
                          d.id === dept.id
                            ? { ...d, intro: e.target.value }
                            : d
                        ),
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs leading-relaxed"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void handleSave(draft, "다음 세대 부서 안내가 저장되었습니다.")
                }
                className="px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black transition-colors disabled:opacity-60"
              >
                부서 안내 저장하기
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            SYSTEM: FULL JSON BACKUP & RESTORE
           ========================================================= */}
        {activeTab === "backup" && (
          <div className="space-y-4">
            <div className="bg-[#1a2744] text-white rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black">데이터 백업 및 복원</h2>
                <p className="text-xs text-gray-300 mt-1">
                  설교, 주보, 공지, 약력, 교재 자료, 계좌 등 현재 홈페이지 데이터를 파일로 백업하거나 복원합니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadBackupJson}
                  className="px-4 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black whitespace-nowrap"
                >
                  백업 파일 다운로드 ↓
                </button>
                <label className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer whitespace-nowrap">
                  백업 파일 불러오기
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void handleImportBackupJson(file);
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-[#1a2744]">
                  구 홈페이지 보관 자료 아카이브 (관리자 전용)
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed break-keep">
                  신규 홈페이지 메뉴에는 노출하지 않고 별도 보관한 구 홈페이지 자료(2013년 주간 소식, 2014년 찬양팀 콘티, 예전 게시판 글, 성가대 및 교회행사 영상 색인 등)를 열람용 파일로 내려받습니다.
                </p>
              </div>
              <a
                href="/api/legacy-archive"
                download="ilkwang-legacy-archive.json"
                className="px-4 py-2.5 rounded-xl bg-[#F4F7F5] hover:bg-[#E8F5E9] text-[#1a2744] hover:text-[#2E7D32] border border-gray-200 text-xs font-black whitespace-nowrap shrink-0 text-center"
              >
                구 홈페이지 보관본 다운로드 ↓
              </a>
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: CHURCH LOCATION, CONTACT & TRANSIT INFO
           ========================================================= */}
        {activeTab === "church-info" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                오시는 길 및 대표 연락처
              </h2>
              <Link
                href="/about/location"
                target="_blank"
                className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
              >
                오시는 길 화면 보기 ↗
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  도로명 주소 (전체)
                </label>
                <input
                  type="text"
                  value={draft.churchInfo.address}
                  onChange={(e) => {
                    const nextAddr = e.target.value;
                    updateDraft((prev) => {
                      const prevAutoShort = prev.churchInfo.address.replace(
                        /^서울특별시\s+/,
                        "서울 "
                      );
                      const shouldAutoSyncShort =
                        prev.churchInfo.shortAddress ===
                          prev.churchInfo.address ||
                        prev.churchInfo.shortAddress === prevAutoShort;
                      return {
                        ...prev,
                        churchInfo: {
                          ...prev.churchInfo,
                          address: nextAddr,
                          shortAddress: shouldAutoSyncShort
                            ? nextAddr.replace(/^서울특별시\s+/, "서울 ")
                            : prev.churchInfo.shortAddress,
                        },
                      };
                    });
                  }}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  요약 주소 (메인, 상단, 하단 표기)
                </label>
                <input
                  type="text"
                  value={draft.churchInfo.shortAddress}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      churchInfo: {
                        ...prev.churchInfo,
                        shortAddress: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  지하철 및 대중교통 안내
                </label>
                <input
                  type="text"
                  value={draft.churchInfo.subwayGuide}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      churchInfo: {
                        ...prev.churchInfo,
                        subwayGuide: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  대표 전화번호
                </label>
                <input
                  type="text"
                  value={draft.churchInfo.phone}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      churchInfo: {
                        ...prev.churchInfo,
                        phone: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  이메일
                </label>
                <input
                  type="text"
                  value={draft.churchInfo.email}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      churchInfo: {
                        ...prev.churchInfo,
                        email: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  유튜브 채널 주소
                </label>
                <input
                  type="text"
                  value={draft.churchInfo.youtubeUrl}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      churchInfo: {
                        ...prev.churchInfo,
                        youtubeUrl: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void handleSave(draft, "오시는 길 및 연락처가 저장되었습니다.")
                }
                className="px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black transition-colors disabled:opacity-60"
              >
                연락처 정보 저장하기
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: ONLINE OFFERING ACCOUNTS (UNIFIED CREATION CARD + LIST)
           ========================================================= */}
        {activeTab === "offering" && (
          <div className="space-y-6">
            {/* 1. Create New Offering Account Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                  새 헌금 계좌 등록
                </h2>
                <Link
                  href="/offering"
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  온라인 헌금 화면 보기 ↗
                </Link>
              </div>

              <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      헌금 구분 *
                    </label>
                    <input
                      type="text"
                      value={newOfferingPurpose}
                      onChange={(e) => setNewOfferingPurpose(e.target.value)}
                      placeholder="예: 십일조, 감사헌금"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      은행명 *
                    </label>
                    <input
                      type="text"
                      value={newOfferingBank}
                      onChange={(e) => setNewOfferingBank(e.target.value)}
                      placeholder="예: 국민은행"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      계좌번호 *
                    </label>
                    <input
                      type="text"
                      value={newOfferingNumber}
                      onChange={(e) => setNewOfferingNumber(e.target.value)}
                      placeholder="예: 000-00-0000-000"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      예금주
                    </label>
                    <input
                      type="text"
                      value={newOfferingHolder}
                      onChange={(e) => setNewOfferingHolder(e.target.value)}
                      placeholder="예: 일광교회"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCreateOfferingAccount()}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
                  >
                    + 새 계좌 등록하기
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Registered Offering Accounts List Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black text-[#1a2744]">
                  등록된 헌금 계좌 ({draft.offeringAccounts.length}개)
                </h3>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void handleSave(draft, "온라인 헌금 계좌가 저장되었습니다.")
                  }
                  className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                >
                  계좌 정보 저장
                </button>
              </div>
              <div className="space-y-3">
                {draft.offeringAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="rounded-xl border border-gray-200 bg-[#F8FAF8]/70 p-3.5 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center"
                  >
                    <input
                      type="text"
                      placeholder="헌금 구분"
                      value={acc.purpose}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          offeringAccounts: prev.offeringAccounts.map((a) =>
                            a.id === acc.id
                              ? { ...a, purpose: e.target.value }
                              : a
                          ),
                        }))
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
                    />
                    <input
                      type="text"
                      placeholder="은행명"
                      value={acc.bankName}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          offeringAccounts: prev.offeringAccounts.map((a) =>
                            a.id === acc.id
                              ? { ...a, bankName: e.target.value }
                              : a
                          ),
                        }))
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="계좌번호"
                      value={acc.accountNumber}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          offeringAccounts: prev.offeringAccounts.map((a) =>
                            a.id === acc.id
                              ? { ...a, accountNumber: e.target.value }
                              : a
                          ),
                        }))
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono"
                    />
                    <input
                      type="text"
                      placeholder="예금주"
                      value={acc.holder}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          offeringAccounts: prev.offeringAccounts.map((a) =>
                            a.id === acc.id ? { ...a, holder: e.target.value } : a
                          ),
                        }))
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `"${acc.purpose}" 계좌를 삭제하시겠습니까?`
                          )
                        ) {
                          return;
                        }
                        const nextContent: SiteContent = {
                          ...draft,
                          offeringAccounts: draft.offeringAccounts.filter(
                            (a) => a.id !== acc.id
                          ),
                        };
                        void handleSave(
                          nextContent,
                          `"${acc.purpose}" 계좌가 삭제되었습니다.`
                        );
                      }}
                      className="rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2 whitespace-nowrap"
                    >
                      계좌 삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            CATEGORY: CHURCH HISTORY (UNIFIED CREATION CARD + LIST)
           ========================================================= */}
        {activeTab === "history" && (
          <div className="space-y-6">
            {/* 1. Create New History Item Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
                  새 교회 연혁 등록
                </h2>
                <Link
                  href="/about/history"
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                >
                  교회 역사 화면 보기 ↗
                </Link>
              </div>

              <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      연도 및 시기 *
                    </label>
                    <input
                      type="text"
                      value={newHistoryYear}
                      onChange={(e) => setNewHistoryYear(e.target.value)}
                      placeholder="예: 2026. 11"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      연혁 제목 *
                    </label>
                    <input
                      type="text"
                      value={newHistoryTitle}
                      onChange={(e) => setNewHistoryTitle(e.target.value)}
                      placeholder="예: 창립 55주년 감사예배"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    연혁 상세 설명
                  </label>
                  <textarea
                    rows={2}
                    value={newHistoryDesc}
                    onChange={(e) => setNewHistoryDesc(e.target.value)}
                    placeholder="연혁 상세 내용을 입력해 주세요."
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs flex-1 min-w-0">
                    <label className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 font-bold text-gray-700 cursor-pointer shrink-0">
                      원본 사료 이미지 선택 (선택)
                      <input
                        type="file"
                        accept={ADMIN_IMAGE_ACCEPT}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          const uploaded = await uploadAsset(
                            file,
                            "gallery",
                            file.name
                          );
                          if (uploaded) {
                            setNewHistoryImageUrl(uploaded.url);
                          }
                        }}
                      />
                    </label>
                    {newHistoryImageUrl && (
                      <>
                        <input
                          type="text"
                          value={newHistoryImageCaption}
                          onChange={(e) =>
                            setNewHistoryImageCaption(e.target.value)
                          }
                          placeholder="사료 이미지 설명 (선택)"
                          className="flex-1 min-w-[160px] rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setNewHistoryImageUrl("");
                            setNewHistoryImageCaption("");
                          }}
                          className="text-red-600 underline font-bold"
                        >
                          해제
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCreateHistoryItem()}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
                  >
                    + 새 연혁 등록하기
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Registered History List Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black text-[#1a2744]">
                  등록된 교회 연혁 ({draft.history.length}건)
                </h3>
              </div>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                {draft.history.map((h) => {
                  const isExpanded = expandedHistoryId === h.id;
                  return (
                    <div key={h.id} className="bg-white">
                      <div className="px-3.5 sm:px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 hover:bg-[#F8FAF8]/70 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#1a2744] text-white text-xs font-black shrink-0">
                            {h.year}
                          </span>
                          <span className="text-sm font-bold text-[#1a2744] truncate">
                            {h.title}
                          </span>
                          {h.imageUrl && (
                            <span className="px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-bold shrink-0">
                              사료 보관됨
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedHistoryId(isExpanded ? null : h.id)
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              isExpanded
                                ? "bg-[#1a2744] text-white"
                                : "bg-[#F4F7F5] text-[#1a2744] hover:bg-gray-200"
                            }`}
                          >
                            {isExpanded ? "닫기 ▲" : "수정 ▼"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `"${h.year} ${h.title}" 연혁을 삭제하시겠습니까?`
                                )
                              ) {
                                return;
                              }
                              const nextContent: SiteContent = {
                                ...draft,
                                history: draft.history.filter(
                                  (item) => item.id !== h.id
                                ),
                              };
                              void handleSave(
                                nextContent,
                                `"${h.year} ${h.title}" 연혁이 삭제되었습니다.`
                              );
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                          >
                            삭제
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 py-4 bg-[#F8FAF8] border-t border-gray-200 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                            <input
                              type="text"
                              placeholder="연도"
                              value={h.year}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  history: prev.history.map((item) =>
                                    item.id === h.id
                                      ? { ...item, year: e.target.value }
                                      : item
                                  ),
                                }))
                              }
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-black"
                            />
                            <input
                              type="text"
                              placeholder="연혁 제목"
                              value={h.title}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  history: prev.history.map((item) =>
                                    item.id === h.id
                                      ? { ...item, title: e.target.value }
                                      : item
                                  ),
                                }))
                              }
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
                            />
                          </div>
                          <textarea
                            rows={2}
                            placeholder="연혁 상세 설명"
                            value={h.description}
                            onChange={(e) =>
                              updateDraft((prev) => ({
                                ...prev,
                                history: prev.history.map((item) =>
                                  item.id === h.id
                                    ? { ...item, description: e.target.value }
                                    : item
                                ),
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed"
                          />

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {h.imageUrl ? (
                                <>
                                  <img
                                    src={h.imageUrl}
                                    alt={h.imageCaption || h.title}
                                    className="h-10 w-10 rounded-md object-cover border border-gray-200 bg-white shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={h.imageCaption ?? ""}
                                    onChange={(e) =>
                                      updateDraft((prev) => ({
                                        ...prev,
                                        history: prev.history.map((item) =>
                                          item.id === h.id
                                            ? {
                                                ...item,
                                                imageCaption: e.target.value,
                                              }
                                            : item
                                        ),
                                      }))
                                    }
                                    placeholder="원본 사료 설명"
                                    className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
                                  />
                                </>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  첨부된 사료 이미지 없음
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors">
                                {h.imageUrl
                                  ? "사료 이미지 교체"
                                  : "+ 사료 이미지 첨부"}
                                <input
                                  type="file"
                                  accept={ADMIN_IMAGE_ACCEPT}
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (!file) return;
                                    const uploaded = await uploadAsset(
                                      file,
                                      "gallery",
                                      file.name
                                    );
                                    if (uploaded) {
                                      updateDraft((prev) => ({
                                        ...prev,
                                        history: prev.history.map((item) =>
                                          item.id === h.id
                                            ? {
                                                ...item,
                                                imageUrl: uploaded.url,
                                                imageCaption:
                                                  item.imageCaption ||
                                                  `${h.year} ${h.title}`,
                                              }
                                            : item
                                        ),
                                      }));
                                    }
                                  }}
                                />
                              </label>
                              {h.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      history: prev.history.map((item) =>
                                        item.id === h.id
                                          ? {
                                              ...item,
                                              imageUrl: undefined,
                                              imageCaption: undefined,
                                            }
                                          : item
                                      ),
                                    }))
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs font-bold"
                                >
                                  이미지 제외
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                  setExpandedHistoryId(null);
                                  void handleSave(
                                    draft,
                                    `"${h.year} ${h.title}" 연혁 수정사항이 저장되었습니다.`
                                  );
                                }}
                                className="px-4 py-1.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                              >
                                수정 내용 저장
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

            {/* Sticky Unsaved Changes Bar (Appears Immediately When Draft Has Edits) */}
            {isDirty && (
              <div className="sticky bottom-4 z-30 mt-6 rounded-2xl bg-[#1a2744] text-white px-4 sm:px-6 py-3.5 shadow-xl border border-white/15 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs sm:text-sm font-bold text-amber-300">
                  ● 저장하지 않은 수정 내용이 있습니다.
                </span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="px-5 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-black transition-colors disabled:opacity-60"
                >
                  {saving ? "저장 중..." : "변경사항 저장하기"}
                </button>
              </div>
            )}

            {/* Bottom Save Bar */}
            <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 flex items-center justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className={`w-full sm:w-auto px-8 py-3 rounded-full text-white text-sm font-black shadow-md transition-colors ${
                  isDirty
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-[#2E7D32] hover:bg-[#1B5E20]"
                } disabled:opacity-60`}
              >
                {saving
                  ? "저장 중..."
                  : isDirty
                    ? "● 미저장 변경사항 반영하기"
                    : "✓ 변경사항 저장하기"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Admin Mode Circular Chatbot (Admin Mode Only) */}
      <AdminSmartAssistant
        open={assistantDrawerOpen}
        onOpenChange={setAssistantDrawerOpen}
        onNavigateTab={handleAssistantJump}
        onInsertNoticeDraft={handleInsertNoticeDraftFromAssistant}
      />

      {staffCropSession && (
        <StaffPhotoCropModal
          key={staffCropSession.sessionKey}
          imageSrc={staffCropSession.imageSrc}
          sourceFileName={staffCropSession.sourceFileName}
          staffName={staffCropSession.staffName}
          isSubmitting={Boolean(uploadingLabel)}
          onCancel={closeStaffCropSession}
          onApply={async (croppedFile) => {
            const targetStaffId = staffCropSession.staffId;
            const uploaded = await uploadAsset(
              croppedFile,
              "profiles",
              croppedFile.name
            );
            if (uploaded) {
              if (targetStaffId === "__new_staff__") {
                setNewStaffPhotoUrl(uploaded.url);
              } else {
                updateDraft((prev) => ({
                  ...prev,
                  staff: prev.staff.map((p) =>
                    p.id === targetStaffId
                      ? { ...p, photoUrl: uploaded.url }
                      : p
                  ),
                }));
              }
              closeStaffCropSession();
            }
          }}
        />
      )}
    </div>
  );
}
