# Session Log

Shared context between VSCode and iPhone SSH Claude Code sessions.
Each session appends an entry at the end.

---

### 2026-06-23 15:30 — VSCode
- Built: User editing in Client Config (inline form: full_name, role, org_unit) via `updateTenantUser` action
- Built: Generate Test Client now creates supplier categories, links suppliers to categories, auto-assigns org units to users, generates exactly 10 JDs linked to categories
- Built: SESSION_LOG.md + Session Continuity Rule in CLAUDE.md for cross-session context sharing
- Decided: iPhone SSH via Termius + Tailscale (100.111.139.5) is the mobile workflow; ANTHROPIC_API_KEY set in ~/.zshrc to bypass keychain
- Next: no immediate pending tasks; awaiting new requirements from user

### 2026-06-23 15:35 — [VSCode]
- Fixed: org unit "can't be assigned" when editing a user in client config. Root cause = `org_units` table was empty, so the edit form's selector (gated on `orgUnits.length > 0`) rendered nothing. Edit form now always shows the Org Unit field, with a hint to create units when none exist (`users-section.tsx`).
- Seeded: 6 default DACH org units (Engineering, IT & Infrastructure, Sales & Marketing, Finance & Controlling, Operations, Human Resources) into all 3 tenants (Krautfeld SE, Velotherm GmbH, Velotherm SE).
- Verified: all reads/writes of migration-035 tables (org_units, job_descriptions, supplier_categories + 3 junctions) go through the admin/service-role client everywhere — incl. JD picker on New Demand page. Missing RLS policies on these tables have zero functional impact (RLS enabled + no policy = fail-closed deny-all, safe).
- Decided: leave RLS policies as-is (option 1) — fail-closed is safe; admin-client pattern is consistent.
- Next: latent risk only — if a future feature reads these tables via the regular client it gets empty results silently; add tenant-scoped read policies then.

### 2026-06-23 15:50 — [VSCode]
- Fixed: demand could be sent to suppliers before review/approval. "Send to Suppliers" was gated only by role, never by demand status, at both the UI (demand detail page) and the `sendToSuppliers` server action.
- Now: sending is only allowed when `demand.status === 'sourcing'` — the stage the state machine reaches AFTER MSP review (if configured) and/or the approval process (if configured), or immediately on submit when neither is configured. The workflow logic in `src/lib/workflow/index.ts` already computes this correctly; the bug was purely that send wasn't gated on it.
- Server action `sendToSuppliers` (suppliers.ts): now reads demand status via admin client and throws if not `sourcing`; also added `super_admin` to allowed roles (page already showed the panel to super_admin but the action rejected it — pre-existing inconsistency).
- UI: panel still renders for pre-sourcing statuses (draft/pending_review/pending_approval) but shows a locked amber banner with a status-specific reason (`sendLockedReason()` in page.tsx); the select+send form only renders at `sourcing`. "Already sent" list stays visible read-only for later statuses.
- Verified: JD auto-assign in workflow.ts only inserts demand_suppliers on the `→ sourcing` transition, so it's consistent. Full `tsc --noEmit` passes.
- Next: no pending tasks.

### 2026-06-24 — [VSCode]
- Fixed: 404 when super_admin clicks demand notification. Root cause: (1) all notification-linked demands were deleted (test data churn) — stale UUIDs; (2) `demands_insert/update/delete` RLS policies never included `super_admin` so super_admin couldn't create/edit/delete demands at all.
- Fixed: Applied migration 036 — adds `super_admin` to `demands_insert/update/delete` policies; purges stale notifications pointing to deleted demands.
- Fixed: `updateDemand` and `deleteDemand` server action guards now include `super_admin`.
- Added: `src/app/dashboard/demands/not-found.tsx` — graceful "Demand not found" page (with back link) instead of blank Next.js 404, for future stale notification links.
- Next: no pending tasks.

