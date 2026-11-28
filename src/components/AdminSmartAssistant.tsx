"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClientSafeId, getKstDateString } from "@/lib/format-utils";
import { readJsonResponseSafe } from "@/lib/media-utils";
import type { NoticeItem } from "@/types/site-content";

export type AssistantJumpTarget =
  | "bulletin"
  | "sermons"
  | "inquiries"
  | "popups"
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

interface KnowledgeEntry {
  readonly id: string;
  readonly question: string;
  readonly keywords: readonly string[];
  readonly summary: string;
  readonly steps: readonly string[];
  readonly targetTab?: AssistantJumpTarget;
  readonly targetBoardKey?: string;
  readonly targetLabel?: string;
  readonly publicHref?: string;
}

const BUILTIN_KNOWLEDGE_BASE: readonly KnowledgeEntry[] = [
  {
    id: "kb-weekly-routine",
    question: "매주 주일마다 관리자가 꼭 해야 하는 일은 무엇인가요?",
    keywords: [
      "매주",
      "주일",
      "루틴",
      "인수인계",
      "후임",
      "처음",
      "뭐해야",
      "할일",
      "할 일",
      "순서",
    ],
    summary:
      "매주 토요일이나 주일 오후에 아래 3가지만 처리하시면 홈페이지가 항상 최신 상태로 유지됩니다.",
    steps: [
      "1단계 [주보 안내]: 주보 한글(.hwp, .hwpx) 파일을 올리면 예배 순서, 설교 본문, 교회 소식, 축하 명단이 자동 추출됩니다.",
      "2단계 [설교 영상]: 유튜브 설교 주소를 붙여넣고 [유튜브 제목 자동 불러오기]를 누른 뒤 등록합니다.",
      "3단계 [새가족 및 문의함]: 온라인 새가족 등록이나 문의 접수 건을 확인하고 연락 완료 체크를 남깁니다.",
    ],
    targetTab: "bulletin",
    targetLabel: "1단계 주보 관리 열기",
  },
  {
    id: "kb-bulletin",
    question: "주보 한글(.hwp) 파일은 어디에서 올리고 오탈자는 어떻게 확인하나요?",
    keywords: [
      "주보",
      "오탈자",
      "오타",
      "맞춤법",
      "미리보기",
      "hwp",
      "hwpx",
      "한글",
      "예배순서",
      "예배 순서",
      "생일",
      "결혼",
      "축하",
      "광고",
    ],
    summary:
      "[주보 안내] 메뉴에서 한글(.hwp, .hwpx) 파일을 고르면 바로 게시되지 않고 먼저 자동 오탈자 점검 창과 큰글씨 미리보기가 열립니다.",
    steps: [
      "[주보 안내] 화면 상단의 [주보 한글 파일 선택하기] 버튼을 누릅니다.",
      "예배일 중복, 누락 항목, 자주 틀리는 한글 맞춤법 오타를 자동으로 찾아 주며 [한 번에 고치기]로 즉시 교정할 수 있습니다.",
      "큰글씨 미리보기에서 성도 성함을 확인한 뒤 [확인 완료 — 홈페이지에 주보 게시하기]를 누르면 실제 홈페이지에 반영됩니다.",
    ],
    targetTab: "bulletin",
    targetLabel: "주보 안내 관리 열기",
    publicHref: "/news/bulletin",
  },
  {
    id: "kb-sermons",
    question: "주일 설교 유튜브 영상은 어떻게 올리나요?",
    keywords: [
      "설교",
      "유튜브",
      "youtube",
      "영상",
      "말씀",
      "강단",
      "동영상",
      "링크",
    ],
    summary:
      "[설교 영상] 탭에서 유튜브 주소만 붙여넣으면 제목과 날짜, 썸네일을 자동으로 불러옵니다.",
    steps: [
      "좌측 [설교 영상] 메뉴로 이동합니다.",
      "유튜브 주소 입력칸에 링크를 붙여넣고 [유튜브 제목 자동 불러오기]를 누릅니다.",
      "예배 구분과 본문을 확인한 뒤 [설교 영상 즉시 등록하기]를 누르면 메인과 설교 게시판에 동시 반영됩니다.",
    ],
    targetTab: "sermons",
    targetLabel: "설교 영상 관리 열기",
    publicHref: "/worship/sermons",
  },
  {
    id: "kb-dormitory",
    question: "일광학사관 소개글이나 입사 지원서 양식은 어디서 수정하나요?",
    keywords: [
      "학사관",
      "일광학사관",
      "기숙사",
      "입사",
      "입주원서",
      "자기소개서",
      "대학생",
      "학사",
      "양식",
      "dormitory",
    ],
    summary:
      "[게시물 통합 이동 및 삭제]에서 '일광학사관'을 선택하면 모집 공고와 첨부 양식(.hwp, .pdf)을 바로 수정할 수 있습니다.",
    steps: [
      "아래 버튼으로 '일광학사관' 게시물 관리 화면을 바로 엽니다.",
      "기존 글 우측 [수정]을 눌러 모집 인원이나 일정을 고치거나 한글(.hwp) 원본 입주원서로 교체할 수 있습니다.",
      "신학기 모집 공고는 [+ 현재 게시판에 새 글 작성]으로 올리고 상단고정을 체크하세요.",
    ],
    targetTab: "posts",
    targetBoardKey: "custom:dormitory",
    targetLabel: "일광학사관 관리 열기",
    publicHref: "/boards/dormitory",
  },
  {
    id: "kb-offering",
    question: "온라인 헌금 은행 계좌번호는 어디에서 바꾸나요?",
    keywords: [
      "헌금",
      "계좌",
      "은행",
      "십일조",
      "감사헌금",
      "건축헌금",
      "선교헌금",
      "예금주",
    ],
    summary:
      "[온라인 헌금] 탭에서 새 계좌를 등록하거나 기존 계좌의 은행명, 계좌번호, 예금주를 수정할 수 있습니다.",
    steps: [
      "[온라인 헌금] 메뉴를 엽니다.",
      "상단 등록 칸에서 새 계좌를 추가하거나 아래 목록에서 기존 계좌 정보를 수정한 뒤 저장합니다.",
      "저장하면 온라인 헌금 페이지의 계좌 복사 정보까지 즉시 반영됩니다.",
    ],
    targetTab: "offering",
    targetLabel: "온라인 헌금 열기",
    publicHref: "/offering",
  },
  {
    id: "kb-pastor-bio",
    question: "담임목사님 인사말이나 학력, 경력은 어디서 고치나요?",
    keywords: [
      "담임목사",
      "목사님",
      "약력",
      "학력",
      "경력",
      "인사말",
      "프로필",
      "신점일",
    ],
    summary:
      "인사말은 [인사말] 탭에서, 학력 및 사역 경력은 [담임목사 약력] 탭에서 편집합니다.",
    steps: [
      "[담임목사 약력] 탭에서 실제 학력과 사역 경력을 입력합니다.",
      "임시 안내 문구를 정리한 뒤 상단 [변경사항 저장하기]를 눌러 반영합니다.",
    ],
    targetTab: "pastor-bio",
    targetLabel: "담임목사 약력 열기",
    publicHref: "/about",
  },
  {
    id: "kb-staff",
    question: "섬기는 사람들 증명사진과 담당 부서는 어떻게 수정하나요?",
    keywords: [
      "섬기는",
      "교역자",
      "강도사",
      "전도사",
      "장로",
      "증명사진",
      "사진",
      "크롭",
      "부서",
    ],
    summary:
      "[섬기는 사람들] 탭에서 순서 변경, 담당 부서 배지 입력, 3:4 증명사진 자르기 업로드를 모두 지원합니다.",
    steps: [
      "[섬기는 사람들] 탭에서 [사진 업로드 및 위치조정]을 눌러 얼굴 중심 3:4 비율로 자른 뒤 적용합니다.",
      "담당 부서 입력칸에 부서명을 입력하고 Enter를 누르면 배지가 추가됩니다.",
      "편집 후 상단 저장 버튼을 눌러 반영합니다.",
    ],
    targetTab: "staff",
    targetLabel: "섬기는 사람들 열기",
    publicHref: "/about/pastor",
  },
  {
    id: "kb-popups",
    question: "홈페이지 첫 화면에 부흥회 포스터나 안내 팝업창은 어떻게 띄우나요?",
    keywords: [
      "팝업",
      "팝업창",
      "포스터",
      "공지창",
      "안내창",
      "이벤트창",
      "오늘 하루",
      "배너창",
      "주보 일정",
      "주보 팝업",
      "일정 추출",
      "자동 추가",
    ],
    summary:
      "[팝업 공지]에서 직접 등록하거나 [주보로 일정 및 팝업 추가] 버튼을 눌러 주보의 행사 일정과 팝업을 확인 후 한 번에 추가할 수 있습니다.",
    steps: [
      "주보 내용으로 채우려면 관리자 첫 화면이나 [주보 올리기], [팝업 공지], [행사 일정] 상단의 [주보로 일정 및 팝업 추가] 또는 [주보에서 불러오기]를 누릅니다.",
      "추가될 행사 일정, 팝업 공지, 상단 한 줄 알림 목록을 미리 확인하고 맨 아래 [최종 확인 후 추가하기]를 누르면 선택된 항목만 반영됩니다.",
      "[팝업 공지] 메뉴에서는 포스터 사진 업로드와 노출 기간 지정을 직접 등록하거나 수정할 수도 있습니다.",
    ],
    targetTab: "popups",
    targetLabel: "팝업 공지 열기",
    publicHref: "/",
  },
  {
    id: "kb-cube",
    question: "메인 화면 배경 사진, 카카오톡 공유 대표 사진, 3D 회전 큐브 사진은 어떻게 바꾸나요?",
    keywords: [
      "배경",
      "배경사진",
      "배경 이미지",
      "대표 사진",
      "프로필 사진",
      "카카오톡",
      "카톡",
      "썸네일",
      "로고",
      "큐브",
      "3d",
      "메인 사진",
      "회전",
      "대문",
      "첫 화면",
      "히어로",
    ],
    summary:
      "[대표 및 배경 사진] 메뉴에서 메인 첫 화면 배경, 카카오톡 링크 공유 대표 사진, 비전 배너 사진, 세부 메뉴 공통 배경, 3D 회전 큐브 사진 6장을 모두 바꿀 수 있습니다.",
    steps: [
      "[대표 및 배경 사진] 메뉴를 열어 바꾸고 싶은 위치의 [새 사진 선택해 바꾸기] 버튼을 누릅니다.",
      "원래 기본 사진으로 돌리고 싶을 때는 옆의 [기본 사진 복원] 버튼을 누르면 즉시 돌아옵니다.",
      "아래 칸에서는 메인 우측 회전 큐브에 노출할 사진 6장도 함께 지정할 수 있습니다.",
    ],
    targetTab: "hero-cube",
    targetLabel: "대표 및 배경 사진 열기",
    publicHref: "/",
  },
  {
    id: "kb-history",
    question: "교회 역사 연혁과 2014년 초청장 같은 원본 사료 보관은 어디서 하나요?",
    keywords: [
      "역사",
      "연혁",
      "창립",
      "입당",
      "위임",
      "초대장",
      "초청장",
      "원본",
      "사료",
      "보관",
      "2014",
    ],
    summary:
      "[교회 역사] 탭에서 연도별 연혁을 수정하고 각 항목의 [+ 원본 이미지 보관] 버튼으로 사료를 영구 첨부할 수 있습니다.",
    steps: [
      "[교회 역사] 탭에서 해당 연도 항목 우측의 [+ 원본 이미지 보관] 버튼을 눌러 이미지를 올립니다.",
      "저장하면 교회 역사 타임라인에 사료 카드와 [원본 크게 보기] 링크가 함께 나타납니다.",
    ],
    targetTab: "history",
    targetLabel: "교회 역사 관리 열기",
    publicHref: "/about/history",
  },
  {
    id: "kb-youth",
    question: "유초등부, 중고등부, 청년부 예배 시간과 소식은 어디서 관리하나요?",
    keywords: [
      "유초등부",
      "중고등부",
      "청년부",
      "주일학교",
      "다음 세대",
      "다음세대",
      "예배 시간",
      "오전 11시",
    ],
    summary:
      "부서 예배 시간과 소개는 [다음 세대 안내] 탭에서, 부서별 활동 소식은 [다음 세대 부서 소식] 탭에서 관리합니다.",
    steps: [
      "전체 예배 시간표는 [예배 안내] 탭에서, 주일학교 부서별 시간(유초등부 오전 11:00 등)은 [다음 세대 안내] 탭에서 수정합니다.",
      "수련회나 성경학교 사진 및 영상 소식은 [다음 세대 부서 소식] 탭에 등록합니다.",
    ],
    targetTab: "youth",
    targetLabel: "다음 세대 안내 열기",
    publicHref: "/youth",
  },
  {
    id: "kb-resources",
    question: "하이델베르크 요리문답이나 공과 PDF 자료는 어디서 올리나요?",
    keywords: [
      "교재",
      "자료실",
      "하이델베르크",
      "요리문답",
      "공과",
      "성경 공부",
      "pdf",
      "다운로드",
    ],
    summary:
      "[교재 자료] 탭에서 주일 설교 요약, 소그룹 교재, 주일학교 교재, 성경 공부 파일을 업로드하고 교체합니다.",
    steps: [
      "[교재 자료] 탭 상단의 새 교재 자료 등록 칸에서 분류와 제목을 적고 파일을 선택해 바로 등록합니다.",
      "기존 자료의 제목, 분류, 첨부파일은 목록의 [수정 ▼]에서 바로 교체할 수 있습니다.",
      "일광학사관 입주원서 등 학사관 관련 서식은 [일광학사관] 게시판 탭에서 별도로 관리합니다.",
    ],
    targetTab: "resources",
    targetLabel: "교재 자료 열기",
    publicHref: "/resources",
  },
  {
    id: "kb-menus",
    question: "상단 메뉴 순서를 바꾸거나 새 게시판을 만들려면 어떻게 하나요?",
    keywords: [
      "메뉴",
      "상단 메뉴",
      "카테고리",
      "새 게시판",
      "게시판 만들기",
      "게시판 추가",
      "순서",
    ],
    summary:
      "[상단 메뉴 및 게시판 추가] 탭에서 코딩 없이 새 게시판을 생성하거나 메뉴 위치와 순서를 조정할 수 있습니다.",
    steps: [
      "[상단 메뉴 및 게시판 추가] 탭을 엽니다.",
      "상위 메뉴를 선택해 하위 메뉴 순서를 위아래로 옮기거나 새 커스텀 게시판을 개설합니다.",
    ],
    targetTab: "menus",
    targetLabel: "상단 메뉴 관리 열기",
  },
  {
    id: "kb-top-banner",
    question: "홈페이지 맨 위 한 줄 알림바 문구는 어디서 바꾸나요?",
    keywords: ["알림바", "한 줄", "배너", "상단 공지", "부흥회", "맨 위"],
    summary:
      "[최상단 한 줄 알림바] 탭에서 홈페이지 최상단에 순환 표시되는 문구를 한 줄씩 입력해 저장합니다.",
    steps: [
      "[최상단 한 줄 알림바] 탭에서 문구를 수정한 뒤 저장 버튼을 누릅니다.",
    ],
    targetTab: "top-banner",
    targetLabel: "최상단 알림바 열기",
  },
  {
    id: "kb-backup",
    question: "실수에 대비해 전체 데이터 백업 파일을 내려받을 수 있나요?",
    keywords: ["백업", "복원", "저장", "json", "초기화", "안전"],
    summary:
      "[데이터 백업 및 복원] 탭에서 홈페이지 전체 데이터를 JSON 파일 하나로 내려받고 언제든 복원할 수 있습니다.",
    steps: [
      "[데이터 백업 및 복원] 탭에서 백업 JSON 다운로드 버튼을 눌러 보관하세요.",
      "복원이 필요할 때 해당 JSON 파일을 선택하면 즉시 원상 복구됩니다.",
    ],
    targetTab: "backup",
    targetLabel: "데이터 백업 열기",
  },
  {
    id: "kb-domain",
    question:
      "사이트 운영 계정(도메인코리아, GitHub, Supabase, Vercel)은 각각 무엇으로 로그인하나요?",
    keywords: [
      "도메인",
      "도메인코리아",
      "호스팅케이알",
      "hosting.kr",
      "ilkwang.org",
      "ilkwang.or.kr",
      "호스팅",
      "서버",
      "배포",
      "깃헙",
      "깃허브",
      "github",
      "supabase",
      "수파베이스",
      "vercel",
      "구글",
      "계정",
      "로그인",
      "비밀번호",
      "dns",
    ],
    summary:
      "도메인코리아(Hosting.kr), GitHub, Vercel은 [교회 구글 계정]으로 로그인하고 Supabase만 [교회 깃헙 계정]으로 로그인합니다.",
    steps: [
      "도메인코리아 (Hosting.kr, ilkwang.org): 교회 공식 구글 계정으로 로그인 — 만료일 2027-04-11",
      "GitHub: 교회 공식 구글 계정으로 로그인",
      "Supabase: 반드시 [교회 GitHub 계정]으로 로그인 — 구글 로그인을 선택하면 데이터가 없는 빈 계정이 열립니다.",
      "Vercel: 교회 공식 구글 계정으로 로그인 — 웹 서버 배포 및 ADMIN_PASSWORD, PHOTO_ADMIN_PASSWORD 환경변수 관리",
    ],
  },
  {
    id: "kb-photo-account",
    question: "사진만 올리는 봉사자 전용 계정은 어떻게 운영하나요?",
    keywords: [
      "사진",
      "갤러리",
      "앨범",
      "봉사자",
      "업로드",
      "사진만",
      "계정",
      "두 가지",
      "권한",
      "photo",
    ],
    summary:
      "로그인 화면(/login)에서 [사진 업로드 전용] 탭을 선택해 로그인하면 앨범 사진 업로드 스튜디오(/admin/photos)만 열립니다.",
    steps: [
      "사이트 전체 관리자(admin, ADMIN_PASSWORD)는 모든 메뉴와 새가족 문의함을 관리합니다.",
      "사진 업로드 전용 계정(photo, PHOTO_ADMIN_PASSWORD)은 앨범 사진과 영상 업로드 및 앨범 정리만 허용되며 다른 설정이나 문의함에는 접근하지 못합니다.",
      "두 비밀번호는 Vercel 프로젝트 환경변수(ADMIN_PASSWORD, PHOTO_ADMIN_PASSWORD)에서 각각 설정하고 변경합니다.",
    ],
    targetTab: "gallery",
    targetLabel: "앨범 관리 열기",
    publicHref: "/admin/photos",
  },
];

