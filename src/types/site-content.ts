export interface ChurchInfo {
  readonly name: string;
  readonly slogan: string;
  readonly denomination: string;
  readonly foundedYear: number;
  readonly address: string;
  readonly shortAddress: string;
  readonly postalCode: string;
  readonly phone: string;
  readonly email: string;
  readonly youtubeUrl: string;
  readonly subwayGuide: string;
  readonly busTrunk: string;
  readonly busBranch: string;
  readonly sundaySummary: string;
  readonly visitSummary: string;
  readonly heroBackgroundUrl?: string;
  readonly missionBackgroundUrl?: string;
  readonly missionCardImageUrl?: string;
  readonly ogShareImageUrl?: string;
  readonly logoUrl?: string;
  readonly defaultSubpageBannerUrl?: string;
}

export interface CareerEntry {
  readonly id: string;
  readonly status: "현" | "전";
  readonly label: string;
}

export interface PastorProfile {
  readonly name: string;
  readonly displayName: string;
  readonly roleTitle: string;
  readonly photoUrl: string;
  readonly greetingTitle: string;
  readonly greetingBody: readonly string[];
  readonly bibleQuote: string;
  readonly bibleReference: string;
  readonly closingLine: string;
  readonly education: readonly string[];
  readonly career: readonly CareerEntry[];
  readonly bioNotice: string;
}

export interface HistoryItem {
  readonly id: string;
  readonly year: string;
  readonly title: string;
  readonly description: string;
  readonly imageUrl?: string;
  readonly imageCaption?: string;
}

export interface StaffMember {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly department: string;
  readonly departments?: readonly string[];
  readonly description: string;
  readonly photoUrl?: string;
}

export interface WorshipServiceItem {
  readonly id: string;
  readonly title: string;
  readonly time: string;
  readonly location: string;
  readonly description: string;
  readonly footerShortLabel?: string;
  readonly footerShortTime?: string;
}

export type SermonServiceCategory =
  | "주일오전예배"
  | "주일오후예배"
  | "수요기도회"
  | "금요기도회"
  | "새벽기도회"
  | "특별집회";

export interface SermonItem {
  readonly id: string;
  readonly title: string;
  readonly scripture: string;
  readonly preacher: string;
  readonly date: string;
  readonly serviceType: string;
  readonly youtubeId: string;
  readonly summary?: string;
}

export interface NoticeItem {
  readonly id: string;
  readonly category: "필독" | "예배" | "소식" | "모집";
  readonly title: string;
  readonly date: string;
  readonly author: string;
  readonly isPinned: boolean;
  readonly content: string;
  readonly imageUrl?: string;
  readonly attachmentUrl?: string;
  readonly attachmentName?: string;
}

export interface BulletinItem {
  readonly id: string;
  readonly title: string;
  readonly date: string;
  readonly volume: string;
  readonly sermonTitle: string;
  readonly scripture: string;
  readonly preacher?: string;
  readonly worshipOrder?: readonly string[];
  readonly celebrations?: readonly string[];
  readonly summaryNotes?: readonly string[];
  readonly churchNews?: string;
  readonly scheduleTitle?: string;
  readonly churchSchedule?: string;
  readonly fullContent?: string;
  readonly fileUrl?: string;
  readonly fileName?: string;
  readonly imageUrls?: readonly string[];
}

export interface EventItem {
  readonly id: string;
  readonly date?: string;
  readonly dayBadge: string;
  readonly monthYearBadge: string;
  readonly title: string;
  readonly timeText: string;
  readonly location: string;
  readonly description: string;
  readonly recurrence?: "none" | "quarterly";
  readonly attachmentUrl?: string;
  readonly attachmentName?: string;
}

export interface OfferingAccount {
  readonly id: string;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly holder: string;
  readonly purpose: string;
}

export interface GalleryPhoto {
  readonly id: string;
  readonly title: string;
  readonly category?: string;
  readonly date: string;
  readonly imageUrl: string;
  readonly showInHeroCube?: boolean;
}

export interface LegacyGalleryImage {
  readonly id: string;
  readonly imageUrl: string;
  readonly caption: string;
  readonly width?: number;
  readonly height?: number;
}

export interface LegacyGalleryAlbum {
  readonly id: string;
  readonly documentSrl?: string;
  readonly board?: "photo" | "new_church" | "gallery";
  readonly title: string;
  readonly content?: string;
  readonly date: string;
  readonly postDateTime?: string;
  readonly year: string;
  readonly eventYear?: string;
  readonly tags?: readonly string[];
  readonly coverImageUrl: string;
  readonly photoCount: number;
  readonly isVisible: boolean;
  readonly photos: readonly LegacyGalleryImage[];
}

export interface LegacyGalleryStoreData {
  readonly updatedAt: string;
  readonly totalAlbums: number;
  readonly totalPhotos: number;
  readonly albums: readonly LegacyGalleryAlbum[];
}

