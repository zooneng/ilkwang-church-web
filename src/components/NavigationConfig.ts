import type { NavCategoryConfig } from "@/types/site-content";

export interface SubTabItem {
  readonly label: string;
  readonly href: string;
}

export interface MainNavCategory {
  readonly label: string;
  readonly href: string;
  readonly items: readonly SubTabItem[];
}

export const DEFAULT_NAVIGATION: readonly NavCategoryConfig[] = [
  {
    id: "nav-about",
    label: "교회 소개",
    headingTitle: "일광교회 소개",
    description: "1971년 설립된 서울 성북구 대한예수교장로회(합동) 소속 교회입니다.",
    href: "/about",
    isVisible: true,
    items: [
      {
        id: "sub-about-greeting",
        label: "인사말",
        href: "/about",
        description: "담임목사 인사말 및 교회 소개",
        isVisible: true,
      },
      {
        id: "sub-about-history",
        label: "교회 역사",
        href: "/about/history",
        description: "1971년 설립부터 오늘까지의 발자취",
        isVisible: true,
      },
      {
        id: "sub-about-pastor",
        label: "섬기는 사람들",
        href: "/about/pastor",
        description: "교회를 섬기는 교역자 및 사역자 안내",
        isVisible: true,
      },
      {
        id: "sub-about-vision",
        label: "교회 비전",
        href: "/about/vision",
        description: "말씀과 기도, 선교로 세워 가는 비전",
        isVisible: true,
      },
      {
        id: "sub-about-location",
        label: "오시는 길",
        href: "/about/location",
        description: "서울 성북구 동소문로 212-68 교통편 안내",
        isVisible: true,
      },
      {
        id: "sub-about-offering",
        label: "온라인 헌금",
        href: "/offering",
        description: "온라인 헌금 계좌 및 예물 안내",
        isVisible: true,
      },
    ],
  },
  {
    id: "nav-worship",
    label: "예배와 말씀",
    headingTitle: "예배와 말씀",
    description: "말씀과 기도로 하나님께 나아가는 일광교회의 예배와 설교 안내입니다.",
    href: "/worship",
    isVisible: true,
    items: [
      {
        id: "sub-worship-guide",
        label: "예배 안내",
        href: "/worship",
        description: "주일 예배 및 주중 기도회 시간 안내",
        isVisible: true,
      },
      {
        id: "sub-worship-sermons",
        label: "설교 영상",
        href: "/worship/sermons",
        description: "강단 설교 말씀 영상 아카이브",
        isVisible: true,
      },
    ],
  },
  {
    id: "nav-youth",
    label: "다음 세대",
    headingTitle: "다음 세대 교육부",
    description: "믿음 안에서 다음 세대를 말씀과 사랑으로 양육하는 교육 공동체입니다.",
    href: "/youth",
    isVisible: true,
    items: [
      {
        id: "sub-youth-sunday",
        label: "유초등부",
        href: "/youth/sunday",
        description: "하나님을 경험하며 자라는 유치부, 아동부",
        isVisible: true,
      },
      {
        id: "sub-youth-teens",
        label: "중고등부",
        href: "/youth/teens",
        description: "정체성과 신앙을 함께 세우는 청소년부",
        isVisible: true,
      },
      {
        id: "sub-youth-young",
        label: "청년부",
        href: "/youth/young-adults",
        description: "세상 속에서 그리스도인으로 사는 청년 공동체",
        isVisible: true,
      },
      {
        id: "sub-youth-dormitory",
        label: "일광학사관",
        href: "/boards/dormitory",
        description: "서울 지역 대학생과 취업 준비 청년을 위한 믿음의 학사관",
        isVisible: true,
        customBoardSlug: "dormitory",
      },
    ],
  },
  {
    id: "nav-news",
    label: "나눔과 소식",
    headingTitle: "나눔과 소식",
    description: "교회 소식과 성도들의 이야기를 함께 나눕니다.",
    href: "/news",
    isVisible: true,
    items: [
      {
        id: "sub-news-notices",
        label: "교회 소식",
        href: "/news",
        description: "주요 공지 사항 및 한 주간의 교회 소식",
        isVisible: true,
      },
      {
        id: "sub-news-bulletin",
        label: "주보 안내",
        href: "/news/bulletin",
        description: "매주 예배 순서와 주간 소식을 화면에서 바로 열람",
        isVisible: true,
      },
      {
        id: "sub-news-events",
        label: "행사 안내",
        href: "/news/events",
        description: "절기 예배 및 연간 주요 행사 일정",
        isVisible: true,
      },
      {
        id: "sub-news-gallery",
        label: "앨범",
        href: "/news/gallery",
        description: "예배와 행사 사진 및 영상 앨범 모음",
        isVisible: true,
      },
      {
        id: "sub-news-resources",
        label: "교재 자료",
        href: "/resources",
        description: "소그룹 성경 공부 및 부서 공과 자료",
        isVisible: true,
      },
    ],
  },
];

