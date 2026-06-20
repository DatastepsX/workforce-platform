# WorkforceX Platform

## Vision
Workforce Operating System — not a classic ATS.
Manages permanent hiring, freelancers, contractors, and internal mobility across one unified process.

## Tech Stack
- **Framework**: Next.js 14.2.35 (App Router, `src/` directory)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Auth & DB**: Supabase (PostgreSQL + Auth + Storage, `@supabase/ssr` v0.12.0 for cookie-based SSR auth)
- **AI**: `@anthropic-ai/sdk` v0.104.1 — model `claude-sonnet-4-6`
- **Email**: `resend` v6.12.4 — silently skips if `RESEND_API_KEY` not set
- **PDF**: `@react-pdf/renderer` v4.5.1 — dynamic import, `pdf(doc).toBlob()` for client-side generation
- **Deployment**: Vercel — https://workforce-platform-omega.vercel.app
- **Mobile**: Expo React Native SDK 54 at `../workforce-mobile`

## MVP Roles
- `admin` — full access to everything
- `hiring_manager` — creates demands, sees own demand pipeline + submissions
- `recruiter` — manages all demands, candidates, suppliers
- `candidate` — creates profile, applies via career portal, sees own applications + match scores
- `supplier` — receives demand requests, submits candidates via supplier portal