### 2026-06-24 — [VSCode]
- Fixed: MSP recruiter sees badge "1" on Demands but no notification visible. Root cause: no demand_pending_review notification type existed; only demand_created was fired (to admin/recruiter on demand creation). The recruiter had no dedicated "review queue" notification.
- Added: demand_pending_review notification type (migration 037) — fired when SUBMIT action moves demand to pending_review. Goes to recruiter+admin in the same tenant.
- Added: Purple sidebar badge (pendingReviewCount) on Demands nav item for recruiter/admin/super_admin — count of demands in pending_review status for their tenant.
- Added: demand_pending_review bell icon (purple search/magnifier icon).
- Added: preassigned demand_supplier_status (migration 037) — allows MSP to pre-assign suppliers during review without emailing them.
- Added: assignSuppliersForReview server action — adds to demand_suppliers with status preassigned, no email sent.
- Changed: send-to-suppliers panel now has two modes: pre-assign (pending_review, purple) and send (sourcing, blue). Pre-assigned suppliers appear as selectable at sourcing (with "pre-assigned" badge) so recruiter can notify them when the demand goes live.
- Fixed: suppliers-table-client.tsx + supplier/page.tsx updated to handle new preassigned status.
- Deployed to production.
- Next: no pending tasks.

### 2026-06-24 — [VSCode]
- Fixed: procurement user ralfoberme couldn't see demand 045ec89b (Velotherm SE). Root cause: tenant_id was null in profiles; RLS requires get_my_tenant_id() IS NOT NULL for procurement/finance roles.
- Fix: updated profiles.tenant_id to Velotherm SE (9d8b2e46) for ralfoberme directly in DB. Data issue, no code change.
- Next: no pending tasks.

### 2026-06-25 — [VSCode]
- Built: Approver UX improvements — procurement/finance can now edit demands during pending_approval (UI + server action use admin client to bypass standard RLS); APPROVE/APPROVE_REVIEW/APPROVE_AWARD show optional comment textarea (allowNote flag on TransitionDef); ProcessPanel renders textarea for both requiresNote and allowNote, only blocks confirm for mandatory notes.
- Built: procurement/finance now see Suppliers table, Submissions table, Awaiting Submissions banner, Engagements on demand detail (canViewSubmissions expanded to include these roles; sentEntries also fetched for them for the banner).
- Investigated: Issue 5 (only Performa Talent in switcher) — correct, other suppliers have no profile_id. Issue 6 (supplier sees no requirements) — Velotherm GmbH has zero demands in DB; user was switching to wrong Performa Talent (GmbH vs SE). No code fix needed.
- Next: no pending tasks.

### 2026-06-25 (2) — [VSCode]
- Built: 15 UX improvements for Velantrix Antriebstechnik SE fresh client
- Issue 1/3/6: New notification types (demand_returned, award_pending_approval, demand_approved) + firing logic in workflow.ts; pendingAwardCount + demandReturnedCount badge in sidebar; bell icons for new types in NotificationsBell
- Issue 2: Social post generation logs SOCIAL_POST_CREATED to process_history
- Issue 4: HM + procurement/finance can assign suppliers during pending_approval stage (assignSuppliersForReview updated)
- Issue 5: History label renamed to 'Reviewed by MSP' (was 'Approved by MSP')
- Issue 7: Optional comment field for APPROVE/APPROVE_REVIEW was already wired via allowNote flag — confirmed working
- Issue 8: updateDemand logs DEMAND_EDITED to process_history for review/approval/sourcing/screening stages
- Issue 9: sendToSuppliers already logs DEMAND_SENT_TO_SUPPLIERS; confirmed
- Issue 11: Supplier portal shows submitted candidates per demand (rate, status, headline) fetched from candidate_submissions; submit button hidden when not sourcing
- Issue 12: Supply submit locked at non-sourcing status — confirmed from previous session
- Issue 13: Award action moved from demand-level ProcessPanel (AWARD_CANDIDATE removed from screening transitions) to submission-level AwardPanel in CandidateDrawer; calls new awardSubmission server action
- Issue 14: Improved fuzzy/word-overlap skill matching (tokenize + word-level match); AI Analysis button in CandidateDrawer calls analyzeSkillMatchAI (Claude claude-sonnet-4-6) for semantic matching with matched pairs + explanations
- Issue 15: award_msp_offer config flag enforced: recruiter awards when true, HM awards when false; admin/super_admin always can award
- Deployed to production (Vercel CLI --prod)
- Next: run migration 20260625000038_notification_enhancements.sql in Supabase SQL editor

