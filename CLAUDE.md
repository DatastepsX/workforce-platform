# WorkforceX Platform

## End-of-Session Rule (MANDATORY — no exceptions, no confirmation)
At the end of every session, **always** do all three of these in order — never ask, never skip:
1. Update `SESSION_LOG.md` and `CLAUDE.md`
2. Run `vercel deploy --prod` to deploy to production
3. Send the changelog email (see below)

## Changelog Email Rule
After completing any feature or fix, send a changelog email to micciche.alessandro@gmail.com via Resend. Use this script pattern (run from `/Users/alessandro/workforce-platform`):

```bash
export $(grep -v '^#' .env.local | xargs) && node -e "
import('resend').then(({Resend}) => {
  const r = new Resend(process.env.RESEND_API_KEY);
  r.emails.send({
    from: 'WorkforceX <onboarding@resend.dev>',
    to: 'micciche.alessandro@gmail.com',
    subject: 'WorkforceX Session — [short title]',
    html: \`[html body with what was built + testing instructions]\`
  }).then(res => console.log('sent:', res.data?.id));
});
" --input-type=module
```

Or write to a `.mjs` file in the project root, run it, then delete it. Include: what was built, key decisions, testing instructions, and **always** these two blocks — both must be present every time:

1. **"Better Requirements Writing"** — even if requirements were clear and well-written (say so and explain why). If they were unclear, say what was missing.
2. **"English Corner"** — pick 2–4 English mistakes or awkward phrasings from the user's messages in this session and correct them with a brief explanation. Cover grammar, word choice, spelling, and punctuation. Keep it friendly and educational, not pedantic.

## Session Continuity Rule
This project is worked on from multiple Claude Code sessions (VSCode + iPhone SSH). To maintain shared context:

**At the END of every session:** append a brief entry to `SESSION_LOG.md` in the project root:
- What was built or changed
- Key decisions made and why
- What's pending or next

**Before EVERY user message/prompt:** read `SESSION_LOG.md` to catch any changes made from another session (e.g. iPhone SSH) since the last check. The user switches between VSCode and iPhone multiple times per day.

Format:
```
### YYYY-MM-DD HH:MM — [VSCode|SSH]
- Built: ...
- Decided: ...
- Next: ...
```

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
- `procurement` — sees Demands/Submissions/Awards/Suppliers/Engagements; approves demands at `pending_approval`; can edit demand while approving
- `finance` — sees Demands/Submissions/Awards/Suppliers/Engagements; approves demands at `pending_approval`; can edit demand while approving
- `candidate` — creates profile, applies via career portal, sees own applications + match scores
- `supplier` — receives demand requests, submits candidates via supplier portal