## Current Status
- **Auth + Roles**: profiles table with role enum, RLS, SECURITY DEFINER helper functions
- **Demands**: full CRUD, status workflow (draft → open → closed/cancelled), skills tagging, budget, dates, channels
- **Suppliers**: full CRUD, demand distribution (send demands to suppliers)
- **Candidate Profiles**: full profile with skills, rates, CV upload to `cvs` bucket
- **Supplier Candidates**: supplier-side candidate management, CV upload to `supplier-cvs` bucket
- **Candidate Submissions**: supplier and direct-apply submissions, status workflow, match scoring
- **Career Portal**: public job board (`/careers`), apply form with CV upload
- **Engagements**: commission a candidate from a submission → creates engagement, closes demand, emails supplier
- **Matching**: `computeMatch()` in `src/lib/matching.ts` — skills (70 pts) + rate fit (30 pts) = 0–100 score
- **Email Notifications**: 5 functions (demand sent, candidates submitted, status changed, application confirmation, engagement created)
- **AI Test Data**: `DevDataGenerator` (✨ button) fills forms with Claude-generated realistic DACH enterprise data, context-aware via page H1/H2
- **Dev User Switcher**: switch between test users from sidebar (all roles → all roles)
- **Social Media Module**: generate posts (Instagram, Facebook, LinkedIn, TikTok) for demands with `career_portal` channel; status workflow draft→approved→posted/rejected→archived; dark modern canvas image (1080×1080) with QR code, skills chips, details; `NEXT_PUBLIC_APP_URL` env var controls tracking URL domain; migration `20260617000016_social_media.sql` applied
- **Social Media Overview**: `/dashboard/social-media` — all posts from all demands, filterable by platform/status, full management modal; sidebar link for admin/recruiter
- **Supplier Sidebar**: supplier portal uses same left sidebar layout as dashboard (with mobile hamburger, DevUserSwitcher at bottom) — `src/app/supplier/supplier-sidebar.tsx`
- **Career Portal Inactive Demand**: graceful "position no longer active" page when arriving at closed/cancelled/draft demand via QR/link; shows reason, CTA to browse open positions
- **Skills Filter**: candidate list has clickable skill chips (OR logic); supplier list has specialization chips (OR logic) — chips on list rows also act as filters
- **Candidate Match Pool**: second tab "Match Pool" on `/dashboard/candidates` — default filter "All"; table with columns Skills % + Rate % + Score ring on desktop, compact cards on mobile; `+ Zuordnen` button on each row creates a `candidate_submissions` record via `assignCandidateToDemand()`; `computeMatch()` returns `skillsMatchPct` and `conditionsMatchPct`; demands with no skills+budget skipped; skills filter is horizontal-scroll strip; candidate display name uses `getCandidateDisplayName()` helper: prefers `candidate_profiles.full_name`, then `profile.full_name` if non-email, then derives readable name from email plus-alias (e.g. `applicant1` → `Applicant1`)
- **Apply Form AI CV**: "Fill with AI" button also auto-generates and pre-populates a PDF CV using `@react-pdf/renderer`; blue dot + file name shown; manual upload clears generated CV
- **Sort by updated_at**: demands and engagements lists now ordered by `updated_at` descending; demand list shows both "Updated X" and "Created X" dates; migration `20260617000018_engagement_updated_at.sql`
- **Submissions Inbox**: `/dashboard/submissions` — all candidate submissions across all demands, sorted by submitted_at; filter by status + source; "New" badge on proposed submissions; sidebar badge counts unread `new_submission` notifications (clears when page is visited via `markSubmissionNotificationsRead()`)
- **Notifications**: `notifications` table with Supabase Realtime; modern bell icon (filled when unread, `#FF3B30` badge); fixed-position dropdown above sidebar with type-colored icons, German header, clickable links, unread dot; triggered on: new career portal application (→ recruiters), engagement created (→ supplier + recruiters), demand created (→ recruiters/admins), supplier created (→ recruiters/admins), candidate profile created (→ recruiters/admins), demand sent to supplier (→ supplier in-app `demand_received`); migration `20260617000019_notifications.sql` + `20260618000020_notification_types.sql` (**must be applied for demand_created/candidate_created/supplier_created to work**); server actions in `src/lib/actions/notifications.ts`; each list page marks its notification type as read on mount; demand detail page marks the specific `demand_created` notification as read when opened (`DemandReadMarker` client component + `markDemandNotificationReadById`); `NotificationType` in `src/types/database.ts` includes all 7 types
- **Engagement Total**: `total_amount` (final agreed price) + `price_locked` (manually set) on engagements; commission panel shows live calc with editable total override (orange "Preis festgelegt" badge when overridden); engagements list shows Duration + Total columns; detail page shows "Preis festgelegt" badge + diff vs calculation; migration `20260617000017_engagement_total.sql`
- **Career Portal Rate**: apply form collects desired rate/salary with contract-type-aware wording (Wunschgehalt for permanent, Wunschsatz for freelance/contractor); saved as `proposed_rate` + `rate_type` on submission
- **Career Avatar & Navigator**: AI-powered competency profile + career path planning for candidates; 4-step synchronous Claude pipeline (CV parse → avatar summary → career path → skill gaps); 12 soft skills with self-rating sliders + AI-inferred ratings; SVG radar chart (two lines: self vs AI); single visibility toggle per avatar; Career Navigator `/dashboard/career-navigator` shows personalized timeline with skill gaps, recommendations, and matched open demands; Career Ladders admin `/dashboard/career-ladders` (admin/recruiter) — 4 DACH seed ladders seeded; recruiter read-only view on candidate detail when avatar is visible; migration `20260618000022_career_avatar.sql`
- **Profile Page Tabs**: `/dashboard/profile` shows two tabs — "Mein Profil" (ProfileForm) and "Kompetenzprofil" (AvatarSection/Career Avatar); purple dot badge on tab when avatar is ready; implemented via `ProfilePageTabs` client component (`src/app/dashboard/profile/profile-page-tabs.tsx`)
- **Unified Candidates List**: `/dashboard/candidates` shows both `candidate_profiles` (registered) and `supplier_candidates` (supplier-uploaded) in one list; registered candidates link to detail pages, supplier candidates shown with purple "Lieferant" badge; Match Pool includes both types for scoring; `computeMatch()` widened to accept `MatchableCandidate` interface (works for both types); `assignSupplierCandidateToDemand()` action for assigning supplier candidates from the pool
- **Candidate Display Names**: DevUserSwitcher and candidates list now show real full names by looking up `candidate_profiles.full_name` for candidate-role users (fixes "Applicant1" display)
- **DevDataGenerator Demand Context**: When generating test data on supplier candidate forms with a `return_to` URL pointing to a demand, the API looks up the demand's title + skills and instructs Claude to generate matching candidate data
- **Workflow Phase 1 — Process Visibility**: `process_stage` (coarse, 13 values) + `process_status` (granular, 18 values) columns on `demands`; state machine in `src/lib/workflow/`; `ProcessPanel` component on demand detail page shows horizontal stage stepper + status card + role-filtered action buttons + collapsible history log; `transitionDemandStatus()` server action validates role, executes transition, syncs legacy `status`, logs to `process_history`; migration `20260620000023_process_workflow.sql`