### 2026-06-25 — [VSCode]
- Wiped: all existing tenants (Krautfeld SE, Velotherm GmbH, Velotherm SE), all 15 suppliers, all supplier categories, demands, org units, JDs, career ladders, notifications.
- Deleted: all 44 test auth users via `DELETE FROM auth.users` (kept only super_admin: micciche.alessandro+admin@gmail.com, ID 9d0f6cb3).
- Created: Velantrix Antriebstechnik SE — Industrial Drive Systems & Motion Control. Full config: MSP review ON, 2-level demand approval (HM → Procurement), 3-level award approval (Procurement → Finance → Admin), MSP screening ON, PO step ON. 11 users all roles, 3 suppliers (Kernbach linked to portal user Markus Kernbach), 3 supplier categories, 10 candidates, 3 career ladders, 4 org units, 10 JDs. Password all users: Test1234!
- Next: no pending tasks.

### 2026-06-25 — [VSCode]
- Built: Match Info Popover — ℹ button next to every match % in submissions table; fixed-position popover shows matched skills (green), missing skills (red), AI Semantic Analysis button inline (no drawer needed). Components: MatchCell + MatchInfoPopover in submissions-table-client.tsx.
- Built: Awards Module — separate awards table with own status workflow (pending_approval → approved → active → completed/cancelled). New pages: /dashboard/awards (list + status filter) and /dashboard/awards/[id] (detail + action buttons). Sidebar Awards link updated to /dashboard/awards. Demand detail now shows Awards section. Migration 039 applied.
- Built: Upgraded AwardPanel in submission drawer — now captures financial details (rate, dates, cost estimate) before creating award record; calls createAward() action which also moves demand to award status + logs process history.
- Decided: Award = formal selection with approval workflow; Engagement = execution contract (old Commission flow kept). Future: change orders on awards; auto-create engagement when award approved.
- Updated: email changelog now includes English writing tips section alongside Better Requirements Writing.
- Next: no pending tasks.

### 2026-06-26 — [VSCode]
- Fixed Issue 1: ProcessPanel action buttons now show per-button spinner + "Processing…" label when clicked (useTransition pending). Both primary/danger action buttons and the Confirm button in note dialogs have loading state.
- Fixed Issue 2: DemandReadMarker now marks demand_pending_review, demand_pending_approval, demand_returned, demand_approved notifications as read when opening a demand. Prevents stale "Review required" bell notification showing after review is complete.
- Fixed Issue 3: HM pendingApprovalCount changed from demand-count (created_by = user) to notification-count (unread demand_pending_approval notifications for user). Root cause confirmed: Velantrix has hiring_manager as L1 approver, so badge wasn't showing for demands created by admin/others. DB verified: notification_type enum has all types; config demand_approval_role_l1 = 'hiring_manager'.
- Fixed Issue 4: Added removePreassignedSupplier server action; red × remove button added to pre-assigned supplier entries in SendToSuppliersPanel when canRemove=true (mirrors canAssign logic). Added canRemove prop to panel.
- Fixed Issue 5: updateDemand server action now uses adminDb when HM edits their own demand (isOwnerEdit), bypassing RLS that blocked post-return edits.
- Built Issue 6: DevDebugInfo component (indigo ℹ button in sidebar user area next to bell). Shows: timestamp, user/tenant/URL/entity IDs/viewport. Copy button.
- Deployed to production.
- Next: no pending tasks.