interface NoticeDraftTemplate {
  readonly id: string;
  readonly badge: string;
  readonly label: string;
  readonly defaultCategory: NoticeItem["category"];
  readonly defaultAuthor: string;
  readonly buildTitle: (dateStr: string, detail: string) => string;
  readonly buildContent: (
    dateStr: string,
    timeAndPlace: string,
    extraNote: string
  ) => string;
}

const NOTICE_TEMPLATES: readonly NoticeDraftTemplate[] = [
  {
    id: "tpl-invite",
    badge: "전도",
    label: "가족 및 이웃 초청예배",
    defaultCategory: "예배",
    defaultAuthor: "전도위원회",
    buildTitle: (_d, detail) =>
      detail ? `${detail} 가족 및 이웃 초청예배 안내` : "가족 및 이웃 초청 감사예배 안내",
    buildContent: (dateStr, timeAndPlace, extraNote) =>
      `할렐루야! 사랑하는 가족과 친구, 이웃을 주님의 품으로 초대하는 초청 감사예배를 드립니다.\n\n• 일시: ${dateStr} ${timeAndPlace || "주일 1부(오전 9:30), 2부(오전 11:00) 예배"}\n• 장소: 일광교회 본당 (서울 성북구 동소문로 212-68)\n\n한 영혼을 품고 기도로 준비해 오신 모든 성도님께 감사드리며 처음 교회에 걸음하시는 분들을 온 교회가 따뜻한 사랑으로 환영합니다.${extraNote ? `\n\n• 추가 안내: ${extraNote}` : ""}`,
  },
  {
    id: "tpl-thanksgiving",
    badge: "절기",
    label: "추수감사주일",
    defaultCategory: "예배",
    defaultAuthor: "예배위원회",
    buildTitle: () => "추수감사주일 감사예배 안내",
    buildContent: (dateStr, timeAndPlace, extraNote) =>
      `한 해 동안 일광교회와 각 가정에 베풀어 주신 하나님의 신실하신 은혜에 감사하며 추수감사주일 예배를 하나님께 올려드립니다.\n\n• 일시: ${dateStr} ${timeAndPlace || "주일 오전 9:30(1부), 오전 11:00(2부), 오후 1:30(오후예배)"}\n• 장소: 일광교회 본당\n\n지나온 모든 걸음이 주님의 은혜였음을 고백하며 기도와 감사의 열매로 나아가는 복된 주일 되시기를 축복합니다.${extraNote ? `\n\n• 안내 사항: ${extraNote}` : ""}`,
  },
  {
    id: "tpl-christmas",
    badge: "절기",
    label: "성탄절 감사예배",
    defaultCategory: "예배",
    defaultAuthor: "예배위원회",
    buildTitle: () => "성탄절 축하 감사예배 및 발표 안내",
    buildContent: (dateStr, timeAndPlace, extraNote) =>
      `우리를 구원하시려 가장 낮은 곳으로 오신 예수 그리스도의 탄생을 기뻐하며 온 세대가 함께 성탄절 축하 감사예배를 드립니다.\n\n• 일시: ${dateStr} ${timeAndPlace || "오전 11:00"}\n• 장소: 일광교회 본당\n\n온 가족과 이웃이 함께 참석하셔서 구주 탄생의 기쁨과 평강을 나누시기 바랍니다.${extraNote ? `\n\n• 순서 및 안내: ${extraNote}` : ""}`,
  },
  {
    id: "tpl-newyear",
    badge: "절기",
    label: "송구영신 예배",
    defaultCategory: "예배",
    defaultAuthor: "예배위원회",
    buildTitle: () => "송구영신 예배 및 신년 첫 주일 안내",
    buildContent: (dateStr, timeAndPlace, extraNote) =>
      `한 해를 은혜로 마무리하고 새해 첫 시간을 하나님께 올려드리는 송구영신 예배로 모입니다.\n\n• 일시: ${dateStr} ${timeAndPlace || "밤 11:00"}\n• 장소: 일광교회 본당\n\n온 가족이 함께 기도로 새해를 열며 하나님께서 주시는 말씀과 소망으로 출발하시기 바랍니다.${extraNote ? `\n\n• 안내 사항: ${extraNote}` : ""}`,
  },
  {
    id: "tpl-easter",
    badge: "절기",
    label: "고난주간 및 부활절",
    defaultCategory: "예배",
    defaultAuthor: "예배위원회",
    buildTitle: () => "고난주간 특별새벽기도회 및 부활절 감사예배 안내",
    buildContent: (dateStr, timeAndPlace, extraNote) =>
      `십자가의 고난을 묵상하며 사망 권세를 이기시고 부활하신 주님을 찬양하는 부활절 감사예배를 드립니다.\n\n• 부활주일 예배: ${dateStr} ${timeAndPlace || "주일 오전 9:30, 오전 11:00"}\n• 장소: 일광교회 본당\n\n부활의 산 소망이 일광교회 모든 가정과 삶의 자리마다 충만하기를 기도합니다.${extraNote ? `\n\n• 추가 안내: ${extraNote}` : ""}`,
  },
  {
    id: "tpl-retreat",
    badge: "다음세대",
    label: "성경학교 및 수련회",
    defaultCategory: "소식",
    defaultAuthor: "교육위원회",
    buildTitle: (_d, detail) =>
      detail ? `${detail} 성경학교 및 수련회 안내` : "다음 세대 여름 성경학교 및 수련회 안내",
    buildContent: (dateStr, timeAndPlace, extraNote) =>
      `다음 세대 어린이와 청소년, 청년들이 말씀과 기도 안에서 믿음의 세대로 세워지는 수련회 일정을 안내해 드립니다.\n\n• 주요 기간: ${dateStr}\n• 장소 및 부서 일정: ${timeAndPlace || "유초등부, 중고등부, 청년부 각 부서별 공지 참조"}\n\n다음 세대와 섬기시는 교역자, 교사 선생님들의 안전과 성령 충만한 은혜를 위해 온 성도님들의 중보기도를 부탁드립니다.${extraNote ? `\n\n• 문의 및 신청: ${extraNote}` : ""}`,
  },
  {
    id: "tpl-dormitory",
    badge: "학사관",
    label: "일광학사관 입사 모집",
    defaultCategory: "모집",
    defaultAuthor: "학사관 위원회",
    buildTitle: (_d, detail) =>
      detail ? `${detail} 일광교회 일광학사관 입사생 모집 안내` : "일광교회 일광학사관 입사생 모집 안내",
    buildContent: (dateStr, timeAndPlace, extraNote) =>
      `일광교회에서는 서울 지역 대학에 재학(입학 예정) 중이거나 취업을 준비하는 기독 청년들을 위해 믿음의 생활 공동체인 '일광학사관' 신입 관생을 모집합니다.\n\n• 모집 대상: 기독교인 대학생 및 취업 준비 청년\n• 접수 기간: ${dateStr} 부터 충원 시까지\n• 위치 및 환경: ${timeAndPlace || "서울 성북구 동소문로 212-68 일광교회 인근 (4호선 길음역 도보 10분)"}\n• 제출 서류: 입주원서 및 자기소개서 ([다음 세대 -> 일광학사관] 게시판 또는 [교재 자료]에서 양식 다운로드)\n• 문의 및 접수: 교회 사무실(02-927-0691), 이메일(ilkwang@ilkwang.or.kr)${extraNote ? `\n\n• 추가 안내: ${extraNote}` : ""}`,
  },
];

