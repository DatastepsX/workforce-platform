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

### 2026-06-25 — [VSCode]
- Wiped: all existing tenants (Krautfeld SE, Velotherm GmbH, Velotherm SE), all 15 suppliers, all supplier categories, demands, org units, JDs, career ladders, notifications.
- Deleted: all 44 test auth users via `DELETE FROM auth.users` (kept only super_admin: micciche.alessandro+admin@gmail.com, ID 9d0f6cb3).
- Created: Velantrix Antriebstechnik SE — Industrial Drive Systems & Motion Control. Full config: MSP review ON, 2-level demand approval (HM → Procurement), 3-level award approval (Procurement → Finance → Admin), MSP screening ON, PO step ON. 11 users all roles, 3 suppliers (Kernbach linked to portal user Markus Kernbach), 3 supplier categories, 10 candidates, 3 career ladders, 4 org units, 10 JDs. Password all users: Test1234!
- Next: no pending tasks.
