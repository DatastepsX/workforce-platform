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
- `super_admin` — platform-wide configuration, all admin capabilities + gold "SUPER" badge
- `admin` — full access to everything
- `hiring_manager` — creates demands, sees own demand pipeline + submissions
- `recruiter` — manages all demands, candidates, suppliers
- `procurement` — sees Demands/Submissions/Awards, part of approval workflows
- `finance` — sees Demands/Submissions/Awards, part of approval workflows
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
- **Notifications**: `notifications` table with Supabase Realtime; modern bell icon (filled when unread, `#FF3B30` badge); fixed-position dropdown above sidebar with type-colored icons, clickable links, unread dot; triggered on: new career portal application (→ recruiters), engagement created (→ supplier + recruiters), demand created (→ recruiters/admins), supplier created (→ recruiters/admins), candidate profile created (→ recruiters/admins), demand sent to supplier (→ supplier in-app `demand_received`), demand reaches pending_approval (→ admin/hiring_manager); migrations 019+020+025; `NotificationType` in `src/types/database.ts` includes 8 types
- **Engagement Total**: `total_amount` (final agreed price) + `price_locked` (manually set) on engagements; commission panel shows live calc with editable total override (orange "Preis festgelegt" badge when overridden); engagements list shows Duration + Total columns; detail page shows "Preis festgelegt" badge + diff vs calculation; migration `20260617000017_engagement_total.sql`
- **Career Portal Rate**: apply form collects desired rate/salary with contract-type-aware wording (Wunschgehalt for permanent, Wunschsatz for freelance/contractor); saved as `proposed_rate` + `rate_type` on submission
- **Career Avatar & Navigator**: AI-powered competency profile + career path planning for candidates; 4-step synchronous Claude pipeline (CV parse → avatar summary → career path → skill gaps); 12 soft skills with self-rating sliders + AI-inferred ratings; SVG radar chart (two lines: self vs AI); single visibility toggle per avatar; Career Navigator `/dashboard/career-navigator` shows personalized timeline with skill gaps, recommendations, and matched open demands; Career Ladders admin `/dashboard/career-ladders` (admin/recruiter) — 4 DACH seed ladders seeded; recruiter read-only view on candidate detail when avatar is visible; migration `20260618000022_career_avatar.sql`
- **Profile Page Tabs**: `/dashboard/profile` shows two tabs — "Mein Profil" (ProfileForm) and "Kompetenzprofil" (AvatarSection/Career Avatar); purple dot badge on tab when avatar is ready; implemented via `ProfilePageTabs` client component (`src/app/dashboard/profile/profile-page-tabs.tsx`)
- **Unified Candidates List**: `/dashboard/candidates` shows both `candidate_profiles` (registered) and `supplier_candidates` (supplier-uploaded) in one list; registered candidates link to detail pages, supplier candidates shown with purple "Lieferant" badge; Match Pool includes both types for scoring; `computeMatch()` widened to accept `MatchableCandidate` interface (works for both types); `assignSupplierCandidateToDemand()` action for assigning supplier candidates from the pool
- **Candidate Display Names**: DevUserSwitcher and candidates list now show real full names by looking up `candidate_profiles.full_name` for candidate-role users (fixes "Applicant1" display)
- **DevDataGenerator Demand Context**: When generating test data on supplier candidate forms with a `return_to` URL pointing to a demand, the API looks up the demand's title + skills and instructs Claude to generate matching candidate data
- **Workflow v2 — Process Visibility**: 12-status demand model (`draft/pending_review/pending_approval/sourcing/screening/award/contracting/filled/on_hold/cancelled/rejected` + legacy `interview` in enum); config-driven state machine in `src/lib/workflow/index.ts`; `ProcessPanel` compact horizontal stepper (dots + phase labels) + status badge + "Next: [Role]" actor + role-filtered action buttons + collapsible history log; `transitionDemandStatus()` server action validates role, logs to `process_history`, fires `demand_pending_approval` notification when demand reaches pending_approval; migrations 23 + 24 (workflow v2) + 25 (notification type); `tenants` + `tenant_configs` tables control stepper visibility and approval levels
- **Sprint 3 — Role Config + User Management + Seed Data**: `tenant_roles` table (per-tenant role label override + active toggle); `tenant_id` on `profiles`; Role config section in tenant detail (5 predefined roles with label + toggle); User management section (invite by email via Supabase admin API → shows temp password, or assigns existing user; remove from tenant); Demo tenants seeded: Siemens AG (full MSP, 2-level approval) + Allianz SE (self-service, no MSP); existing HM user assigned to Siemens AG; migration `20260622000026_tenant_user_roles.sql`; `src/lib/actions/tenants.ts` extended with `saveTenantRoles`, `inviteUserToTenant`, `removeUserFromTenant`
- **Sprint 2 — UX Quick Wins + Tenant Management**: Rate type auto-set from demand contract type on supplier submit panel (`permanent→annual`, `contractor→daily`, `freelance→hourly`, `fixed_price→fixed`); orange pending-approval badge on Demands sidebar link for admin + HM; Tenant management at `/dashboard/settings/tenants` (list + create + detail/edit + active toggle); Per-tenant workflow config (demand MSP review/approval levels/screening + award MSP offer/approval levels/PO step) embedded in tenant detail; Settings section in sidebar (admin only); `src/lib/actions/tenants.ts`; `src/app/dashboard/settings/tenants/`
- **Sprint 1 — MSP Workflow + UX Fixes**: Interview removed from demand transitions (happens at submission level; screening → award directly); Engagements renamed to Awards throughout UI; "Commission" → "Award Candidate"; Award panel fully English with contract-type-aware rate labels (Day Rate/Hourly Rate/Annual Salary); submission events (shortlisted, interview, rejected, hired, supplier upload) logged to `process_history` history log; demands list mobile responsive (stacked layout, icon-only button, budget inline); skills chip strip wraps instead of horizontal scroll; direct applicants show `candidate_profiles.full_name` in submissions table; `BACKLOG.md` + `SPRINT.md` added for product management
- **Candidate Match Pool**: skills filter wraps (no horizontal scroll); display name for direct applicants resolved from `candidate_profiles.full_name` in submission rows
- **Sprint 4 — Data Isolation + Interviews**: `tenant_id` on demands (auto-set from creator's profile on create, backfilled); `get_my_tenant_id()` SECURITY DEFINER; recruiter RLS scoped to own tenant; HM now sees all demands in own tenant; ProcessPanel shows "View Only" badge when current role has no available transitions and status is non-terminal; `submission_interviews` table — log interviews per submission with date/type/star rating/notes; `InterviewSection` in submission detail drawer with optimistic add/delete; migrations 027+028
- **Demand Form UX**: `DemandForm` shared client component (`src/app/dashboard/demands/demand-form.tsx`) — contract type drives end-date visibility (hidden for permanent) and budget section label (Annual Salary / Day Rate / Hourly Rate / Monthly Pay) with appropriate placeholders; both New Demand and Edit Demand pages use this component
- **AI Test Data — Contract-Type-Aware Budget**: AI generator prompt updated — permanent: annual salary 45,000–130,000; contractor: day rate 600–1,800; freelance: hourly rate 60–180; internship: monthly 800–1,500; permanent positions leave `end_date` empty
- **DevUserSwitcher — All Roles**: `ROLE_ORDER` now includes all 7 roles (added `procurement`, `finance`); each user row shows their tenant-configured role label in orange when it differs from the platform default (e.g. "MSP Service" for recruiter); `configuredRoleLabel` field added to `UserOption` in `DevUserSwitcher`, `Sidebar`, `SupplierSidebar`; layout.tsx fetches `tenant_roles` and builds a `(tenant_id:role_key) → label` map per user
- **Tenant Supplier Assignments**: `tenant_suppliers` junction table `(tenant_id, supplier_id, active)` — suppliers are global but assigned per-client with an active toggle; Tenant detail page has a "Suppliers" section listing all suppliers, assign/remove buttons, and per-supplier active toggle; demand "Send to Suppliers" panel filters to only active-assigned suppliers for that demand's `tenant_id` (falls back to all suppliers for demands with no tenant); migration `20260622000030_tenant_suppliers.sql`; actions `assignSupplierToTenant`, `removeSupplierFromTenant`, `toggleTenantSupplier` in `src/lib/actions/tenants.ts`; `SuppliersSection` client component in `src/app/dashboard/settings/tenants/[id]/suppliers-section.tsx`
- **Sprint 5 — UX + Roles**: Mobile demands filter uses native `<select>` on mobile / chip strip on sm+; sidebar brand shows active client tenant name (blue chip) from logged-in user's `tenant_id`; DevUserSwitcher shows tenant name per user; `procurement` + `finance` added to `user_role` enum and TypeScript type (migration 029) — these roles see Demands/Submissions/Awards in sidebar + appear in tenant role config and user invite form (under "Client Roles" optgroup); user creation has optional password field (auto-generates if not provided)
- **Sprint 6 — Super Admin + Auto User Switch + Fantasy Names**: `super_admin` role above `admin` — gold "SUPER" badge + "Platform Admin" label in sidebar; access to all admin features; `get_is_admin()` SECURITY DEFINER returns true for both admin + super_admin; migrations 031 (enum) + 032 (policies); Auto user switch via Supabase admin magic link + PKCE through new `/auth/callback` route — no credentials required, fallback password `Test1234!`; AI data generators use fictional DACH fantasy company names (no real company names); session changelog emails sent to micciche.alessandro@gmail.com with testing instructions after each session; Generate Test Client button creates full client setup with all roles + users; `super_admin` added to `UserRole` TypeScript type, `ROLE_ORDER`, `assertAdmin()`, all admin guards throughout codebase
- **Delete Client (super_admin)**: `deleteTenant()` server action — cascades demands (→ submissions, interviews, social_posts, engagements, process_history), tenant_configs, tenant_roles, tenant_suppliers; profiles.tenant_id set to null (users stay); `DeleteTenantButton` client component with type-to-confirm dialog in Danger Zone section on tenant detail (super_admin only)
- **Super Admin Cross-Client Demands**: demands page fetches profile role; if super_admin, fetches tenant names for all demands' tenant_ids and shows a blue client chip on each demand card (RLS already allowed all demands via `get_is_admin()`)
- **AI Test Client + Auto Suppliers + Candidates**: `generateTestTenant()` runs two AI calls — (1) company/users/suppliers, (2) 10 DACH candidates; suppliers created in `suppliers` table + assigned via `tenant_suppliers`; 10 candidates inserted into `supplier_candidates` distributed round-robin across suppliers; supplier user `profile_id` linked to first supplier company; result modal shows supplier and candidate chips; `GeneratedTenantSupplier` + `candidatesCreated` on `GeneratedTenantResult`
- **API Call Tracking**: `src/lib/api-tracker.ts` — `trackApiCall()` fires a non-blocking Resend email to micciche.alessandro@gmail.com after every Anthropic call; includes purpose, model, input/output tokens, cost breakdown (priced at $3/$15 per 1M tokens for Sonnet 4.6); wired into AI Form Filler, Career Avatar (4 calls: CV Parse / Summary / Career Path / Skill Gaps), and Generate Test Client

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
`id`, `title`, `description`, `skills` (text[]), `status` (draft/open/closed/cancelled), `budget_min`, `budget_max`, `start_date`, `end_date`, `location`, `channels` (text[]), `tenant_id` (FK tenants — nullable, auto-set from creator's profile), `created_by` (FK profiles), `created_at`

### `suppliers`
`id`, `company_name`, `email`, `phone`, `contact_person`, `active`, `created_at`

### `tenant_suppliers` (junction)
`id`, `tenant_id` (FK tenants), `supplier_id` (FK suppliers), `active` (bool — can receive demands from this client), `created_at`; UNIQUE `(tenant_id, supplier_id)`

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

### `submission_interviews`
`id`, `submission_id` (FK candidate_submissions), `demand_id` (FK demands), `interviewer_name`, `interview_date`, `interview_type` (video/onsite/phone/technical/hr), `rating` (1–5), `notes`, `created_by` (FK auth.users), `created_at`

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
| `20260620000023_process_workflow.sql` | (v1 — superseded by 024) `process_stage` + `process_status` columns on `demands`; `process_history` table |
| `20260621000024_workflow_v2.sql` | Drops v1 artifacts; rebuilds `demand_status` enum (12 values); `approval_level` column; `tenants` + `tenant_configs` + `process_history` tables with RLS |
| `20260621000025_pending_approval_notification.sql` | ADD `demand_pending_approval` to `notification_type` enum |
| `20260622000026_tenant_user_roles.sql` | `tenant_id` on profiles; `tenant_roles` table + RLS; seeds Siemens AG + Allianz SE tenants with config |
| `20260622000027_demand_tenant_isolation.sql` | `tenant_id` on demands (backfilled); `get_my_tenant_id()` SECURITY DEFINER; updated `demands_select` RLS for tenant scoping |
| `20260622000028_submission_interviews.sql` | `submission_interviews` table + RLS (recruiter/admin full; HM read) |
| `20260622000029_add_procurement_finance_roles.sql` | ADD `procurement` + `finance` to `user_role` enum |
| `20260622000030_tenant_suppliers.sql` | `tenant_suppliers` table (tenant_id, supplier_id, active) + UNIQUE constraint + RLS |
| `20260622000031_super_admin_enum.sql` | ADD `super_admin` to `user_role` enum |
| `20260622000032_super_admin_policies.sql` | `get_is_admin()` SECURITY DEFINER; updated demands_select, tenant_suppliers, submission_interviews, notifications RLS |
| `20260622000030_tenant_suppliers.sql` | `tenant_suppliers` table — per-tenant supplier assignment with `active` toggle; RLS: admin full / recruiter+HM read |

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
| `/auth/callback` | PKCE code exchange — exchanges magic link code for session cookies, redirects to app |
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
| `/dashboard/settings/tenants` | Tenant list + create form (admin only) |
| `/dashboard/settings/tenants/[id]` | Tenant detail — edit name/slug/active + workflow config (admin only) |

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
- `get_my_tenant_id()` — returns the tenant_id from the current user's profile (used for demand scoping)
- `get_is_admin()` — returns `true` for both `admin` and `super_admin` roles (avoids per-policy role checks)

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