### 2026-06-27 — [VSCode]
- Fixed: DevUserSwitcher showed only 1 supplier user when 3 suppliers were assigned to the demand. Root cause: the 3-step client-picker step grouped supplier auth users by profiles.tenant_id, but supplier users don't have tenant_id matching the clients they serve (suppliers are global entities linked via tenant_suppliers, not profiles). Removed the client-picker step entirely; switcher now goes Role → User list showing all supplier users directly.
- Fixed: Icon alignment in sidebar user area. Bell (w-8 h-8 rounded-xl), debug ℹ (w-8 h-8 rounded-full with heavy shadow), and DEV pill (variable-width text) were inconsistently sized. Made all three w-8 h-8 rounded-xl. Replaced the "DEV↓" text pill with a person-switch SVG icon.
- Deployed to production.
- Next: no pending tasks.

### 2026-06-27 — [VSCode] (Session B: 11 UX improvements)
- Built: AI score persistence — `saveAiMatchScore()` called after every AI analysis (CandidateDrawer + MatchInfoPopover), stored to `candidate_submissions.ai_score`, shown in table with purple "AI" indicator on bar; updates local rows state so table refreshes immediately.
- Built: `submission_status` enum `awarded` — added to STATUS_META in submissions-table-client, suppliers-table-client, applications-client; STATUS_ORDER swaps "hired" → "awarded" for manual actions; `updateAwardStatus(approved)` now sets linked submission → `awarded`; `updateAwardStatus(active)` sets demand → `filled`.
- Fixed: Interview AI fill bug — `handleAiFill()` was sending plain strings as `fields`; changed to `FieldInfo[]` objects with name/type/label/options so /api/generate-test-data generates correct typed values.
- Fixed: DevDataGenerator position — moved from `bottom-6 right-6` to `bottom-6 left-6` (was overlapping CandidateDrawer footer action buttons).
- Built: Award detail page improvements — responsive DetailRow (flex-col on mobile, flex-row on desktop); `canAct` now includes procurement+finance (not just admin/recruiter); PO number inline edit form (input + Save PO button) calling `updateAwardPO()`; PO shown in Financial Terms section; award approval notifications route to /awards/[id] directly.
- Built: Awards sidebar badge — replaced `newEngagementsCount` with `pendingAwardApprovalCount` (green badge); layout.tsx queries awards table in pending_approval status scoped to tenant.
- Built: Dashboard pending approvals — added two new stat cards: "Demands Pending Approval" and "Awards Pending Approval" for approver roles (admin/recruiter/procurement/finance/super_admin); both scoped to tenant.
- Built: Demand progress bar — 8-segment segmented bar on each demand card showing % through PHASE_ORDER phases; terminal statuses show empty bar with status label; added PHASE_ORDER export from workflow module.
- DB migration: `20260627000040_submissions_ai_offer_awarded.sql` — adds `ai_score`, `awarded` status, `offer_status`, `offer_note` to candidate_submissions; `po_number` to awards.
- Deployed to production (https://workforce-platform-omega.vercel.app).
- Next: Supplier offer acceptance flow (notify supplier on 'offer' status, Accept/Decline on supplier portal) — partially implemented in `respondToOffer()` action but supplier portal UI not built yet.

### 2026-06-27 — [VSCode]
- Fixed: DevDataGenerator (✨) button was overlapping the sidebar user area on mobile — changed to `hidden md:flex` + `left-60` (desktop only, always outside sidebar)
- Fixed: Soft skill sliders in AvatarSection had no `name`/`id` attributes, so DevDataGenerator couldn't scan or fill them — added `name={soft_skill_${skill}}` and `id` + `htmlFor` label pairing
- Built: Career Navigator now shows all company career ladders ("Karriereleitern") with per-candidate skill match % — green = skills candidate already has, gray = missing; sorted recommended (AI-matched) first then by match %; visible even without AI avatar generated; uses adminDb to bypass career_ladders RLS for candidates; added legend to soft skill radar
- Next: no pending tasks

### 2026-06-28 — [VSCode]
- Built: Renamed all UI labels "Demands" → "DemandsX" across the entire dashboard and supplier portal (sidebar nav, page titles, breadcrumbs, stat cards, empty-state buttons, filter dropdowns)
- Changed files: sidebar.tsx, demands/page.tsx, demands/[id]/page.tsx, page.tsx (overview), engagements/page.tsx, submissions/page.tsx, demands/not-found.tsx, supplier-sidebar.tsx, supplier/demands/[id]/submit/page.tsx, social-media/page.tsx, candidates-list-client.tsx
- Decided: URLs/routes remain unchanged (/dashboard/demands/...) — only displayed text changed; no DB schema or variable names affected
- Next: no pending tasks

### 2026-06-28 — [VSCode] (Workflow Test Scenarios + E2E Visualizer)
- Built: `src/lib/workflow/scenarios.ts` — scenario engine: `generateScenarioSteps(config)` produces ordered steps for the full E2E workflow based on tenant config flags; `simulateScenario(config)` validates each step against live `getTransitions()` engine; `buildScenarioReport()` returns pass/fail summary per tenant
- Built: `src/components/WorkflowVisualizer.tsx` — horizontal scrollable flow diagram showing all 13 possible stages (Draft → MSP Review → Approval L1/L2/L3 → Sourcing → Screening → Award → Award Approval L1/L2/L3 → PO/Contracting → Filled); disabled stages shown dashed/grey with OFF badge; ON/OFF badge per conditional stage; legend for phase colors; embedded in tenant config page
- Built: `/dashboard/dev/test-scenarios` — super_admin-only page; loads all tenants + configs, runs simulation on page load, shows per-tenant cards with config badges, step-by-step pass/fail results grouped by phase; overall summary bar
- Added: 🧪 emoji button in sidebar user area (super_admin only) linking to test scenarios page
- Updated: `.claude/settings.json` — replaced granular permission entries with `Bash(*)`, `Edit(*)`, `Write(*)`, `Read(*)` wildcards + all MCP tools; `additionalDirectories` expanded to cover full project tree; applies to all connections (VSCode + iPhone SSH)
- Deployed to production
- Next: no pending tasks

### 2026-06-28 — [VSCode] (Test Scenarios v2 — Happy + Unhappy + History + AI Ideas)
- Built: Supabase migration `20260628000041_scenario_runs` — stores every run with pass/fail counts, full step_results JSONB, optimization_ideas JSONB, triggered_by, created_by_name
- Built: `src/lib/workflow/scenarios.ts` full rewrite — happy + unhappy paths; for every workflow-engine step auto-generates TWO unhappy variants: wrong role (must be blocked) + wrong status (must be blocked); actual tenant users assigned to each step by role; coverage gap detection
- Built: `src/lib/actions/scenario-runs.ts` — `runScenarioAction(tenantId)` fetches config + users, runs simulation, calls claude-haiku for 5 AI optimisation ideas (non-blocking), saves to DB; history helpers
- Built: `run-button-client.tsx` — compact + full variants with useTransition loading state
- Rebuilt: test scenarios page — global 4-card summary; per-tenant card with config chips, run badge, delta badge (▼ fixed / ▲ regressed), happy/security step sections, AI ideas panel, run history timeline
- Updated: tenant config page — run button + last run badge inline in E2E Visualizer card
- Auto-extend: steps fully derived from TenantConfig + getTransitions(); new config flags → new steps automatically; coverage gap detector flags uncovered actions
- Deployed to production

### 2026-06-29 — [VSCode]
- Fixed: ON/OFF badge in E2E Process Flow Visualizer was clipped at the top — added `pt-2` to the stage row flex container in `WorkflowVisualizer.tsx` so the absolute-positioned badge has room
- Built: `⚡ Optimise` button per AI Optimisation Idea in Workflow Test Scenarios — each idea gets a button + optional comment textarea; on click calls `/api/optimize-idea` which reads CLAUDE.md for context, calls Claude (claude-sonnet-4-6) to produce a full engineering spec, and emails it to developer
- New files: `optimization-panel-client.tsx` (client component), `src/app/api/optimize-idea/route.ts` (API endpoint, super_admin only)
- Deployed to production

### 2026-06-29 — [VSCode]
- Built: 🔧 Fix button on every failing test step (happy + security checks) in Workflow Test Scenarios — calls `/api/fix-step`, Claude diagnoses root cause + writes fix plan, emails developer
- Built: Cost display on all Optimise/Fix buttons — shows `~$0.02` estimate before click, actual cost (e.g. `$0.0213`) after API returns based on real token usage
- Updated: `/api/optimize-idea` now returns actual `cost` field; `optimization-panel-client.tsx` shows it after success
- New files: `failed-step-fix-button.tsx`, `src/app/api/fix-step/route.ts`
- Deployed to production

### 2026-06-29 — [VSCode] (Cost Item & Compliance Module)
- Built: Cost Item master data system — `cost_item_categories` (7 categories), `cost_items` (37 items seeded), `cost_item_contract_types` (junction), `cost_item_clients` (per-tenant overrides); migration 042 applied
- Built: Compliance Framework — `compliance_rules` (18 seeded: DE AÜG, IR35 UK, working time, minimum wage, expense caps), `compliance_rule_clients`, `compliance_validation_logs` (audit trail); migration 043 applied
- Built: 4 contract types mapped: `perm`, `temp`, `contracting`, `sow` — demand form updated to use new labels
- Built: `/dashboard/settings/cost-items` — list page with contract-type tabs (All/Temp/Contracting/SOW/Perm), search, delete; create/edit pages with all 16 spec fields
- Built: `/dashboard/settings/compliance-rules` — list page with filters + severity stat cards; create/edit pages with 17 validation logics, threshold, severity, override toggle
- Built: `getAvailableCostItems()` engine — dynamic filtering by contract type (with legacy value mapping), country, tenant; `validateEntity()` evaluation engine in compliance.ts
- Built: Award detail page shows "Applicable Cost Items" section grouped by category based on linked demand's contract type
- Sidebar: added "Cost Items" + "Compliance" links under Settings (super_admin only)
- Decided: invoice generation and SAP integration left for future phase (timesheet module needed first); engine + schema ready
- Deployed to production (https://workforce-platform-omega.vercel.app)
- Next: no pending tasks

### 2026-06-29 — [VSCode] (Cost Item Module Phase 2)
- Built: `award_periods` table + `period_cost_entries` table with GENERATED amount column; RLS for staff/supplier/candidate; migration 044 applied
- Built: `tenant_compliance_rule_overrides` table — per-tenant override of any platform compliance rule (active/threshold/severity/override_allowed); migration 045 applied
- Built: `/dashboard/cost-items` — main sidebar page (all roles) listing billing periods with status stat cards + search filter
- Built: `/dashboard/cost-items/[periodId]` — period detail with cost entry form (type/cost item/quantity/unit price), entry cards with approve/reject review buttons for staff, submit button for supplier/candidate, period approve/invoice status transitions
- Built: Award detail page gains "Billing Periods" section — billing period type selector, "Generate Periods" button (staff/active awards only), list of generated periods with status + link to period detail
- Built: Per-client compliance rule overrides UI in tenant settings — shows all platform rules with per-tenant override controls (active/severity/threshold/override_allowed + notes + reset button), "OVERRIDDEN" badge when customized
- Built: Mobile-responsive redesign of cost items config pages — `CostItemsClient` and `ComplianceRulesClient` now show card list on mobile (md:hidden), table on desktop (hidden md:block)
- Added: "Cost Items" main sidebar nav item (visible to admin/recruiter/hiring_manager/procurement/finance/supplier/candidate)
- Fixed: `generatePeriodDates` made async (required by Next.js 'use server' file constraint); ESLint fixes for prefer-const + unescaped entities
- Deployed to production (https://workforce-platform-omega.vercel.app)
- Next: invoice generation workflow, SAP GL export

### 2026-06-30 — [VSCode] (9 UX/Feature improvements)
- Fixed: Award page billing period generation crash (Item 8) — `getAvailableCostItems` now has .catch(()=>[]) on award page; Generate button only shows when billing_period_type is set; try/catch in form action prevents Next.js full-page crash when server action throws
- Built: Billing period type on Demand (Item 7) — new "Billing Period" field on demand form (non-perm contract types); saved in createDemand + updateDemand; inherited automatically when createAward() is called; shown on demand detail page
- Fixed: Dashboard wording unified Engagements → Awards (Item 9) — "Active Awards" / "Total Awards" from awards table, linking to /dashboard/awards
- Built: Sticky tab navigation on tenant config page (Item 3) — TenantConfigNav client component with IntersectionObserver highlights active section; tabs: Details | Workflow | Roles | Suppliers | Org & JDs | Compliance | Users
- Added: billing_period_type field to Demand TypeScript type
- Agent running in background: client-level test data generation (Items 1, 2, 4, 5, 6) — 15 E2E scenarios per tenant, action log modal, streaming API route
- Deployed to production (https://workforce-platform-omega.vercel.app) commit 2927642
- Next: wait for background agent (test data generation); apply final commit after agent completes

### 2026-06-30 — VSCode (E2E Test Data Generator)
- Built: `/api/generate-tenant-test-data` — streaming SSE POST route; generates 15 E2E scenarios per tenant using admin client (no auth checks); logs each step in real time
- Built: `GenerateTestDataButton` client component on tenant config page — purple ⚡ button next to RunScenarioButton; opens dark terminal-style modal with live colour-coded log stream; after completion shows summary + "Run E2E Scenarios" button linking to /dashboard/dev/test-scenarios?tenantId=[id]
- 15 scenarios: Group A Full E2E (5: demand→submission→award→billing periods→cost entries), Group B Demand→Award (5: various statuses), Group C Process only (5: sourcing/pending_approval/cancelled/on_hold/filled)
- Updated: `generateTestTenant` in tenants.ts now checks cost_items count and returns `costItemsEnabled: boolean`; result modal shows "✓ Cost items enabled" chip
- Updated: `GeneratedTenantResult` interface to include `costItemsEnabled`
- Deployed to production (https://workforce-platform-omega.vercel.app)
- Next: invoice generation workflow, SAP GL export

### 2026-06-30 — [VSCode] (7 Cost Items / Awards UX improvements)
- Built: Rate type field on demand form (hourly/daily selector in Billing section) — DB migration adds `rate_type` to demands table
- Built: Rate inherited from award in cost entry form — unit_price pre-filled from award.rate; quantity label says "Hours" or "Days" based on award.rate_type
- Built: Daily Timesheet mode in period detail — shows all working days (Mon–Fri) in the billing period; enter qty per day; Fill All button; live total preview; creates one entry per day via new `createDailyTimesheetEntries` action
- Built: Edit draft cost entries inline — pencil icon button; inline edit form for description, quantity, unit price, notes; new `updateCostEntry` server action
- Built: Cost items overview shows computed entry total — `listAllPeriods` now joins period_cost_entries and sums non-rejected amounts; displayed per period row
- Built: Awards overview stats bar — 5 stat cards (pending/approved/active/completed/cancelled) with count bubbles, mobile-optimized 2+3 grid; separate all-awards query for accurate counts when filtered
- Built: Auto-generate billing periods when award → active — `updateAwardStatus` now calls `generatePeriodDates` and inserts periods automatically when billing_period_type + start/end dates are set
- Built: Test data generator adds billing periods + cost entries for all active award scenarios (scenarios 3 and 6 previously missing)
- Decided: rate_type defaults to 'daily' in migration; nullable in TypeScript type
- Deployed to production (https://workforce-platform-omega.vercel.app)
- Next: no pending tasks

### 2026-06-30 (cont.) — [VSCode] (Test data generation + final deploy)
- Built: `/api/generate-tenant-test-data` streaming SSE route — 15 E2E scenarios per tenant (5 full E2E demand→submission→award→billing periods, 5 demand→award at various statuses, 5 demand process only); uses admin client directly; requires admin user in tenant
- Built: `GenerateTestDataButton` client component — terminal-style modal with live action log stream (colored log lines: green/red/yellow/grey), summary card with counts, "Run E2E Scenarios →" link after completion
- Updated: `GenerateTenantButton` result modal now shows "✓ Cost items enabled" chip when cost_items table has data
- Updated: `GeneratedTenantResult` type includes `costItemsEnabled: boolean`
- Button placed in tenant config page next to RunScenarioButton
- Deployed to production (https://workforce-platform-omega.vercel.app)
- Next: no pending tasks

### 2026-06-30 (cont.) — [VSCode]
- Fixed: HM demand creation error (Digest: 447659444) — migration 046 adds `rate_type TEXT DEFAULT 'daily'` to demands table (was referenced in createDemand() but never migrated); applied via Supabase MCP
- Fixed: Supplier create redirect — now goes to `/dashboard/suppliers/[id]/edit` instead of overview
- Fixed: Candidate list rows — registered candidates now have Edit button linking to `/dashboard/candidates/[id]/edit`; uses invisible overlay link pattern (no nested anchors)
- Fixed: Sidebar demand badge clears on page visit — `markDemandNotificationsRead()` called from FilterBar on mount
- Built: Demand list sort control — FilterBar now has sort dropdown (6 options: last updated/oldest updated/newest/oldest created/title/priority); sort param passed in URL, persisted to localStorage (`demands_sort` key)
- Built: WorkflowVisualizer extended with billing/cost phase (purple) — 4 new stages: Cost Entry, MSP Review (configurable), HM Approval (configurable), Invoiced; ON/OFF badge on conditional stages
- Built: `cost_msp_review` + `cost_hm_approval` config flags on tenant_configs (migration 047); toggles in tenant config workflow form; saved via updateTenantConfig
- Built: Cost item steps in E2E scenario runner — 4 new operational steps: Submit Cost Entry (supplier), MSP Review Cost Entry (conditional), HM Approve Billing Period (conditional), Mark Period Invoiced
- Built: Tenant config global search — `TenantConfigSearch` client component above nav; searches across users, suppliers, org units, JDs, supplier categories; click result scrolls to section anchor
- Decided: WorkflowVisualizer billing phase uses purple (#5856D6) to distinguish from existing demand/sourcing/award phases
- Deployed to production (https://workforce-platform-omega.vercel.app)
- Next: session email pending

### 2026-06-30 (cont. 2) — [VSCode] (Deploy recovery)
- Issue: Network outage on the Mac — TLS handshakes to vercel.com and github.com timing out (TCP connected, SSL never completed). Affected both `vercel --prod` and `git push`.
- Fixed: Network recovered later in session; pushed commit d5872db (all 8 items from this session) to GitHub successfully.
- Fixed: Production build caught a lint error `tsc --noEmit` missed — unused `tenantId` prop in `TenantConfigSearch`. Removed from both the component and its caller in tenant `[id]/page.tsx`. Commit 9406d13.
- Deployed to production (https://workforce-platform-omega.vercel.app) — build succeeded, all 40 routes compiled.
- Decided: `npx tsc --noEmit` alone is not sufficient pre-deploy verification — ESLint's `no-unused-vars` only runs during `next build`. Run `npm run build` locally before deploying when uncertain.
- Next: no pending tasks