## Design System
- **Accent**: `#007AFF` (Apple blue)
- **Background**: white (`#FFFFFF`) for pages, `#F2F2F7` for grouped sections
- **Secondary label**: `#8E8E93`
- **Success**: `#34C759`, **Destructive**: `#FF3B30`, **Warning**: `#FF9500`
- System font (SF Pro on iOS, system-ui on web), minimal spacious layout
- Mobile forms: step-by-step wizard pattern

## Database Schema

### `profiles`
`id` (uuid, FK auth.users), `email`, `full_name`, `role` (enum: admin/hiring_manager/recruiter/candidate/supplier), `created_at`

### `demands`
`id`, `title`, `description`, `skills` (text[]), `status` (draft/open/closed/cancelled), `budget_min`, `budget_max`, `start_date`, `end_date`, `location`, `channels` (text[]), `created_by` (FK profiles), `created_at`

### `suppliers`
`id`, `company_name`, `email`, `phone`, `contact_person`, `active`, `created_at`

### `demand_suppliers` (junction)
`demand_id` (FK demands), `supplier_id` (FK suppliers), `sent_at`

### `candidate_profiles`
`id` (FK auth.users), `full_name`, `email`, `phone`, `headline`, `skills` (text[]), `specializations` (text[]), `hourly_rate_min`, `hourly_rate_max`, `currency`, `cv_path`, `created_at`, `updated_at`
Avatar fields: `avatar_visible_to_recruiters` (bool), `career_goals`, `preferred_positions` (text[]), `strengths`, `weaknesses`, `motivation`, `learning_willingness` (1–5), `avatar_summary` (AI-generated), `avatar_generated_at`, `avatar_status` (none/generating/ready/error)

### `supplier_candidates`
`id`, `supplier_id` (FK suppliers), `demand_id` (FK demands), `name`, `email`, `phone`, `headline`, `skills` (text[]), `notes`, `cv_path`, `created_at`

### `candidate_submissions`
`id`, `demand_id`, `supplier_id`, `candidate_profile_id` (FK candidate_profiles — direct applicants), `supplier_candidate_id` (FK supplier_candidates — supplier submissions), `candidate_name`, `candidate_email`, `status` (proposed/shortlisted/interview/offer/hired/rejected), `source` (supplier/direct), `submitted_at`, `cv_path`, `proposed_rate`, `rate_type`, `notes`

### `social_posts`
`id`, `demand_id` (FK demands), `platform` (enum: instagram/facebook/linkedin/tiktok/x), `status` (enum: draft/approved/posted/archived/rejected), `caption`, `hashtags` (text[]), `image_path`, `tracking_code` (unique 8-char code), `tracking_url`, `created_by`, `approved_by`, `approved_at`, `posted_at`, `external_post_url`, `created_at`, `updated_at`

### `notifications`
`id`, `user_id` (FK auth.users), `type` (enum: new_submission/submission_status/engagement_created/demand_received), `title`, `body`, `related_id` (UUID), `related_type` (demand/submission/engagement), `read_at` (null = unread), `created_at`

### `engagements`
`id`, `demand_id` (FK demands), `submission_id` (FK candidate_submissions), `supplier_id` (FK suppliers), `demand_title`, `candidate_name`, `candidate_email`, `supplier_name`, `start_date`, `end_date`, `rate`, `rate_type`, `currency`, `total_amount` (final agreed price, may differ from calc), `price_locked` (bool — manually set total), `status` (active/completed/cancelled), `notes`, `created_by` (FK profiles), `created_at`

## Migrations (run in Supabase SQL editor in order)