export const ABOUT_TABS: readonly SubTabItem[] = [
  { label: "인사말", href: "/about" },
  { label: "교회 역사", href: "/about/history" },
  { label: "섬기는 사람들", href: "/about/pastor" },
  { label: "교회 비전", href: "/about/vision" },
  { label: "오시는 길", href: "/about/location" },
  { label: "온라인 헌금", href: "/offering" },
];

export const WORSHIP_TABS: readonly SubTabItem[] = [
  { label: "예배 안내", href: "/worship" },
  { label: "설교 영상", href: "/worship/sermons" },
];

export const YOUTH_TABS: readonly SubTabItem[] = [
  { label: "다음 세대 안내", href: "/youth" },
  { label: "유초등부", href: "/youth/sunday" },
  { label: "중고등부", href: "/youth/teens" },
  { label: "청년부", href: "/youth/young-adults" },
  { label: "일광학사관", href: "/boards/dormitory" },
];

export const NEWS_TABS: readonly SubTabItem[] = [
  { label: "교회 소식", href: "/news" },
  { label: "주보 안내", href: "/news/bulletin" },
  { label: "행사 안내", href: "/news/events" },
  { label: "앨범", href: "/news/gallery" },
  { label: "교재 자료", href: "/resources" },
];

export const MAIN_NAVIGATION: readonly MainNavCategory[] = DEFAULT_NAVIGATION.map(
  (cat) => ({
    label: cat.label,
    href: cat.href,
    items: cat.items.map((item) => ({ label: item.label, href: item.href })),
  })
);

export const BUILTIN_LINK_PRESETS: readonly {
  readonly label: string;
  readonly href: string;
  readonly description: string;
}[] = [
  { label: "인사말", href: "/about", description: "담임목사 인사말 및 교회 소개" },
  { label: "교회 역사", href: "/about/history", description: "1971년 설립부터 오늘까지의 발자취" },
  { label: "섬기는 사람들", href: "/about/pastor", description: "교회를 섬기는 교역자 및 사역자 안내" },
  { label: "교회 비전", href: "/about/vision", description: "말씀과 기도, 선교로 세워 가는 비전" },
  { label: "오시는 길", href: "/about/location", description: "서울 성북구 동소문로 212-68 교통편 안내" },
  { label: "예배 안내", href: "/worship", description: "주일 예배 및 주중 기도회 시간 안내" },
  { label: "설교 영상", href: "/worship/sermons", description: "강단 설교 말씀 영상 아카이브" },
  { label: "다음 세대 안내", href: "/youth", description: "교육 부서 전체 안내" },
  { label: "유초등부", href: "/youth/sunday", description: "하나님을 경험하며 자라는 유치부, 아동부" },
  { label: "중고등부", href: "/youth/teens", description: "정체성과 신앙을 함께 세우는 청소년부" },
  { label: "청년부", href: "/youth/young-adults", description: "세상 속에서 그리스도인으로 사는 청년 공동체" },
  { label: "일광학사관", href: "/boards/dormitory", description: "서울 지역 대학생과 취업 준비 청년을 위한 믿음의 학사관" },
  { label: "교회 소식", href: "/news", description: "주요 공지 사항 및 한 주간의 교회 소식" },
  { label: "주보 안내", href: "/news/bulletin", description: "매주 예배 순서와 주간 소식을 화면에서 바로 열람" },
  { label: "행사 안내", href: "/news/events", description: "절기 예배 및 연간 주요 행사 일정" },
  { label: "앨범", href: "/news/gallery", description: "예배와 행사 사진 및 영상 앨범 모음" },
  { label: "교재 자료", href: "/resources", description: "소그룹 성경 공부 및 부서 공과 자료" },
  { label: "온라인 헌금", href: "/offering", description: "온라인 헌금 계좌 및 안내" },
  { label: "문의하기", href: "/contact", description: "새가족 등록 및 온라인 문의" },
];