## Current Status
- **Auth + Roles**: 8 roles (`super_admin/admin/hiring_manager/recruiter/procurement/finance/candidate/supplier`); RLS + SECURITY DEFINER helpers; `get_is_admin()` returns true for admin+super_admin; auto user switch via magic link + PKCE (`/auth/callback`)
- **Demands**: full CRUD; 12-status workflow (`draft/pending_review/pending_approval/sourcing/screening/award/contracting/filled/on_hold/cancelled/rejected`); skills, budget, dates, channels, `tenant_id`, `job_description_id`, `rate_type`; list sorted by URL param (`sortBy:sortDir`), default `updated_at:desc`; sort dropdown in FilterBar persists to localStorage; `super_admin` has full INSERT/UPDATE/DELETE via RLS + server action guards; `not-found.tsx` handles stale notification links gracefully
- **Workflow v2**: config-driven state machine in `src/lib/workflow/index.ts`; `ProcessPanel` horizontal stepper + status badge + role-filtered action buttons + collapsible history log; `transitionDemandStatus()` logs to `process_history`, fires notifications; `tenants` + `tenant_configs` control approval levels; APPROVE/APPROVE_REVIEW/APPROVE_AWARD show optional comment textarea (`allowNote`); RETURN/REJECT/CANCEL require mandatory note (`requiresNote`); process history logs: DEMAND_CREATED, DEMAND_EDITED (review/approval/sourcing stages), SUPPLIERS_PREASSIGNED, DEMAND_SENT_TO_SUPPLIERS, AWARD_SUBMISSION, SOCIAL_POST_CREATED
- **Suppliers**: global suppliers assigned per-tenant via `tenant_suppliers` (active toggle); `demand_suppliers` junction for sent demands; "Send to Suppliers" panel filters to tenant-active suppliers
- **Supplier Categories**: global categories (`supplier_categories`); per-tenant active (`tenant_supplier_categories`); supplier membership (`supplier_category_members`); JD links (`jd_supplier_categories`); managed at `/dashboard/settings/supplier-categories` (super_admin)
- **Candidates**: unified list shows `candidate_profiles` (registered) + `supplier_candidates` (supplier-uploaded); Match Pool tab with skills%/rate%/score; `computeMatch()` in `src/lib/matching.ts` (skills 70pt + rate 30pt); edit page at `/dashboard/candidates/[id]/edit` (admin/recruiter/super_admin)
- **Career Portal**: public job board (`/careers`), apply form with CV upload + AI-generated PDF CV; graceful inactive demand page; apply form collects `proposed_rate` + `rate_type`
- **Career Avatar & Navigator**: 4-step AI pipeline (CV parse → summary → career path → skill gaps); 12 soft skills radar chart (self vs AI); Career Navigator at `/dashboard/career-navigator`; Career Ladders per tenant; recruiter read-only view on candidate detail
- **Engagements (Awards)**: commission candidate → creates engagement, sets submission→hired + demand→filled, emails supplier; `total_amount` + `price_locked` override; sorted by `updated_at` desc
- **Submissions**: inbox at `/dashboard/submissions`; filter by status/source; "New" badge; `submission_interviews` table for per-submission interview log; `createAward()` action (from submission drawer) creates award record + moves demand → `award` + submission → `offer`; Award panel now collects financial details (rate/dates/total) before creating the award
- **Cost Items & Compliance Module**: `cost_item_categories`, `cost_items`, `cost_item_contract_types`, `cost_item_clients` tables (migration 042); `compliance_rules`, `compliance_rule_clients`, `compliance_validation_logs` tables (migration 043); 4 contract types: `perm/temp/contracting/sow`; 37 seeded cost items across 7 categories; 18 seeded compliance rules (DE/GB, AÜG, IR35, working time, minimum wage, expenses); Admin pages at `/dashboard/settings/cost-items` and `/dashboard/settings/compliance-rules` (super_admin only, with CRUD); `getAvailableCostItems()` engine filters by contract type + country + tenant; award detail shows applicable cost items grouped by category; demand contract types updated to `perm/temp/contracting/sow`; validation engine in `src/lib/actions/compliance.ts`; audit trail via `compliance_validation_logs`. **Phase 2**: `award_periods` + `period_cost_entries` tables (migration 044, GENERATED amount column); `tenant_compliance_rule_overrides` (migration 045, per-tenant rule overrides); main sidebar "Cost Items" page at `/dashboard/cost-items` (all roles) showing billing periods with status filter + search + computed entry totals; `/dashboard/cost-items/[periodId]` period detail with Single Entry + Daily Timesheet modes; daily timesheet shows all weekdays in period with per-day qty input + Fill All + live total preview; draft entries editable inline (pencil icon); unit_price pre-filled from award.rate; quantity label adapts to rate_type (Hours/Days); staff approve/reject review buttons; award detail gains billing period type selector + Generate Periods button + period list; per-tenant compliance overrides UI in tenant settings page; cost item + compliance config pages mobile-responsive (card list on small screens)
- **Awards Module**: separate module at `/dashboard/awards`; `awards` table with own status workflow: `pending_approval → approved → active → completed | cancelled`; award detail at `/dashboard/awards/[id]` with status action buttons (accessible to procurement/finance); Awards section on demand detail page; sidebar "Awards" (star icon) → `/dashboard/awards` with green badge for pending approvals; `createAward()` + `updateAwardStatus()` + `updateAwardPO()` in `src/lib/actions/awards.ts`; `po_number` field on awards; approval by procurement/finance (not just admin); `approved` → submission `awarded`; `active` → demand `filled` + billing periods auto-generated if `billing_period_type` + dates set; PO entry form on award detail page; responsive layout for candidate info; award approval notification routes to `/awards/[id]` (not demand); awards list has 5-card stats bar (pending/approved/active/completed/cancelled) — mobile 2+3 grid layout
- **AI Skill Matching**: CandidateDrawer has ✨ AI Analysis button calling `analyzeSkillMatchAI()` (Claude claude-sonnet-4-6) — returns semantic match score, explanation, matched pairs with confidence/reason, missing skills. AI score saved to `candidate_submissions.ai_score` via `saveAiMatchScore()` and persisted across sessions; shown in table with purple "AI" indicator. Base score uses word-overlap tokenization. **Match Info Popover**: ℹ button also saves AI score when analyzed inline. `submission_status` has `awarded` value (set automatically on award approval); status renamed from "Hired" to "Awarded" in UI. Interview AI fill fixed to send `FieldInfo[]` objects (not string array). DevDataGenerator moved to `bottom-6 left-6` to avoid conflict with CandidateDrawer footer.
- **Notifications**: Supabase Realtime; bell icon with `#FF3B30` badge; 11 notification types (incl. `demand_returned`, `award_pending_approval`, `demand_approved`); dropdown above sidebar; sidebar badge counts per role: `pendingReviewCount` (purple, recruiter), `pendingApprovalCount` (orange), `pendingAwardCount` (green), `demandReturnedCount` (red, HM), `pendingAwardApprovalCount` (green on Awards nav item)
- **Social Media**: posts per demand (Instagram/Facebook/LinkedIn/TikTok/X); dark 1080×1080 canvas with QR code; status workflow draft→approved→posted; overview at `/dashboard/social-media`
- **Tenant Management**: multi-tenant isolation — admin/recruiter scoped to own tenant, super_admin sees all; `tenant_roles` for label overrides; org units + JDs + supplier categories per tenant; user invite/edit/remove in tenant config; `deleteTenant()` cascades all data
- **Org Units + Job Descriptions**: per-tenant org units; JD templates pre-fill demand creation form; JD picker with live search + org unit filter; `demands.job_description_id` saved; auto-assign suppliers on transition to `sourcing` via JD→supplier category chain
- **Generate Test Client**: 4 AI calls — company+users+suppliers+categories → candidates → career ladders → org units+JDs; avoids existing tenant names; links suppliers to categories; auto-assigns org units to users; result modal shows all counts + "✓ Cost items enabled" chip (`costItemsEnabled` in `GeneratedTenantResult`)
- **Generate Test Data** (per-tenant): ⚡ purple button on tenant config page (next to RunScenarioButton); calls streaming SSE API at `/api/generate-tenant-test-data` with `{ tenantId }`; creates 15 E2E scenarios (Group A: 5 full E2E demand→submission→award→billing periods→cost entry; Group B: 5 demand→award various statuses; Group C: 5 demand process only at sourcing/pending_approval/cancelled/on_hold/filled); live dark terminal modal with colour-coded log; after completion shows "Run E2E Scenarios →" button linking to `/dashboard/dev/test-scenarios?tenantId=[id]`
- **Dev Tools**: `DevDataGenerator` (✨ button, bottom-left) — AI form filler, context-aware; `DevUserSwitcher` — 2-step flow (role → user, client step removed); all 8 roles; shows tenant-configured label; auto user switch via magic link; icon alignment fixed (all `w-8 h-8 rounded-xl`); 🧪 test scenarios button (super_admin) links to `/dashboard/dev/test-scenarios`
- **Workflow Test Scenarios**: `src/lib/workflow/scenarios.ts` — scenario engine generates E2E step list per tenant config + validates each step via live `getTransitions()` engine; dev page at `/dashboard/dev/test-scenarios` shows per-tenant pass/fail results grouped by phase (Demand/Sourcing/Award); auto-runs on page load; accessible to super_admin. **Cost item steps added**: COST_ENTRY_SUBMIT (supplier), COST_MSP_REVIEW (conditional on `cost_msp_review`), COST_HM_APPROVE (conditional on `cost_hm_approval`), BILLING_PERIOD_INVOICED (admin); all operational steps in `OPERATIONAL_ACTIONS` set. Each AI Optimisation Idea has an **⚡ Optimise** button + optional comment field — calls `/api/optimize-idea` which reads CLAUDE.md for context, runs Claude to produce a full engineering spec (Why/Acceptance Criteria/Implementation Plan/DB Changes/Testing), and emails it to the developer. Each **failing test step** (✗) has a **🔧 Fix** button — calls `/api/fix-step`, Claude diagnoses root cause + generates a fix plan, emails developer. Both buttons show `~$0.02` cost estimate before clicking and actual cost after (based on real token usage from Anthropic API).
- **E2E Process Visualizer**: `src/components/WorkflowVisualizer.tsx` — horizontal scrollable flow diagram embedded in tenant config page (below Details, above Workflow Config); shows all 17 stages color-coded by phase; **4 new billing stages** (purple #5856D6): Cost Entry (always-on), MSP Review cost (configurable via `cost_msp_review`), HM Approval (configurable via `cost_hm_approval`), Invoiced (always-on); conditional stages show ON/OFF badge and grey out when disabled; legend includes billing phase; new config flags `cost_msp_review` + `cost_hm_approval` in `tenant_configs` (migration 047)
- **Dashboard Overview**: separate stat cards for "Demands Pending Approval" (orange) and "Awards Pending Approval" (green) for approver roles; scoped to tenant where applicable
- **Demand Progress Bar**: segmented 8-step progress bar on each demand card showing % through the workflow phases (PHASE_ORDER); terminal statuses (cancelled/rejected/on_hold) shown with empty bar
- **API Call Tracking**: `src/lib/api-tracker.ts` — non-blocking Resend email after every Anthropic call with token counts + cost
- **Mobile Workflow**: iPhone SSH via Termius + Tailscale (100.111.139.5); Claude Code CLI on subscription billing (Sonnet 4.6); `SESSION_LOG.md` shared between sessions

## Design System
- **Accent**: `#007AFF` (Apple blue)
- **Background**: white (`#FFFFFF`) for pages, `#F2F2F7` for grouped sections
- **Secondary label**: `#8E8E93`
- **Success**: `#34C759`, **Destructive**: `#FF3B30`, **Warning**: `#FF9500`
- System font (SF Pro on iOS, system-ui on web), minimal spacious layout
- Mobile forms: step-by-step wizard pattern

## Database Schema

### `profiles`
`id` (uuid, FK auth.users), `email`, `full_name`, `role` (enum: admin/hiring_manager/recruiter/candidate/supplier), `tenant_id` (FK tenants), `org_unit_id` (FK org_units — for HM/procurement/finance pre-filtering), `created_at`

### `demands`
`id`, `title`, `description`, `skills` (text[]), `status` (draft/open/closed/cancelled), `budget_min`, `budget_max`, `start_date`, `end_date`, `location`, `channels` (text[]), `billing_period_type`, `rate_type` (text: hourly/daily, default daily — selected on demand form, inherited to award and timesheet entries), `tenant_id` (FK tenants — nullable, auto-set from creator's profile), `job_description_id` (FK job_descriptions — nullable, set when JD template used), `created_by` (FK profiles), `created_at`

### `org_units`
`id`, `tenant_id` (FK tenants), `name`, `description`, `active` (bool), `position` (int, sort order), `created_at`

### `job_descriptions`
`id`, `tenant_id` (FK tenants), `org_unit_id` (FK org_units), `title`, `description`, `skills` (text[]), `contract_type`, `budget_min`, `budget_max`, `experience_years`, `seniority_level`, `location`, `remote_allowed` (bool), `languages` (text[]), `active` (bool), `created_at`, `updated_at`

### `supplier_categories`
`id`, `name`, `description`, `active` (bool), `created_at` — global (no tenant FK)

### `tenant_supplier_categories` (junction)
`id`, `tenant_id` (FK tenants), `supplier_category_id` (FK supplier_categories); UNIQUE `(tenant_id, supplier_category_id)`

### `supplier_category_members` (junction)
`id`, `supplier_id` (FK suppliers), `supplier_category_id` (FK supplier_categories); UNIQUE `(supplier_id, supplier_category_id)`

### `jd_supplier_categories` (junction)
`id`, `job_description_id` (FK job_descriptions), `supplier_category_id` (FK supplier_categories); UNIQUE `(job_description_id, supplier_category_id)`

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
`id`, `demand_id`, `supplier_id`, `candidate_profile_id` (FK candidate_profiles — direct applicants), `supplier_candidate_id` (FK supplier_candidates — supplier submissions), `candidate_name`, `candidate_email`, `status` (proposed/shortlisted/interview/offer/hired/awarded/rejected), `source` (supplier/direct), `submitted_at`, `cv_path`, `proposed_rate`, `rate_type`, `notes`, `ai_score` (int — saved AI semantic match %), `offer_status` (pending/accepted/declined — supplier response to offer), `offer_note` (text)

### `social_posts`
`id`, `demand_id` (FK demands), `platform` (enum: instagram/facebook/linkedin/tiktok/x), `status` (enum: draft/approved/posted/archived/rejected), `caption`, `hashtags` (text[]), `image_path`, `tracking_code` (unique 8-char code), `tracking_url`, `created_by`, `approved_by`, `approved_at`, `posted_at`, `external_post_url`, `created_at`, `updated_at`

### `notifications`
`id`, `user_id` (FK auth.users), `type` (enum: new_submission/submission_status/engagement_created/demand_received), `title`, `body`, `related_id` (UUID), `related_type` (demand/submission/engagement), `read_at` (null = unread), `created_at`

### `submission_interviews`
`id`, `submission_id` (FK candidate_submissions), `demand_id` (FK demands), `interviewer_name`, `interview_date`, `interview_type` (video/onsite/phone/technical/hr), `rating` (1–5), `notes`, `created_by` (FK auth.users), `created_at`

### `awards`
`id`, `demand_id` (FK demands — nullable), `submission_id` (FK candidate_submissions — nullable), `supplier_id` (FK suppliers — nullable), `tenant_id` (FK tenants — nullable), `candidate_name`, `candidate_email`, `supplier_name`, `demand_title`, `rate`, `rate_type`, `currency`, `total_amount`, `price_locked` (bool), `start_date`, `end_date`, `status` (text: pending_approval/approved/active/completed/cancelled), `notes`, `po_number` (text — purchase order number), `created_by` (FK auth.users), `created_at`, `updated_at`

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
| `20260623000033_tenant_isolation_v2.sql` | Rewritten `demands_select`, `cs_select`, `eng_select` RLS: super_admin sees all; admin/recruiter scoped to tenant when set; HM/procurement/finance scoped to own tenant |
| `20260623000034_career_ladders_tenant.sql` | `tenant_id` FK on `career_ladders`; deletes global seeded ladders (no tenant); scoped `cl_select/insert/update/delete` policies |
| `20260623000035_job_descriptions_org_units.sql` | `org_units` + `job_descriptions` + `supplier_categories` + `tenant_supplier_categories` + `supplier_category_members` + `jd_supplier_categories` tables; `profiles.org_unit_id` FK; `demands.job_description_id` FK; RLS on all new tables |
| `20260624000036_super_admin_demands_write.sql` | `demands_insert/update/delete` policies updated to include `super_admin`; purges stale notifications pointing to deleted demands |
| `20260625000038_notification_enhancements.sql` | ADD `demand_returned`, `award_pending_approval`, `demand_approved` to `notification_type` enum |
| `20260625000039_awards.sql` | `awards` table + `update_awards_updated_at()` trigger + RLS (select/insert/update/delete policies scoped to tenant) |
| `20260629000042_cost_items.sql` | `cost_item_categories` + `cost_items` + `cost_item_contract_types` + `cost_item_clients` tables; RLS; 7 categories + 37 cost items seeded |
| `20260629000043_compliance_rules.sql` | `compliance_rules` + `compliance_rule_clients` + `compliance_validation_logs` tables; RLS; 18 standard rules seeded (DE AÜG, IR35, working time, wages, expenses) |
| `20260629000044_award_periods.sql` | `billing_period_type` on `demands` + `awards`; `award_periods` (billing periods per award); `period_cost_entries` (GENERATED `amount` column, timesheets/expenses/milestones); RLS for staff/supplier/candidate |
| `20260629000045_tenant_rule_overrides.sql` | `tenant_compliance_rule_overrides` (per-tenant override of any platform compliance rule: active/threshold/severity/override_allowed); RLS scoped by tenant |
| `20260630_demand_rate_type` (applied via MCP) | `demands.rate_type text DEFAULT 'daily'` — rate type for billing (hourly/daily); selected on demand form, inherited by award and timesheet entries |

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
| `/dashboard/candidates/[id]` | Candidate detail — "Edit" button visible to admin/recruiter/super_admin |
| `/dashboard/candidates/[id]/edit` | Edit candidate profile (admin/recruiter/super_admin only) |
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
| `/dashboard/awards` | Awards list — filter by status (pending/approved/active/completed/cancelled); links to award detail |
| `/dashboard/awards/[id]` | Award detail — candidate, financial terms, dates, status actions (Approve / Mark Active / Complete / Cancel); billing period type selector + Generate Periods button + period list |
| `/dashboard/cost-items` | Cost Items inbox — all billing periods for current user's role (staff: tenant-scoped; supplier: own awards; candidate: own); status stat cards + search |
| `/dashboard/cost-items/[periodId]` | Billing period detail — cost entry form (timesheet/expense/milestone/fee + cost item picker); entries with approve/reject buttons for staff; Submit Period + Approve Period + Mark Invoiced actions |
| `/dashboard/settings/tenants` | Tenant list + create form (super_admin only; admin redirected to own tenant) |
| `/dashboard/settings/tenants/[id]` | Tenant detail — edit name/slug/active + workflow config + org units + job descriptions + supplier categories + user org unit assignment (admin/super_admin) |
| `/dashboard/settings/supplier-categories` | Global supplier categories management — create/edit/delete + assign suppliers per category (super_admin only) |
| `/dashboard/settings/cost-items` | Cost Item master data list — tabbed by contract type (All/Temp/Contracting/SOW/Perm); search; CRUD (super_admin only) |
| `/dashboard/settings/cost-items/new` | Create cost item — all 16 fields, contract type checkboxes, SAP mapping (super_admin only) |
| `/dashboard/settings/cost-items/[id]` | Edit cost item (super_admin only) |
| `/dashboard/settings/compliance-rules` | Compliance rules list — filter by country/contract type/severity; severity stat cards; CRUD (super_admin only) |
| `/dashboard/settings/compliance-rules/new` | Create compliance rule — all fields, validation logic picker (super_admin only) |
| `/dashboard/settings/compliance-rules/[id]` | Edit compliance rule (super_admin only) |

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
| `/api/generate-tenant-test-data` | POST streaming SSE — body: `{ tenantId }`; generates 15 E2E test scenarios per tenant using admin client; streams log lines as `data: { msg, type }` SSE events; done event: `data: { done: true, count, results }` |

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
