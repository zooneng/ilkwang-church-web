# Ilkwang Church Website Development Proposal and Reference Report

> **Created**: 2026-11-13 23:09 KST  
> **Last updated**: 2026-11-13 23:12 KST  
> **Modified by**: Claude Opus 4.6, Antigravity  
> **Version**: 1.0.0  

## Document Overview

| Field | Details |
|---|---|
| **Recipient** | Senior Pastor Shin Jeom-il (`신점일 담임목사님`), Ilkwang Church (`GAPCK`) |
| **Prepared Date** | November 13, 2026 |
| **Purpose** | Share Phase 1 website restoration results and propose 5 phased development initiatives with verified Korean and international church benchmarks |
| **Cost Principle** | Zero additional monthly SaaS subscription cost across all three rollout stages |

## 1. Completed Phase 1 Restoration Summary

Before proposing future enhancements, all visual assets and historical archives from `ilkwang.org` and `ilkwang.or.kr` have been preserved and rebuilt into a self-managed church web platform:

| Area | Completed Phase 1 Deliverable | Operational Benefit |
|---|---|---|
| **Main Hero and 3D Photo Cube** | Restored navy (`#1a2744`) and forest green (`#2E7D32`) palette, sanctuary hero backdrop, interactive 3-axis pointer-drag 3D photo cube, and transparent `GAPCK` emblem | Preserves visual familiarity while restricting 6-face cube photo selection exclusively to administrators |
| **Album Photo Gallery** | Migrated legacy `ilkwang.or.kr` event albums with original historical dates into a clean album gallery | Eliminated truncated titles and added full post body descriptions inside the photo lightbox |
| **Weekly Bulletin Reader** (`주보 안내`) | Built automatic `.hwp` and `.hwpx` text extraction for worship liturgy, scripture, sermon metadata, and church announcements | Congregation members read weekly bulletins directly on mobile and desktop browsers without installing Hancom viewer apps |
| **Dynamic Menus and Compact Admin** | Added no-code category and board management plus single-line accordion rows with `10`, `20`, and `50` item pagination | Prevents endless vertical scrolling even after hundreds of bulletins and sermons accumulate |
| **Korean Standard Orthography** | Applied standard word spacing across all navigation menus and board titles (`교회 소개`, `예배와 말씀`, `다음 세대`, `주보 안내`, `오시는 길`) | Establishes an accurate and dignified public church communication standard |

## 2. Five Website Development Proposals and Verified Church Benchmarks

### Proposal 1. First-Time Visitor Journey — Dedicated `"처음 오셨나요?"` Guide

