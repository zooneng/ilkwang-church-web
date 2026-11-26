<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Church Official Website AI Reference — Agent and Maintainer Guide

> **Created**: 2026-11-12 20:16 KST  
> **Last updated**: 2026-11-26 12:12 KST  
> **Modified by**: Gemini 4 Carbon (High), Antigravity  
> **Version**: 3.0.0  

## 1. Project Identity and Reference Purpose

- **Reference Church**: Ilkwang Church (`일광교회`, `대한예수교장로회(합동)`), live at https://ilkwang.org.
- **Public Reference Goal**: Enable pastors and church workers to hand this repository to an AI coding agent (`Claude Code`, `Cursor`, `Antigravity`, `Codex`) and launch a zero-subscription, self-managed Korean church website without vendor lock-in.
- **Stack**: `Next.js 16.4.6` (App Router, `src/proxy.ts`), `React 19.3.0`, `Tailwind CSS 4.3.3`, TypeScript `5`, `Supabase` (`Postgres` JSONB store and `Storage`), and `Vercel`.
- **Handover Principle**: Routine weekly ministry operations require zero code edits. All bulletins, sermons, albums, menus, custom boards, inquiries, and backups are managed inside `/admin` and `/admin/photos`, backed by a built-in zero-API Smart Operations Assistant (`src/components/AdminSmartAssistant.tsx`).

## 2. Dual-Mode Data Stores (`src/lib/cloud-store.ts` and `data/`)