| File | Description |
|---|---|
| `20260614000001_profiles.sql` | profiles table, role enum, RLS, `get_my_role()` SECURITY DEFINER |
| `20260614000002_demands.sql` | demands table, RLS |
| `20260614000003_suppliers.sql` | suppliers table, demand_suppliers junction, RLS |
| `20260615000004_candidate_profiles.sql` | candidate_profiles table, RLS |
| `20260615000005_candidate_submissions.sql` | supplier_candidates + candidate_submissions, RLS |
| `20260616000006_demands_supplier_rls.sql` | extended RLS for demands/supplier access |
| `20260616000007_submission_rate.sql` | proposed_rate + rate_type columns on candidate_submissions |
| `20260616000008_hiring_manager_submissions_rls.sql` | `get_my_demand_ids()` SECURITY DEFINER to avoid RLS cycle |
| `20260616000009_hiring_manager_suppliers_rls.sql` | `get_my_supplier_ids()` SECURITY DEFINER to avoid RLS cycle |
| `20260616000010_fix_hiring_manager_rls.sql` | iterative RLS fix for hiring_manager |
| `20260616000011_fix_suppliers_rls_cycle.sql` | final fix for suppliers RLS recursion via SECURITY DEFINER |
| `20260616000012_career_portal.sql` | source column on candidate_submissions, public SELECT on demands |
| `20260616000013_demand_channels.sql` | channels column (text[]) on demands |
| `20260616000014_engagements.sql` | engagements table + RLS |
| `20260616000015_profiles_read_all.sql` | `profiles_select_all_authenticated` policy — all auth users can read all profiles (user switcher) |
| `20260617000016_social_media.sql` | `social_posts` table + `social_platform` / `social_post_status` enums + RLS |
| `20260617000017_engagement_total.sql` | `total_amount` + `price_locked` columns on engagements |
| `20260617000018_engagement_updated_at.sql` | `updated_at` column + auto-update trigger on engagements |
| `20260617000019_notifications.sql` | `notifications` table + `notification_type` enum + RLS + Realtime |
| `20260617000017_engagement_total.sql` | `total_amount` + `price_locked` columns on `engagements` |
| `20260618000020_notification_types.sql` | ADD to `notification_type` enum: `demand_created`, `candidate_created`, `supplier_created` |
| `20260618000021_supplier_candidate_rate.sql` | `hourly_rate_min/max`, `currency`, `availability`, `location` columns on `supplier_candidates` |
| `20260618000022_career_avatar.sql` | Avatar fields on `candidate_profiles`; new tables: `soft_skill_ratings`, `career_ladders`, `career_ladder_steps`, `candidate_career_paths`, `career_skill_gaps`; seeds 4 DACH career ladders |
| `20260620000023_process_workflow.sql` | `process_stage` + `process_status` enums + columns on `demands`; `process_history` table with RLS; backfills from legacy `status` |

## Storage Buckets
Both buckets are **private** (RLS-protected), max 10 MB, PDF only.

| Bucket | Used for |
|---|---|
| `cvs` | Candidate CVs uploaded by candidates themselves (profile + career portal) |
| `supplier-cvs` | CVs uploaded by suppliers when submitting candidates |

Access via `createSignedUrl(path, 3600)` (1-hour expiry). The `cv_path` column includes bucket prefix (e.g. `supplier-cvs/filename.pdf`); strip prefix before calling storage API.

## Routes & Pages

### Public
| Route | Description |
|---|---|
| `/` | Redirects to `/login` |
| `/login` | Email/password login (Client Component) |
| `/careers` | Public job board — lists open demands |
| `/careers/[id]` | Public demand detail page |
| `/careers/[id]/apply` | Multi-step application form with CV upload |

### Dashboard (protected, all internal roles)
| Route | Description |
|---|---|
| `/dashboard` | Overview — role-aware stats (demands, engagements, applications, best match %) |
| `/dashboard/demands` | Demand list, filterable by status |
| `/dashboard/demands/new` | Create demand |
| `/dashboard/demands/[id]` | Demand detail — submissions table, "Position Filled" banner, engagements section, Social Media section (only when `career_portal` in channels) |
| `/dashboard/demands/[id]/edit` | Edit demand |
| `/dashboard/demands/[id]/submissions` | Full submissions view |
| `/dashboard/candidates` | Candidates list (admin/recruiter only) |
| `/dashboard/candidates/[id]` | Candidate detail |
| `/dashboard/suppliers` | Suppliers list (admin/recruiter only) |
| `/dashboard/suppliers/new` | Create supplier |
| `/dashboard/suppliers/[id]/edit` | Edit supplier |
| `/dashboard/engagements` | Engagements list (admin/recruiter/hiring_manager) |
| `/dashboard/engagements/[id]` | Engagement detail with status actions (Mark Completed / Cancel / Reactivate) |
| `/dashboard/profile` | Candidate profile editor + Career Avatar section (candidate only) |
| `/dashboard/applications` | Candidate's own applications with match scores, sorted best match first (candidate only) |
| `/dashboard/career-navigator` | Candidate's personalized career path timeline with skill gaps + open demand matches (candidate only) |
| `/dashboard/career-ladders` | Career ladder list (admin/recruiter only) |
| `/dashboard/career-ladders/new` | Create career ladder |
| `/dashboard/career-ladders/[id]` | Edit career ladder + steps |
| `/dashboard/social-media` | All social posts across all demands — filter by platform/status, full management (admin/recruiter only) |
| `/dashboard/submissions` | All submissions inbox — sorted by submitted_at, filter by status/source, "New" badge (admin/recruiter/hiring_manager) |