interface ChatTurn {
  readonly id: string;
  readonly query: string;
  readonly matchedEntries: readonly KnowledgeEntry[];
}

function matchKnowledgeEntries(rawQuery: string): readonly KnowledgeEntry[] {
  const normalized = rawQuery.trim().toLowerCase();
  if (!normalized) return [BUILTIN_KNOWLEDGE_BASE[0]];

  const tokens = normalized
    .split(/[\s,?.!/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1);

  const scored = BUILTIN_KNOWLEDGE_BASE.map((entry) => {
    let score = 0;
    const hayQuestion = entry.question.toLowerCase();
    const haySummary = entry.summary.toLowerCase();

    for (const kw of entry.keywords) {
      const lowKw = kw.toLowerCase();
      if (normalized.includes(lowKw)) {
        score += 6;
      }
      for (const tok of tokens) {
        if (tok.length >= 2 && (lowKw.includes(tok) || tok.includes(lowKw))) {
          score += 3;
        }
      }
    }
    for (const tok of tokens) {
      if (tok.length >= 2) {
        if (hayQuestion.includes(tok)) score += 2;
        if (haySummary.includes(tok)) score += 1;
      }
    }
    return { entry, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return [BUILTIN_KNOWLEDGE_BASE[0], BUILTIN_KNOWLEDGE_BASE[3]];
  }
  const topScore = scored[0].score;
  const filtered = scored.filter(
    (item, idx) => idx === 0 || (idx === 1 && item.score >= topScore * 0.65)
  );
  return filtered.map((s) => s.entry);
}

interface AdminSmartAssistantProps {
  readonly open: boolean;
  readonly onOpenChange: (nextOpen: boolean) => void;
  readonly onNavigateTab: (
    tab: AssistantJumpTarget,
    boardKey?: string
  ) => void;
  readonly onInsertNoticeDraft: (draftItem: {
    readonly category: NoticeItem["category"];
    readonly title: string;
    readonly author: string;
    readonly date: string;
    readonly content: string;
    readonly isPinned: boolean;
  }) => void;
}

export function AdminSmartAssistant({
  open,
  onOpenChange,
  onNavigateTab,
  onInsertNoticeDraft,
}: AdminSmartAssistantProps) {
  const [subMode, setSubMode] = useState<"qa" | "templates" | "handover">("qa");
  const [queryInput, setQueryInput] = useState("");
  const [chatHistory, setChatHistory] = useState<readonly ChatTurn[]>([]);
  const [jumpedFeedbackId, setJumpedFeedbackId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Template generator state
  const [selectedTplId, setSelectedTplId] = useState<string>(
    NOTICE_TEMPLATES[0].id
  );
  const [tplDate, setTplDate] = useState<string>(() => getKstDateString());
  const [tplDetailPrefix, setTplDetailPrefix] = useState("");
  const [tplTimePlace, setTplTimePlace] = useState("");
  const [tplExtra, setTplExtra] = useState("");
  const [tplPinned, setTplPinned] = useState(true);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Optional external Gemini API state (session-only)
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem("ilkwang_optional_gemini_key") ?? "";
  });
  const [externalPrompt, setExternalPrompt] = useState("");
  const [externalReply, setExternalReply] = useState<string | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () =>
      NOTICE_TEMPLATES.find((t) => t.id === selectedTplId) ??
      NOTICE_TEMPLATES[0],
    [selectedTplId]
  );

  const previewTitle = useMemo(
    () => selectedTemplate.buildTitle(tplDate, tplDetailPrefix.trim()),
    [selectedTemplate, tplDate, tplDetailPrefix]
  );

  const previewContent = useMemo(
    () =>
      selectedTemplate.buildContent(
        tplDate,
        tplTimePlace.trim(),
        tplExtra.trim()
      ),
    [selectedTemplate, tplDate, tplTimePlace, tplExtra]
  );

  useEffect(() => {
    if (open && subMode === "qa" && chatHistory.length > 0) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [chatHistory.length, open, subMode]);

  function handleAskQuestion(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const matches = matchKnowledgeEntries(trimmed);
    const turn: ChatTurn = {
      id: createClientSafeId("turn"),
      query: trimmed,
      matchedEntries: matches,
    };
    setChatHistory((prev) => [...prev.slice(-9), turn]);
    setQueryInput("");
  }

  function handleJump(
    entryId: string,
    tab: AssistantJumpTarget,
    boardKey?: string
  ) {
    onNavigateTab(tab, boardKey);
    setJumpedFeedbackId(entryId);
    setTimeout(() => {
      setJumpedFeedbackId((prev) => (prev === entryId ? null : prev));
    }, 2200);
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      onOpenChange(false);
    }
  }

  async function handleCopyDraft() {
    try {
      await navigator.clipboard.writeText(`${previewTitle}\n\n${previewContent}`);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    } catch {
      // Ignore clipboard permission errors cleanly
    }
  }

  async function handleRunOptionalExternalAi(e: React.FormEvent) {
    e.preventDefault();
    setExternalLoading(true);
    setExternalError(null);
    setExternalReply(null);
    try {
      if (typeof window !== "undefined") {
        if (geminiApiKey.trim()) {
          window.sessionStorage.setItem(
            "ilkwang_optional_gemini_key",
            geminiApiKey.trim()
          );
        } else {
          window.sessionStorage.removeItem("ilkwang_optional_gemini_key");
        }
      }
      const response = await fetch("/api/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: geminiApiKey.trim(),
          prompt: externalPrompt.trim(),
        }),
      });
      const data = await readJsonResponseSafe<{
        readonly reply?: string;
        readonly error?: string;
      }>(response);
      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? "외부 AI 응답을 가져오지 못했습니다.");
      }
      setExternalReply(data.reply);
    } catch (err: unknown) {
      setExternalError(
        err instanceof Error ? err.message : "요청 처리 중 오류가 발생했습니다."
      );
    } finally {
      setExternalLoading(false);
    }
  }

  const quickQuestions: readonly string[] = [
    "매주 할 일",
    "사이트 계정 로그인",
    "주보 한글(.hwp)",
    "설교 유튜브",
    "일광학사관 수정",
    "헌금 계좌 변경",
    "섬기는 사람들 사진",
    "3D 큐브 사진",
    "교회 역사 원본 보관",
    "백업 다운로드",
  ];

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2.5">
      {open && (
        <div
          role="dialog"
          aria-label="일광교회 관리자 운영 도우미 챗봇"
          className="w-[calc(100vw-2rem)] sm:w-[400px] md:w-[420px] max-h-[calc(100dvh-6.5rem)] sm:max-h-[620px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        >
          {/* Chatbot Header (Matches FloatingGuideBot visual identity) */}
          <div className="bg-[#1a2744] text-white px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <img
                src="/gapck-logo.svg"
                alt="일광교회"
                className="w-5 h-7 object-contain"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold">일광교회 운영 도우미</p>
                  <span className="px-2 py-0.5 rounded-full bg-[#2E7D32] text-[10px] font-bold">
                    관리자 전용
                  </span>
                </div>
                <p className="text-[11px] text-[#a3c9a8]">
                  궁금한 홈페이지 관리 방법을 바로 안내합니다
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="운영 도우미 닫기"
              className="p-2 -mr-2 rounded-lg text-white/75 hover:text-white hover:bg-white/10 text-lg leading-none transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Compact 3-Mode Switcher */}
          <div className="bg-white border-b border-gray-200 px-3 py-2 grid grid-cols-3 gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSubMode("qa")}
              className={`py-1.5 rounded-xl text-xs font-bold transition-colors ${
                subMode === "qa"
                  ? "bg-[#2E7D32] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-[#E8F5E9]"
              }`}
            >
              질문 도우미
            </button>
            <button
              type="button"
              onClick={() => setSubMode("templates")}
              className={`py-1.5 rounded-xl text-xs font-bold transition-colors ${
                subMode === "templates"
                  ? "bg-[#2E7D32] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-[#E8F5E9]"
              }`}
            >
              공지 초안
            </button>
            <button
              type="button"
              onClick={() => setSubMode("handover")}
              className={`py-1.5 rounded-xl text-xs font-bold transition-colors ${
                subMode === "handover"
                  ? "bg-[#2E7D32] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-[#E8F5E9]"
              }`}
            >
              인수인계
            </button>
          </div>

          {/* Scrollable Chatbot Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FAF8]">
            {/* =====================================================
                MODE 1: CONVERSATIONAL Q&A CHATBOT
               ===================================================== */}
            {subMode === "qa" && (
              <>
                <div className="bg-white rounded-xl p-3.5 text-xs text-gray-700 leading-relaxed shadow-xs border border-gray-100">
                  반갑습니다! <strong>일광교회 관리자 전용 운영 도우미</strong>입니다. 궁금하신 기능을 아래 버튼에서 고르거나 하단 입력창에 편하게 적어 주세요.
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {quickQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleAskQuestion(q)}
                      className="px-2.5 py-1.5 rounded-full bg-white border border-[#2E7D32]/30 text-[11px] font-semibold text-[#1a2744] hover:bg-[#E8F5E9] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {chatHistory.length > 0 && (
                  <div className="space-y-3 pt-1">
                    {chatHistory.map((turn) => (
                      <div key={turn.id} className="space-y-2">
                        {/* User Bubble */}
                        <div className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-[#1a2744] text-white px-3.5 py-2 text-xs font-semibold shadow-2xs">
                            {turn.query}
                          </div>
                        </div>

                        {/* Bot Answer Bubble(s) */}
                        {turn.matchedEntries.map((entry) => {
                          const feedbackKey = `${turn.id}-${entry.id}`;
                          return (
                            <div
                              key={entry.id}
                              className="bg-white rounded-xl p-3.5 border border-[#2E7D32]/25 space-y-2 shadow-xs"
                            >
                              <p className="text-xs font-bold text-[#2E7D32] leading-snug">
                                {entry.question}
                              </p>
                              <p className="text-xs text-gray-700 font-semibold leading-relaxed">
                                {entry.summary}
                              </p>
                              <ul className="space-y-1 text-[11px] text-gray-600 leading-relaxed">
                                {entry.steps.map((step) => (
                                  <li key={step}>• {step}</li>
                                ))}
                              </ul>

                              <div className="pt-1 flex flex-wrap items-center gap-2">
                                {entry.targetTab && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleJump(
                                        feedbackKey,
                                        entry.targetTab!,
                                        entry.targetBoardKey
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-[11px] font-bold transition-colors"
                                  >
                                    {jumpedFeedbackId === feedbackKey
                                      ? "✓ 메뉴를 열었습니다"
                                      : `${entry.targetLabel ?? "해당 관리 메뉴 열기"} →`}
                                  </button>
                                )}
                                {entry.publicHref && (
                                  <Link
                                    href={entry.publicHref}
                                    className="text-[11px] font-bold text-[#1a2744] underline underline-offset-4 hover:text-[#2E7D32]"
                                  >
                                    성도 화면 보기 ↗
                                  </Link>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </>
            )}

            {/* =====================================================
                MODE 2: ZERO-API NOTICE & DORMITORY DRAFT GENERATOR
               ===================================================== */}
            {subMode === "templates" && (
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-3 text-xs text-gray-700 leading-relaxed border border-gray-100 shadow-xs">
                  절기 예배, 초청주일, 수련회, 일광학사관 모집 안내문 초안을 즉시 완성해 <strong>교회 소식</strong>에 넣거나 복사합니다.
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {NOTICE_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedTplId(tpl.id)}
                      className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                        selectedTplId === tpl.id
                          ? "bg-[#1a2744] text-white border-[#1a2744]"
                          : "bg-white text-gray-700 border-gray-200 hover:border-[#2E7D32]"
                      }`}
                    >
                      [{tpl.badge}] {tpl.label}
                    </button>
                  ))}
                </div>

                <div className="bg-white rounded-xl p-3.5 border border-gray-200 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        기준 일자
                      </label>
                      <input
                        type="date"
                        value={tplDate}
                        onChange={(e) => setTplDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        연도 및 학기 수식어
                      </label>
                      <input
                        type="text"
                        value={tplDetailPrefix}
                        onChange={(e) => setTplDetailPrefix(e.target.value)}
                        placeholder="예: 2027학년도 1학기"
                        className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      예배 시간 및 장소 (비워두면 기본값 입력)
                    </label>
                    <input
                      type="text"
                      value={tplTimePlace}
                      onChange={(e) => setTplTimePlace(e.target.value)}
                      placeholder="예: 주일 오전 11:00 본당"
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      추가 안내 문구 (선택)
                    </label>
                    <input
                      type="text"
                      value={tplExtra}
                      onChange={(e) => setTplExtra(e.target.value)}
                      placeholder="예: 예배 후 애찬이 준비되어 있습니다"
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3.5 border border-[#2E7D32]/30 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#2E7D32]">
                      초안 미리보기 ({selectedTemplate.defaultCategory})
                    </span>
                    <label className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1a2744] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tplPinned}
                        onChange={(e) => setTplPinned(e.target.checked)}
                        className="rounded border-gray-300 text-[#2E7D32]"
                      />
                      상단 고정
                    </label>
                  </div>
                  <p className="text-xs font-black text-[#1a2744]">
                    {previewTitle}
                  </p>
                  <p className="text-[11px] text-gray-700 whitespace-pre-line leading-relaxed bg-[#F8FAF8] rounded-lg border border-gray-200 p-2.5 max-h-40 overflow-y-auto">
                    {previewContent}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onInsertNoticeDraft({
                          category: selectedTemplate.defaultCategory,
                          title: previewTitle,
                          author: selectedTemplate.defaultAuthor,
                          date: getKstDateString(),
                          content: previewContent,
                          isPinned: tplPinned,
                        });
                        if (typeof window !== "undefined" && window.innerWidth < 640) {
                          onOpenChange(false);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-[11px] font-bold transition-colors"
                    >
                      + 교회 소식에 바로 넣기
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyDraft()}
                      className="px-3 py-1.5 rounded-full border border-gray-300 bg-white hover:border-[#1a2744] text-[11px] font-bold text-[#1a2744]"
                    >
                      {copiedNotice ? "✓ 복사 완료!" : "본문 복사"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================
                MODE 3: HANDOVER GUIDE & OPTIONAL EXTERNAL AI
               ===================================================== */}
            {subMode === "handover" && (
              <div className="space-y-3">
                <div className="bg-white rounded-xl border border-gray-200 p-3.5 space-y-1.5 shadow-xs">
                  <span className="px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold">
                    매주 5분 루틴
                  </span>
                  <h3 className="text-xs font-black text-[#1a2744]">
                    후임자를 위한 주간 업데이트 순서
                  </h3>
                  <ul className="text-[11px] text-gray-600 space-y-1 leading-relaxed">
                    <li>1. [주보 안내]에서 주보 .hwp 파일 업로드</li>
                    <li>2. [설교 영상]에서 유튜브 설교 주소 등록</li>
                    <li>3. [새가족 및 문의함]에서 온라인 접수 확인</li>
                  </ul>
                </div>

                <div className="bg-white rounded-xl border border-[#2E7D32]/30 p-3.5 space-y-2 shadow-xs">
                  <span className="px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold">
                    필수 계정 인수인계
                  </span>
                  <h3 className="text-xs font-black text-[#1a2744]">
                    사이트 인프라별 로그인 방법
                  </h3>
                  <ul className="text-[11px] text-gray-700 space-y-1.5 leading-relaxed">
                    <li>
                      • <strong>도메인코리아</strong> (Hosting.kr):{" "}
                      <span className="font-bold text-[#1a2744]">교회 구글 계정</span>으로 로그인
                    </li>
                    <li>
                      • <strong>GitHub</strong>:{" "}
                      <span className="font-bold text-[#1a2744]">교회 구글 계정</span>으로 로그인
                    </li>
                    <li>
                      • <strong>Supabase</strong>:{" "}
                      <span className="font-bold text-[#2E7D32]">교회 깃헙 계정</span>으로 로그인 — 구글 로그인 아님
                    </li>
                    <li>
                      • <strong>Vercel</strong>:{" "}
                      <span className="font-bold text-[#1a2744]">교회 구글 계정</span>으로 로그인
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-3.5 space-y-1.5 shadow-xs">
                  <span className="px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold">
                    유지보수 매뉴얼 안내
                  </span>
                  <h3 className="text-xs font-black text-[#1a2744]">
                    운영 및 인수인계 문서 위치
                  </h3>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    프로젝트 폴더의 <code className="font-mono font-bold">docs/HANDOVER.md</code>와{" "}
                    <code className="font-mono font-bold">AGENTS.md</code>에 계정 로그인 방식과 전체 관리 절차가 정리되어 있습니다.
                  </p>
                </div>

                <details className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs">
                  <summary className="cursor-pointer text-xs font-black text-[#1a2744]">
                    선택사항: 외부 AI (Gemini 무료 API 키) 연결
                  </summary>
                  <div className="mt-3 space-y-2.5 text-[11px] text-gray-600 leading-relaxed">
                    <p>
                      기본 안내와 초안 생성은 API 키 없이 100% 무료로 작동합니다. 완전히 새로운 자유 문안을 생성하고 싶을 때만 현재 브라우저 세션에 Gemini API 키를 입력해 사용하세요.
                    </p>
                    <form onSubmit={handleRunOptionalExternalAi} className="space-y-2">
                      <input
                        type="password"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="Gemini API Key 입력 (선택, 서버 미저장)"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-mono"
                      />
                      <textarea
                        rows={3}
                        value={externalPrompt}
                        onChange={(e) => setExternalPrompt(e.target.value)}
                        placeholder="예: 창립기념주일 환영 문자 초안을 따뜻하게 작성해 줘."
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs"
                      />
                      <button
                        type="submit"
                        disabled={externalLoading}
                        className="w-full py-2 rounded-lg bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs font-bold disabled:opacity-50"
                      >
                        {externalLoading ? "AI 작성 중..." : "외부 AI로 문구 생성"}
                      </button>
                    </form>

                    {externalError && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-[11px] font-bold text-red-700">
                        {externalError}
                      </div>
                    )}
                    {externalReply && (
                      <div className="rounded-lg bg-[#F8FAF8] border border-gray-200 p-3 text-xs text-gray-800 whitespace-pre-line leading-relaxed">
                        {externalReply}
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* Sticky Messenger Input Bar (Q&A Mode) */}
          {subMode === "qa" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskQuestion(queryInput);
              }}
              className="border-t border-gray-200 bg-white p-3 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="궁금한 운영 방법을 물어보세요..."
                className="flex-1 rounded-full border border-gray-300 bg-[#F8FAF8] px-3.5 py-2 text-xs focus:border-[#2E7D32] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-full bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs font-bold transition-colors shrink-0"
              >
                질문
              </button>
            </form>
          )}
        </div>
      )}

      {/* Circular Floating Chatbot Launcher Button (Admin Mode Only) */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={open ? "관리자 운영 도우미 챗봇 닫기" : "관리자 운영 도우미 챗봇 열기"}
        title="일광교회 관리자 운영 도우미"
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#1a2744] hover:bg-[#2E7D32] text-white shadow-xl flex items-center justify-center relative transition-transform hover:scale-105"
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
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
        <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#4caf50] border-2 border-white" />
      </button>
    </div>
  );
}
