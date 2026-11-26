# Ilkwang Church Official Website and AI Reference Kit — ilkwang-church-web

> **Created**: 2026-11-12 20:30 KST  
> **Last updated**: 2026-11-26 12:12 KST  
> **Modified by**: Gemini 4 Carbon (High), Antigravity  
> **Version**: 3.0.0  

Open reference repository of the official website for **Ilkwang Church** (`일광교회`, https://ilkwang.org), shared together with our full build chronicle so fellow pastors and church workers can point AI coding agents (`Claude Code`, `Cursor`, `Antigravity`, `Codex`) at a verified, zero-subscription Korean church web platform.

## 1. Why This Reference Exists

Many small and midsize churches either pay recurring monthly builder fees or struggle to maintain aging legacy boards (`XE`, `Gnuboard`) where mobile reading, iPhone `.heic` photo uploads, and Hancom `.hwp` weekly bulletins break. This project runs on **`Next.js 16.4.6`**, **`Supabase` Free**, and **`Vercel` Hobby** (`$0/month` platform cost aside from annual domain renewal), while letting pastors and church staff handle all weekly tasks in `/admin` with zero coding.

## 2. Core Ministry Features

- **Native Korean `.hwp` and `.hwpx` Bulletin Parser** (`src/lib/hwp-parser.ts`, `/admin?tab=bulletin`): Extracts worship liturgy, scripture, preacher, separated `교회 소식` and `교회 일정` boxes, and congregation celebrations directly from Hancom files (single or multi-file bulk upload) for instant mobile reading without viewer apps, plus collapsible multi-page scan views (`imageUrls`) for historical bulletins.
- **1-Click YouTube Sermon Sync** (`src/app/api/youtube-sync/route.ts`, `/admin?tab=sermons`): Pulls new sermons from a church YouTube `@handle` without an API key and classifies Korean worship service categories automatically.
- **2-Role Admin and Volunteer Photo Studio** (`src/lib/admin-auth.ts`, `/login`): Separates full administration (`ADMIN_PASSWORD` -> `/admin`) from volunteer album uploads (`PHOTO_ADMIN_PASSWORD` -> `/admin/photos`), with live `Supabase` database and storage quota bars at the top of both screens (`src/components/AdminUsageMeter.tsx`) and click-anchored save confirmations right next to every action button (`src/components/ActionFeedbackBubble.tsx`).
- **iPhone `.heic` and `50 MB` Video Direct Upload** (`src/lib/client-upload.ts`, `src/app/api/upload/presign/route.ts`): Converts `.heic` photos in the browser and uploads media directly to `Supabase` Storage via signed `PUT` URLs with binary magic-byte verification.
- **No-Code Menus, Custom Boards, and Zero-API Assistant** (`src/components/AdminMenusAndBoardsStudio.tsx`, `src/components/AdminSmartAssistant.tsx`): Create custom ministry boards (such as `/boards/dormitory`), move posts across 7+ boards, receive Newcomer inquiries (`/contact`), export 1-click JSON backups, and consult an offline Korean admin guide bot.

## 3. Quick Start (Runs Locally in 1 Minute Without Cloud Keys)

```bash
git clone https://github.com/zooneng/ilkwang-church-web.git my-church-web
cd my-church-web
npm install
npm run dev
```

Open `http://localhost:3000` (and `http://localhost:3000/login` for instant local switch buttons to both `사이트 관리자 모드` and `사진 업로드 전용`). Without `.env.local`, all changes persist cleanly to local `data/*.json` files. When ready for production, run `supabase/schema.sql` in `Supabase` and set `.env.example` variables on `Vercel`.

## 4. Starter Prompt for Pastors Using an AI Coding Agent

Copy the prompt below into `Claude Code`, `Cursor`, `Antigravity`, or `Codex` inside the cloned folder:

```text
AGENTS.md와 docs/BUILD-PROCESS-AND-AI-GUIDE.md를 먼저 읽고 이 저장소를 우리 교회 홈페이지로 맞게 개편해 주세요.
1) 교회 기본 정보(교회명, 교단, 주소, 전화번호, 예배 시간, 담임목사 및 교역자, 유튜브 채널 주소)는 제가 알려 드리는 확인된 사실만 반영하고 임의로 지어낸 연혁이나 샘플 게시글은 넣지 마세요.
2) 먼저 클라우드 연결 없이 로컬(npm run dev)에서 동작하게 구성한 뒤, 제가 첨부하는 우리 교회 주보(.hwp 또는 .hwpx) 샘플 파일이 /admin?tab=bulletin에서 정확히 추출되는지 점검해 주세요.
```

## 5. Repository Documentation Map

- [`docs/BUILD-PROCESS-AND-AI-GUIDE.md`](docs/BUILD-PROCESS-AND-AI-GUIDE.md): Step-by-step Korean chronicle of how Ilkwang Church built, debugged, audited, and deployed this site with AI, plus a 5-step guide for other pastors.
- [`AGENTS.md`](AGENTS.md): Architecture map and 5-step church adaptation checklist read automatically by AI coding tools.
- [`supabase/schema.sql`](supabase/schema.sql): Complete `Supabase` Postgres table, `RLS` policies, `church-uploads` storage bucket, and `church_usage_stats()` RPC function.
- [`docs/HANDOVER.md`](docs/HANDOVER.md): Non-technical weekly operator manual and account handover template.

---

# 일광교회 공식 홈페이지 오픈 레퍼런스 및 AI 제작 가이드 — ilkwang-church-web

**일광교회** (https://ilkwang.org) 공식 홈페이지 소스 코드와 전체 제작 과정을 다른 교회 목회자분들과 사역자분들께 공개하는 레퍼런스 저장소입니다. `Claude Code`, `Cursor`, `Antigravity`, `Codex` 같은 `AI` 코딩 도구에 이 저장소를 레퍼런스로 지정하면 외주 제작비나 매달 나가는 웹빌더 구독료 없이 우리 교회에 맞는 자체 운영 홈페이지를 구축하실 수 있습니다.

## 1. 공개 목적

중소형 교회가 홈페이지를 운영할 때 겪는 가장 큰 어려움은 매달 고정 비용이 드는 유료 빌더에 묶이거나 오래된 게시판 (`XE`, `그누보드`)에서 모바일 화면 깨짐, 아이폰 `.heic` 사진 업로드 오류, 한글 (`.hwp`, `.hwpx`) 주보 열람 불편을 겪는 점입니다. 이 프로젝트는 **`Next.js 16.4.6`**, **`Supabase` 무료 요금제**, **`Vercel` 무료 호스팅**을 결합해 도메인 연장비 외 **월 고정 비용 `0원`**으로 운영하면서도 일상 행정은 코딩 없이 `/admin` 화면에서 마우스로 처리하도록 설계했습니다.

## 2. 한국 교회 사역 맞춤형 주요 기능

- **한글 주보 자동 추출 및 일괄 등록** (`.hwp`, `.hwpx`, `src/lib/hwp-parser.ts`, `/admin?tab=bulletin`): 매주 작성하시는 한글 주보 파일을 그대로 올리면 예배 순서, 설교 본문, 분리된 **교회 소식**과 **교회 일정**, 축하 소식을 자동 추출해 성도님들이 스마트폰에서 바로 읽으실 수 있습니다. 과거 스캔 주보 이미지 (`imageUrls`) 접기 및 펼치기도 지원합니다.
- **유튜브 설교 채널 원클릭 연동** (`src/app/api/youtube-sync/route.ts`, `/admin?tab=sermons`): 별도 `API` 키 발급 없이 교회 유튜브 `@채널주소`만으로 최신 설교 영상을 불러오고 예배 구분을 자동 분류합니다.
- **2종 관리자 권한 분리 및 실시간 저장 용량 표시** (`src/lib/admin-auth.ts`, `src/components/AdminUsageMeter.tsx`): 전체 사역을 관리하는 **사이트 관리자 모드** (`admin`)와 앨범 업로드만 허용하는 **사진 업로드 전용 계정** (`photo`)을 분리했습니다. 두 화면 최상단에는 `Supabase` 데이터베이스 (`500 MB`)와 사진 및 파일 (`1.0 GB`) 실시간 사용량이 표시되며 저장 버튼을 누른 자리 바로 옆에 확인 문구가 나타납니다 (`src/components/ActionFeedbackBubble.tsx`).
- **아이폰 사진 자동 변환 및 대용량 영상 업로드** (`src/lib/client-upload.ts`, `src/app/api/upload/presign/route.ts`): 아이폰 `.heic` 사진을 브라우저에서 자동 변환하고 최대 `50 MB` 동영상까지 서버 용량 제한 없이 `Supabase` 저장소로 직접 업로드합니다.
- **메뉴 및 맞춤 게시판 생성과 오프라인 운영 도우미** (`src/components/AdminMenusAndBoardsStudio.tsx`, `src/components/AdminSmartAssistant.tsx`): 학사관이나 선교 게시판 같은 맞춤 게시판을 직접 추가하고 7개 이상 게시판 사이에서 글을 자유롭게 이동할 수 있으며 유료 `AI` 키 없이 동작하는 관리자 안내 챗봇과 1클릭 `JSON` 백업을 내장했습니다.

## 3. 1분 로컬 실행 방법 (클라우드 설정 전 바로 체험)

```bash
git clone https://github.com/zooneng/ilkwang-church-web.git my-church-web
cd my-church-web
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` (관리자 체험은 `http://localhost:3000/login`)을 열면 별도 데이터베이스 연결 없이도 로컬 `data/*.json` 파일로 모든 기능을 바로 시험해 보실 수 있습니다. 실제 인터넷 배포 시에는 `supabase/schema.sql`을 실행하고 `.env.example`의 환경변수를 `Vercel`에 등록하면 됩니다.

## 4. 다른 목회자분들이 AI에게 바로 복사해 건네는 시작 프롬프트

클론한 폴더를 `AI` 코딩 도구로 열고 아래 문구를 복사해 우리 교회 정보와 함께 전달해 보십시오.

```text
AGENTS.md와 docs/BUILD-PROCESS-AND-AI-GUIDE.md를 먼저 읽고 이 저장소를 우리 교회 홈페이지로 맞게 개편해 주세요.
1) 교회 기본 정보(교회명, 교단, 주소, 전화번호, 예배 시간, 담임목사 및 교역자, 유튜브 채널 주소)는 제가 알려 드리는 확인된 사실만 반영하고 임의로 지어낸 연혁이나 샘플 게시글은 넣지 마세요.
2) 먼저 클라우드 연결 없이 로컬(npm run dev)에서 동작하게 구성한 뒤, 제가 첨부하는 우리 교회 주보(.hwp 또는 .hwpx) 샘플 파일이 /admin?tab=bulletin에서 정확히 추출되는지 점검해 주세요.
```

## 5. 상세 문서 안내

- [**`docs/BUILD-PROCESS-AND-AI-GUIDE.md`**](docs/BUILD-PROCESS-AND-AI-GUIDE.md): 일광교회 홈페이지를 처음부터 끝까지 `AI`와 함께 만들며 겪은 시행착오, 문제 해결 과정, 타 교회 적용 5단계 안내서입니다.
- [**`AGENTS.md`**](AGENTS.md): `AI` 코딩 도구가 프로젝트를 열자마자 읽는 전체 구조 지도 및 타 교회 개편 점검표입니다.
- [**`supabase/schema.sql`**](supabase/schema.sql): `Supabase` 데이터베이스 테이블, 보안 정책 (`RLS`), 파일 버킷, 실시간 용량 조회 함수를 한 번에 생성하는 `SQL` 스크립트입니다.
- [**`docs/HANDOVER.md`**](docs/HANDOVER.md): 비전공자 교역자와 행정 간사를 위한 주간 5분 운영 및 인수인계 매뉴얼입니다.