### Supplier Portal (protected, supplier role)
| Route | Description |
|---|---|
| `/supplier` | Supplier overview — open demands + engagements section |
| `/supplier/candidates` | Supplier's candidate roster |
| `/supplier/candidates/new` | Add candidate to roster |
| `/supplier/candidates/[id]` | Candidate detail |
| `/supplier/demands/[id]/submit` | Submit a candidate to a specific demand |

### API Routes
| Route | Description |
|---|---|
| `/api/generate-test-data` | POST — Claude-powered AI form filler; body: `{ path, fields, pageContext }` |
| `/api/career-avatar/generate` | POST — 4-step synchronous AI pipeline: CV parse → avatar summary → career path → skill gaps; sets `avatar_status` on `candidate_profiles` |

## Key Patterns

### Supabase Auth
- `src/lib/supabase/client.ts` — `createBrowserClient()` for Client Components
- `src/lib/supabase/server.ts` — `createServerClient()` + cookies for Server Components/Actions
- `src/lib/supabase/admin.ts` — `createAdminClient()` with service role key, bypasses RLS
- `src/middleware.ts` — protects `/dashboard/*` and `/supplier/*`; redirects `/login` if already authed

### RLS SECURITY DEFINER Functions
- `get_my_role()` — returns own role without hitting profiles RLS (prevents recursion)
- `get_my_demand_ids()` — returns demand IDs created by the current hiring_manager
- `get_my_supplier_ids()` — returns supplier IDs reachable by the current hiring_manager via their demands

### Matching Score (`src/lib/matching.ts`)
`computeMatch(candidate, demand): MatchResult`
- Skills component (max 70 pts, or 100 if no rate data): `matchedSkills.length / demandSkills.length × weight`
- Rate component (max 30 pts): candidate `hourly_rate_max` vs demand `budget_max`; full 30 pts if within budget, partial if over
- `matchColor(score)`: `#34C759` ≥80 · `#FF9500` ≥60 · `#FFCC00` ≥40 · `#FF3B30` <40

### Engagement Flow
1. Recruiter clicks "Commission" on a submission
2. `createEngagement()` in `src/lib/actions/engagements.ts` inserts engagement, sets submission → `hired` AND demand → `closed` in parallel, emails supplier
3. Demand detail shows green "Position Filled" banner linking to engagement detail
4. Demand can be re-opened: `closed → open` is a valid status transition

### Social Media Module
- **Per-demand**: visible on demand detail when `career_portal` in `demand.channels`, for admin/recruiter/hiring_manager
- **Content generation**: `src/lib/social-media/generator.ts` — template-based, platform-aware captions + hashtags
- **Canvas image**: `generateImage(post, demand)` in `social-media-client.tsx` — client-side 1080×1080 dark design, dot grid, blue glows, QR code (via `qrcode` npm), skill chips
- **Tracking URL**: `${NEXT_PUBLIC_APP_URL}/careers/${demandId}?ref=${trackingCode}` — `NEXT_PUBLIC_APP_URL` must be set on Vercel to `https://workforce-platform-omega.vercel.app`
- **Status workflow**: draft → approved → posted (terminal) / rejected → revise → draft; archived from any
- **Server actions**: `src/lib/actions/social-posts.ts` — all revalidate both demand detail and `/dashboard/social-media`