export interface YouthProgramItem {
  readonly title: string;
  readonly desc: string;
}

export interface YouthDepartmentConfig {
  readonly id: "sunday" | "teens" | "young-adults";
  readonly slug: string;
  readonly emoji: string;
  readonly englishLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly bannerImageUrl: string;
  readonly targetAge: string;
  readonly worshipTime: string;
  readonly location: string;
  readonly directorInfo: string;
  readonly intro: string;
  readonly programs: readonly YouthProgramItem[];
}

export type ResourceCategory =
  | "주일 설교 요약"
  | "소그룹 교재"
  | "주일학교 교재"
  | "성경 공부"
  | "설교·예배자료"
  | "성경공부·양육"
  | "다음세대 공과";

export interface ResourceItem {
  readonly id: string;
  readonly category: ResourceCategory;
  readonly title: string;
  readonly description: string;
  readonly date: string;
  readonly author: string;
  readonly fileUrl: string;
  readonly fileName: string;
  readonly fileSizeLabel: string;
}

export type CommunityDepartment =
  | "유초등부"
  | "중고등부"
  | "청년부"
  | "주일학교"
  | "장년부"
  | "여전도회"
  | "선교부";

export interface CommunityPost {
  readonly id: string;
  readonly department: CommunityDepartment;
  readonly title: string;
  readonly content: string;
  readonly author: string;
  readonly date: string;
  readonly imageUrl: string;
  readonly youtubeId?: string;
  readonly attachmentUrl?: string;
  readonly attachmentName?: string;
}

export type InquiryCategory =
  | "새가족 등록"
  | "예배·교회 문의"
  | "심방·기도 요청"
  | "시설·행정 문의";

export interface InquiryItem {
  readonly id: string;
  readonly category: InquiryCategory;
  readonly name: string;
  readonly contact: string;
  readonly title: string;
  readonly message: string;
  readonly createdAt: string;
  readonly status: "접수대기" | "연락완료";
  readonly adminMemo: string;
}

export interface NavSubItemConfig {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly description: string;
  readonly isVisible?: boolean;
  readonly customBoardSlug?: string;
}

export interface NavCategoryConfig {
  readonly id: string;
  readonly label: string;
  readonly headingTitle: string;
  readonly description: string;
  readonly href: string;
  readonly isVisible: boolean;
  readonly items: readonly NavSubItemConfig[];
}

export interface CustomBoardPost {
  readonly id: string;
  readonly categoryTag: string;
  readonly title: string;
  readonly author: string;
  readonly date: string;
  readonly content: string;
  readonly isPinned: boolean;
  readonly imageUrl?: string;
  readonly attachmentUrl?: string;
  readonly attachmentName?: string;
}

export interface CustomBoard {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string;
  readonly englishLabel: string;
  readonly bannerImageUrl: string;
  readonly allowMemberWrite: boolean;
  readonly createdAt: string;
  readonly posts: readonly CustomBoardPost[];
}

export interface CustomBoardsStoreData {
  readonly updatedAt: string;
  readonly boards: readonly CustomBoard[];
}

export interface ManagedBoardPost {
  readonly id: string;
  readonly boardKey: string;
  readonly categoryTag: string;
  readonly title: string;
  readonly author: string;
  readonly date: string;
  readonly content: string;
  readonly isPinned: boolean;
  readonly imageUrl?: string;
  readonly youtubeId?: string;
  readonly attachmentUrl?: string;
  readonly attachmentName?: string;
}

export interface ManagedBoardSummary {
  readonly boardKey: string;
  readonly title: string;
  readonly href: string;
  readonly parentCategoryLabel: string;
  readonly isBuiltIn: boolean;
  readonly customBoardSlug?: string;
  readonly allowMemberWrite?: boolean;
  readonly subtitle?: string;
  readonly postCount: number;
  readonly posts: readonly ManagedBoardPost[];
}

export interface PopupItem {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly imageUrl?: string;
  readonly linkUrl?: string;
  readonly linkLabel?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly isActive: boolean;
}

export interface SiteContent {
  readonly updatedAt: string;
  readonly navigation: readonly NavCategoryConfig[];
  readonly topBannerNotices: readonly string[];
  readonly popups: readonly PopupItem[];
  readonly churchInfo: ChurchInfo;
  readonly pastorProfile: PastorProfile;
  readonly history: readonly HistoryItem[];
  readonly staff: readonly StaffMember[];
  readonly worshipSchedule: readonly WorshipServiceItem[];
  readonly youthDepartments: readonly YouthDepartmentConfig[];
  readonly sermons: readonly SermonItem[];
  readonly notices: readonly NoticeItem[];
  readonly bulletins: readonly BulletinItem[];
  readonly events: readonly EventItem[];
  readonly offeringAccounts: readonly OfferingAccount[];
  readonly gallery: readonly GalleryPhoto[];
  readonly resources: readonly ResourceItem[];
  readonly communityPosts: readonly CommunityPost[];
}