When `SUPABASE_URL` and either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY` with `SUPABASE_SERVER_SECRET` are configured, all mutable content and uploads persist to `Supabase` (`public.app_kv_store` and public bucket `church-uploads`). Without cloud credentials, every store falls back automatically to local `data/*.json` and `public/uploads/*` so local development works immediately after `npm install`:

- `data/site-content.json` (`key: "site-content"`): Single Source of Truth (`SSOT`) for navigation menus, top banner notices, church info, pastor profile, church history, serving staff, worship schedule, youth departments (`유초등부`, `중고등부`, `청년부`), sermons, notices, bulletins, events, offering accounts, hero 3D cube gallery, study resources, and department news.
- `data/custom-boards.json` (`key: "custom-boards"`): Custom boards managed from `/admin?tab=menus` and `/admin?tab=posts`, such as a church dormitory or mission board (`/boards/[slug]`).
- `data/inquiries.json` (`key: "inquiries"`): Real-time newcomer registration and pastoral inquiry inbox submitted from `/contact`.
- `data/legacy-gallery.json` (`key: "legacy-gallery"`): Unified photo and video album archive (`/news/gallery`), writable exclusively by authenticated `site_admin` and `photo_admin` sessions.

## 3. Core Architecture and Security Map

- `src/proxy.ts`, `src/lib/admin-auth.ts`, and `src/lib/security.ts`: Next.js 16 request proxy, 2-role `RBAC` (`site_admin` via `ADMIN_PASSWORD` for `/admin`; `photo_admin` via `PHOTO_ADMIN_PASSWORD` restricted strictly to `/admin/photos` and gallery uploads), `HMAC-SHA256` `SameSite=Strict` `HttpOnly` 12-hour session cookies, same-origin `CSRF` verification, and sliding-window login and form rate limiting.
- `src/lib/usage-store.ts` and `src/components/AdminUsageMeter.tsx`: Calls `public.church_usage_stats()` on `Supabase` to render live database and storage byte usage bars at the top of both `/admin` and `/admin/photos`.
- `src/components/ActionFeedbackBubble.tsx`: Capture-phase click anchor tracker rendering immediate save confirmations right next to the button the operator clicked across `/admin` and `/admin/photos`.
- `src/lib/hwp-parser.ts` and `src/components/AdminBulletinStudio.tsx`: Native Korean `.hwp` (`OLE2 PrvText`) and `.hwpx` (`OWPML XML`) church bulletin parser supporting single and multi-file bulk upload, separated `교회 소식` and `교회 일정` editors, celebration parsing, and multi-page historical scan display (`imageUrls`).
- `src/app/api/youtube-sync/route.ts` and `src/app/api/youtube-meta/route.ts`: Keyless YouTube channel `@handle` feed synchronization and `oEmbed` sermon parser classifying Korean worship service types automatically.
- `src/components/PhotoUploadStudio.tsx` and `src/lib/gallery-tags.ts`: Dedicated gallery photo and video upload studio (`/admin/photos`) with 7 preset ministry tags (`예배와 절기`, `성례와 임직`, `전도와 선교`, `다음세대`, `수련회와 탐방`, `교제와 봉사`, `교회 역사`).
- `src/lib/client-upload.ts`, `src/app/api/upload/presign/route.ts`, and `src/app/api/upload/route.ts`: Client-side iPhone `.heic` conversion and image compression, direct-to-Supabase signed `PUT` uploads up to `50 MB` bypassing serverless body limits, and post-upload binary magic-byte verification.

## 4. Recommended Cloud Account Ownership Pattern

Keep every external service under the church's official shared account rather than an individual pastor's personal account:

| Service | Purpose | Recommended Login Setup |
|---|---|---|
| **Domain Registrar** | Official church domain registration and renewal | Church official Google account (`<church-account>@gmail.com`) |
| **`GitHub`** | Source code repository hosting | Church official Google account (`<church-github-account>`) |
| **`Supabase`** | Postgres `app_kv_store` and `church-uploads` file storage | Sign in via `Continue with GitHub` using the church `GitHub` account (`<supabase-project-ref>`) |
| **`Vercel`** | Next.js production hosting, domain routing, `ADMIN_PASSWORD`, `PHOTO_ADMIN_PASSWORD` | Church official Google account (`<vercel-team-slug>`) |

## 5. Adaptation Checklist for AI Agents Building Another Church's Site

When a pastor asks an AI agent to adapt this repository for a new church, execute the following checklist in order without inventing unverified facts:

1. **Replace Baseline Seed Data** (`src/data/default-site-content.ts`):
   - Update `churchInfo` (church name, denomination, slogan, address, postal code, phone, email, `youtubeUrl`, subway and bus routes, founded year).
   - Update `pastorProfile`, `staff`, `worshipSchedule`, `youthDepartments`, `history`, and `offeringAccounts` using only verified church documents. Never invent founding pastors, anniversary years, room numbers, or bank accounts.
   - Reset `sermons`, `bulletins`, `events`, `notices`, `resources`, and `communityPosts` to empty arrays or verified records from the new church.
2. **Replace Brand Graphics and Static Section Headings** (`public/`, `src/app/`, and `src/components/`):
   - Replace `public/logo.png`, `public/logo01.png`, `public/gapck-logo.svg` (denomination emblem), `public/icon.png`, `public/apple-icon.png`, `public/ilkwang01.png` through `public/ilkwang03.png`, `public/pastor.png`, and `public/c01/*` (`Hero001.png` and `cube-1.png` through `cube-6.png`).
   - Run `grep -rn "일광교회" src/` and update static JSX headings and alt labels in `src/app/page.tsx`, `src/app/about/*.tsx`, `src/app/youth/page.tsx`, `src/app/news/*.tsx`, `src/app/worship/sermons/page.tsx`, `src/components/AdminLoginClient.tsx`, and `src/components/AdminSmartAssistant.tsx` (`RootLayout` metadata, `/api/youtube-sync`, `/api/ai-assist`, and `FloatingGuideBot` already read `churchInfo` and `worshipSchedule` dynamically).
3. **Verify Bulletin Heading Patterns** (`src/lib/hwp-parser.ts`):
   - Test one real `.hwp` or `.hwpx` weekly bulletin from the target church against `/api/parse-bulletin` and adjust section header patterns if the church uses distinct section markers.
4. **Provision `Supabase` and `Vercel`**:
   - Run `supabase/schema.sql` in the `Supabase` SQL Editor.
   - Either set `SUPABASE_SERVICE_ROLE_KEY` on the server or create a dedicated `Supabase` Auth user with `raw_app_meta_data: {"is_church_server": true}` matching `SUPABASE_SERVER_EMAIL` and `SUPABASE_SERVER_SECRET`.
   - Set `ADMIN_PASSWORD` and `PHOTO_ADMIN_PASSWORD` in `.env.local` and `Vercel` Environment Variables.
5. **Run Build and Provenance Audit**:
   - Run `npm run lint` and `npm run build`, verify zero remaining `일광교회` or `ilkwang` strings on user-facing pages, and print a paper review sheet for senior leadership if needed.

## 6. Development Commands and Further Reading

- Install dependencies: `npm install`
- Run local dev server: `npm run dev`
- Lint check: `npm run lint`
- Production build verification: `npm run build`
- Full build chronicle and pastor AI guide: `docs/BUILD-PROCESS-AND-AI-GUIDE.md`
- Operator handover manual template: `docs/HANDOVER.md`