- **Reference Benchmarks**: **Redeemer Presbyterian Church** ([redeemer.com](https://www.redeemer.com/)), **Bridgetown Church** ([bridgetown.church](https://bridgetown.church/))
- **Pastoral Rationale**: Neighbors moving into Seongbuk-gu or visiting church for the first time look first for practical Sunday morning directions rather than historical timelines.
- **Application to Ilkwang Church**:
  1. Place a warm `"처음 오셨나요?"` welcome button on the main hero banner.
  2. Show step-by-step walking photos from Subway Line 4 Gireum Station (`길음역`) alongside parking guidance.
  3. Map floor-by-floor locations for the main sanctuary (`대예배실`) and Next-Generation worship rooms (`유초등부`, `중고등부`, `청년부`) together with service duration.
  4. Connect Senior Pastor Shin Jeom-il's welcome message with a pressure-free newcomer guide.

### Proposal 2. Integrated Sunday Word, Bulletin, and Small-Group Hub

- **Reference Benchmarks**: **Bundang Woori Church** ([woorichurch.org](https://www.woorichurch.org/)), **Bridgetown Church** ([bridgetown.church](https://bridgetown.church/))
- **Pastoral Rationale**: Separating sermon videos, weekly bulletins, and study sheets across different menus makes weekday reflection and district small-group preparation cumbersome.
- **Application to Ilkwang Church**:
  1. Automatically link each Sunday sermon page to that week's `"주보 안내"` liturgy and announcements.
  2. Offer a low-data audio-only playback mode for weekday commutes.
  3. Add **Bible book indexing** and **sermon series collections** alongside chronological lists.
  4. Provide an optional field for 2 to 3 reflection questions for households, district meetings, and `청년부` small groups.

### Proposal 3. Senior-Friendly Large-Text Mode and 1-Tap KakaoTalk Share Cards

- **Reference Benchmarks**: **Somang Church** ([somang.net](https://www.somang.net/)), **Saemoonan Church** ([saemoonan.org](https://www.saemoonan.org/))
- **Pastoral Rationale**: Founded in `1971`, Ilkwang Church serves many senior saints, and the vast majority of Korean church website visits originate from KakaoTalk group chat links.
- **Application to Ilkwang Church**:
  1. Add a **Large-Text View** toggle at the top of `"주보 안내"` and `"교회 소식"` that enlarges body copy from `15px` to `20px` with generous line height.
  2. Add a **Copy KakaoTalk Share Link** button paired with automatic `Open Graph` preview cards displaying the Sunday date, sermon title, and scripture passage.

### Proposal 4. Living Next-Generation Department Portals (`유초등부`, `중고등부`, `청년부`)

- **Reference Benchmarks**: **Onnuri Church** ([onnuri.org](https://www.onnuri.org/))
- **Pastoral Rationale**: Department pages that show only static service times and room numbers quickly appear inactive to young parents and university students.
- **Application to Ilkwang Church**:
  1. Connect pastor-approved gallery tags (`#유초등부`, `#중고등부`, `#청년부`) automatically to the bottom of each department's introduction page.
  2. Whenever department leaders upload retreat or Sunday photos to the gallery with a department tag, the department page updates automatically without duplicate work.

### Proposal 5. 30-Second Mobile Ministry Sign-Ups and Pastor-Only Prayer Requests

- **Reference Benchmarks**: **Bundang Woori Church** ([woorichurch.org](https://www.woorichurch.org/)), **Saemoonan Church** ([saemoonan.org](https://www.saemoonan.org/))
- **Pastoral Rationale**: Members who miss paper sign-up sheets in the lobby need a simple mobile channel to join seasonal church ministries and request pastoral care.
- **Application to Ilkwang Church**:
  1. Add seasonal Admin switches to open or close custom mobile sign-up forms as needed.
  2. Support 30-second mobile submissions for baptism and confirmation (`학습, 세례, 입교`), choir and Sunday school service applications, and pastoral visitation (`심방 신청`).
  3. Provide an optional **confidential intercessory prayer box** visible solely to the Senior Pastor.

## 3. Phased Rollout Schedule and Budget Impact

| Stage | Target Enhancements | Church Preparation Needed | Additional Cost |
|---|---|---|---|
| **Stage 1**, Immediate | Senior Large-Text Mode, KakaoTalk `Open Graph` share cards, gallery post tags | Confirm approved initial tag list | **KRW 0**, built in-house |
| **Stage 2**, Short-Term | `"처음 오셨나요?"` newcomer route guide, Next-Generation department auto-feeds | Take walking-route photos from Gireum Station and review floor copy | **KRW 0**, built in-house |
| **Stage 3**, Mid-Term | Integrated Sermon and Bulletin Word Hub with Bible book index, seasonal mobile sign-ups and confidential prayer box | Select active seasonal sign-up forms | **KRW 0**, built in-house |

## 4. Pastoral Review and Approval Checklist

1. **Gallery Post Tag Activation**: Confirm approval to enable post tags (`#주일예배`, `#수련회`, `#유초등부`, `#중고등부`, `#청년부`, `#선교`) and finalize tag names.
2. **Large-Text Mode and KakaoTalk Share Cards**: Confirm immediate rollout on `"주보 안내"` and `"교회 소식"`.
3. **Newcomer `"처음 오셨나요?"` Guide**: Confirm placement of the hero welcome button and Gireum Station walking guide.
4. **Mobile Sign-Ups and Confidential Prayer Box**: Select which seasonal ministry forms and confidential pastoral prayer requests to enable.

---

# 일광교회 홈페이지 구축 현황 및 향후 발전 방안 보고서

| 구분 | 상세 내용 |
|---|---|
| **보고 대상** | 신점일 담임목사님, 대한예수교장로회 합동 일광교회 |
| **작성 일자** | 2026년 11월 13일 |
| **문서 목적** | 신규 홈페이지 1차 복원 결과 공유 및 단계별 발전 아이디어, 국내외 모범 교회 레퍼런스 보고 |
| **핵심 기조** | 추가 월 고정 비용 없이 전 세대 성도님의 말씀 묵상 편의와 새가족 정착을 돕는 실용적 개편 |

## 1. 현재 홈페이지 1차 구축 및 안정화 완료 현황

기존 홈페이지(`ilkwang.org`, `ilkwang.or.kr`)의 디자인 자산과 역사 사진을 안전하게 백업한 뒤 언제 어디서나 안정적으로 운영할 수 있는 자체 관리형 홈페이지 기반을 완성했습니다.

| 영역 | 1차 구축 완료 내용 | 운영상 이점 |
|---|---|---|
| **메인 화면 및 3D 큐브** | 네이비(`#1a2744`)와 포레스트 그린(`#2E7D32`) 배색, 본당 배경, 마우스 드래그 회전이 가능한 3D 포토 큐브, 교단 공식 투명 로고 1:1 복원 | 기존 디자인의 친숙함을 유지하며 큐브 노출 사진 6장은 관리자만 안전하게 지정 가능 |
| **추억 앨범 갤러리** | 구 홈페이지(`ilkwang.or.kr`)의 과거 교회 행사 사진들을 원래 촬영 및 게시 일자에 맞춰 깔끔한 앨범형 갤러리로 이관 | 긴 제목 말줄임 현상을 해소하고 사진 열람 창 안에서 본문 설명을 함께 읽도록 개선 |
| **주보 안내 게시판** | 한글(`.hwp`, `.hwpx`) 주보 파일을 선택하면 예배 순서, 설교 본문, 교회 소식을 자동으로 추출해 웹 화면에 게시 | 스마트폰에 별도 한글 뷰어 앱이 없어도 모든 성도님이 게시판에서 곧바로 주보 열람 가능 |
| **맞춤형 메뉴 및 관리자** | 관리자 화면에서 상위 카테고리와 하위 게시판을 직접 추가 및 편집하고 1줄 요약 행과 페이지 나눔(`10`, `20`, `50`개)으로 대량 자료 관리 | 주보와 설교가 수백 건 누적되어도 스크롤 부담 없이 즉시 검색, 이동, 일괄 정리 가능 |
| **한글 맞춤법 정비** | 상단 메뉴와 전체 게시판 명칭(`교회 소개`, `예배와 말씀`, `다음 세대`, `주보 안내`, `오시는 길` 등)에 표준 띄어쓰기 일괄 적용 | 대외적으로 단정하고 신뢰감 있는 교회 공식 안내 체계 확립 |

## 2. 향후 홈페이지 5대 발전 아이디어 및 국내외 레퍼런스

기존 사이트의 외형과 자료 복원을 마친 상태에서 향후 담임목사님의 목회 방향에 맞춰 단계적으로 더해 갈 수 있는 다섯 가지 발전 방안을 국내외 모범 교회 사례와 함께 제안드립니다.

### 제안 1. 첫 방문자의 긴장을 덜어 주는 "처음 오셨나요?" 맞춤 동선 안내

- **참고 레퍼런스**: **미국 리디머 장로교회** ([Redeemer Presbyterian Church](https://www.redeemer.com/)), **미국 브리지타운 교회** ([Bridgetown Church](https://bridgetown.church/))
- **추진 배경**: 성북구 동소문로 인근으로 새로 이사 온 이웃이나 교회를 처음 찾는 분은 연혁보다 주일 아침에 실제로 어떻게 찾아가고 어느 층으로 들어가야 하는지를 가장 먼저 확인합니다.
- **일광교회 적용 방안**:
  1. 메인 화면 상단에 따뜻한 문구의 `"처음 오셨나요?"` 전용 안내 버튼을 배치합니다.
  2. 지하철 4호선 길음역에서 교회까지 걸어오는 실제 사진 동선과 차량 주차 안내를 한눈에 보여 줍니다.
  3. 본당 대예배실과 유초등부, 중고등부, 청년부 예배실의 층별 위치 및 주일 예배 진행 시간을 시간순 카드로 안내합니다.
  4. 담임목사님의 환영 인사말과 부담 없는 새가족 등록 절차를 자연스럽게 연결해 첫 방문 문턱을 낮춥니다.

### 제안 2. 주일 설교, 주보 안내, 가정 및 소그룹 나눔을 잇는 원스톱 말씀 허브

- **참고 레퍼런스**: **분당우리교회** ([woorichurch.org](https://www.woorichurch.org/)), **미국 브리지타운 교회** ([Bridgetown Church](https://bridgetown.church/))
- **추진 배경**: 설교 영상 게시판, 주보 안내 게시판, 교재 자료실이 각각 분리되어 있으면 성도님들이 주중에 말씀을 다시 묵상하거나 가정과 구역 모임에서 활용하기 번거롭습니다.
- **일광교회 적용 방안**:
  1. 주일 설교 영상 화면 하단에 해당 주간 `"주보 안내"` 본문 바로가기를 자동으로 연결합니다.
  2. 평일 출퇴근길 지하철에서도 데이터 부담 없이 말씀을 다시 들을 수 있는 오디오 전용 듣기 모드를 지원합니다.
  3. 단순 날짜순 나열 외에 **성경 권별 색인**과 **설교 시리즈별 모아보기**를 추가해 지난 강해 설교를 쉽게 찾도록 돕습니다.
  4. 필요하실 때 주일 말씀 핵심 요약이나 가정 및 청년부 소그룹 묵상 질문 2~3문항을 함께 덧붙일 수 있는 선택형 입력란을 마련합니다.

### 제안 3. 어르신 배려 큰 글씨 보기 모드와 카카오톡 원클릭 공유 카드

- **참고 레퍼런스**: **소망교회** ([somang.net](https://www.somang.net/)), **새문안교회** ([saemoonan.org](https://www.saemoonan.org/))
- **추진 배경**: 1971년 설립된 우리 교회는 어르신 성도님 비중이 높으며 실제 한국 교회 홈페이지 접속의 대다수는 구역과 전도회 카카오톡 단체 대화방 링크에서 시작됩니다.
- **일광교회 적용 방안**:
  1. `"주보 안내"`와 `"교회 소식"` 상단에 **큰 글씨 보기** 전환 버튼을 두어 한 번 누르면 본문 글자 크기가 `15px`에서 `20px`로 커지고 줄 간격이 시원하게 넓어지도록 배려합니다.
  2. 게시물마다 **카카오톡 공유 링크 복사** 버튼을 제공하고 대화방에 주소를 붙여넣으면 해당 주일 날짜, 설교 제목, 성경 본문이 적힌 미리보기 카드(`Open Graph`)가 깔끔하게 표시되게 구성합니다.

### 제안 4. 최근 사진과 소식이 자동으로 모이는 다음 세대 부서별 미니 포털

- **참고 레퍼런스**: **온누리교회** ([onnuri.org](https://www.onnuri.org/))
- **추진 배경**: 유초등부, 중고등부, 청년부 소개 페이지에 예배 시간과 장소만 고정되어 있으면 젊은 학부모나 청년들에게 부서 활동이 멈춰 있는 느낌을 주기 쉽습니다.
- **일광교회 적용 방안**:
  1. 담임목사님 승인 후 도입할 갤러리 태그(`#유초등부`, `#중고등부`, `#청년부`)를 각 부서 소개 화면 하단과 자동 연동합니다.
  2. 각 부서 교역자나 담당자가 갤러리에 수련회와 예배 사진을 올리고 태그만 선택하면 해당 부서 소개 화면에도 최신 활동 앨범이 자동 노출되어 중복 관리 부담 없이 생동감 있는 부서 공간이 유지됩니다.

### 제안 5. 로비 종이 신청서를 보완하는 30초 모바일 신청 및 비공개 중보기도함

- **참고 레퍼런스**: **분당우리교회** ([woorichurch.org](https://www.woorichurch.org/)), **새문안교회** ([saemoonan.org](https://www.saemoonan.org/))
- **추진 배경**: 예배 전후 로비에서 종이 신청서를 작성하기 어려운 성도님들도 스마트폰으로 간편하게 교회 행정과 사역에 참여할 수 있는 온라인 창구가 필요합니다.
- **일광교회 적용 방안**:
  1. 관리자 모드에서 절기마다 필요할 때만 스위치로 켜고 끌 수 있는 맞춤형 신청 양식을 제공합니다.
  2. 학습, 세례, 입교 신청, 신년도 찬양대 및 교회학교 교사 지원, 가정 심방 신청을 모바일에서 30초 만에 접수하도록 돕습니다.
  3. 외부 게시판에는 일절 노출되지 않고 오직 담임목사님만 확인하실 수 있는 **비공개 중보기도 요청함**을 선택 기능으로 마련합니다.

## 3. 단계별 추진 순서 및 소요 예산 검토

위 다섯 가지 발전 방안은 외부 유료 솔루션 구독 없이 현재 구축된 자체 홈페이지 안에서 모두 직접 구현할 수 있어 **추가 월 고정 비용이 발생하지 않습니다**.

| 추진 단계 | 핵심 적용 과제 | 예상 준비 사항 | 추가 소요 비용 |
|---|---|---|---|
| **1단계**, 즉시 적용 | 어르신 큰 글씨 보기 모드, 카카오톡 주보 및 설교 공유 카드, 갤러리 태그 분류 활성화 | 사용할 기본 태그 목록 확정 | **0원**, 자체 구현 |
| **2단계**, 단기 개편 | `"처음 오셨나요?"` 새가족 방문 동선 안내 신설, 다음 세대 부서별 최신 앨범 자동 연동 | 길음역 도보 동선 사진 촬영 및 층별 안내 문구 감수 | **0원**, 자체 구현 |
| **3단계**, 중기 확장 | 성경 권별 색인을 포함한 주일 설교와 주보 통합 말씀 허브, 절기별 모바일 신청서 및 비공개 중보기도함 | 운영할 온라인 신청 항목 선정 | **0원**, 자체 구현 |

## 4. 담임목사님 검토 및 재가 요청 사항

아래 네 가지 항목을 검토해 주시고 우선 반영할 범위를 일러 주시면 결정하신 순서에 맞춰 안전하게 반영하겠습니다.

1. **갤러리 게시물 태그 도입 승인 여부**: 갤러리에 `#주일예배`, `#수련회`, `#유초등부`, `#중고등부`, `#청년부`, `#선교` 등의 태그 기능을 활성화할지 여부
2. **어르신 큰 글씨 모드 및 카카오톡 공유 카드 우선 적용 여부**: `"주보 안내"`와 `"교회 소식"` 화면에 즉시 반영할지 여부
3. **새가족 `"처음 오셨나요?"` 안내 화면 신설 여부**: 메인 화면 상단 버튼 배치 및 길음역 도보, 주차, 층별 안내 구성 여부
4. **모바일 온라인 신청 및 비공개 중보기도함 운영 범위**: 학습, 세례, 심방 신청 및 담임목사님 전용 비공개 기도 제목 접수 기능 사용 여부