### Email (`src/lib/email.ts`)
All functions silently no-op if `RESEND_API_KEY` is not set. FROM: `'WorkforceX <onboarding@resend.dev>'`
- `emailDemandSentToSupplier` — demand distributed to supplier
- `emailCandidatesSubmitted` — recruiter notified when supplier submits candidates
- `emailSubmissionStatusChanged` — supplier/recruiter notified on status change
- `emailApplicationConfirmation` — candidate confirmation after career portal apply
- `emailEngagementCreated` — supplier notified when their candidate is commissioned

### Dev Tools
- `DevDataGenerator` (`src/components/DevDataGenerator.tsx`) — ✨ floating button (bottom-right), scans form fields, sends page H1/H2 as `pageContext` so Claude generates role-specific data, fills fields via synthetic React events + `fill-tags` custom event for tag inputs
- `DevUserSwitcher` (`src/components/DevUserSwitcher.tsx`) — dropdown in sidebar user area to switch between any test user accounts; reads profiles via regular authenticated client (migration 015 allows this)

### Fixed-Position Dropdown Pattern
When a dropdown is inside an `overflow-hidden` container, use `useRef + getBoundingClientRect()` and render at `position: fixed` with calculated `top`/`right` to avoid clipping. See `engagements-client.tsx` for reference implementation.

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # Required for admin client (bypasses RLS)
ANTHROPIC_API_KEY=...              # Required for AI test data generation
RESEND_API_KEY=...                 # Required for email notifications
```

## Project Structure
```
src/
  app/
    layout.tsx                    # Root layout — includes DevDataGenerator
    page.tsx                      # Redirects to /login
    login/page.tsx                # Email/password login (Client Component)
    careers/                      # Public career portal
      page.tsx                    # Job board
      [id]/page.tsx               # Demand detail (public)
      [id]/apply/page.tsx         # Application wizard
    dashboard/                    # Protected internal dashboard
      layout.tsx                  # Sidebar, user switcher, sign-out server actions
      sidebar.tsx                 # Role-aware navigation (Client Component)
      nav-link.tsx                # Active-state nav link
      page.tsx                    # Overview with role-aware stats
      demands/                    # Demand CRUD + submissions
      candidates/                 # Candidate list/detail (admin/recruiter)
      suppliers/                  # Supplier CRUD (admin/recruiter)
      engagements/                # Engagement list/detail
      applications/               # Candidate's own applications (candidate only)
      profile/                    # Candidate profile editor (candidate only)
    supplier/                     # Supplier portal (separate auth scope)
    api/
      generate-test-data/route.ts # Claude-powered test data endpoint
  lib/
    supabase/
      client.ts                   # Browser client
      server.ts                   # Server/SSR client
      admin.ts                    # Service-role client (bypasses RLS)
    actions/
      engagements.ts              # createEngagement, updateEngagementStatus
    matching.ts                   # computeMatch(), matchColor()
    email.ts                      # All Resend email functions
    utils.ts                      # shadcn cn() helper
  components/
    DevDataGenerator.tsx          # AI form filler (rendered in root layout)
    DevUserSwitcher.tsx           # Role switcher in sidebar
    ui/                           # shadcn/ui components
  types/
    database.ts                   # TypeScript interfaces for all DB tables + enums
  middleware.ts                   # Route protection
supabase/
  migrations/                     # 15 SQL migration files
```

## Development
```bash
npm run dev    # Start dev server on http://localhost:3000
npm run build  # Production build
npm run lint   # ESLint
```

## Adding shadcn Components
```bash
npx shadcn@latest add <component-name>
```

## Mobile App (`../workforce-mobile`)
Expo SDK 54, React Native 0.81.5, Expo Router 6, Supabase auth.
Env vars: `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
`.npmrc` requires `legacy-peer-deps=true`.
Auth pattern: `index.tsx` handles initial `getSession()` redirect; `_layout.tsx` handles live `onAuthStateChange` (ignore `INITIAL_SESSION` event to avoid double-redirect).

## Maintenance Rule
**Update CLAUDE.md as the LAST step of every feature before considering the task done.**
Add a bullet under Current Status, and update Schema/Routes/Migrations sections if the feature touched the database or added new pages.
