# Sprint 2 — WorkforceX

> **Sprint Goal:** Quick UX wins (approval badge, rate type auto-set) + multi-tenancy foundation (tenant management + workflow config)
> **Started:** 2026-06-21 | **Target:** 2026-06-28
> **PO:** Alessandro Micciché | **Dev:** Claude

---

## Sprint Stories

| ID | Title | Size | Status |
|---|---|---|---|
| WFX-031 | Supplier candidate rate type auto-set from demand | XS (1) | ✅ Done |
| WFX-032 | Approval pending badge in sidebar nav | S (2) | ✅ Done |
| WFX-020 | Tenant management — create and manage client companies | L (8) | ✅ Done |
| WFX-021 | Per-tenant workflow configuration | L (8) | ✅ Done |

**Total:** 19 points

---

## Story Details

### WFX-031 — Rate type auto-set from demand
**Status:** ⬜ Todo

When a supplier opens a candidate submission form in the context of a specific demand, the rate type dropdown should be pre-selected to match the demand's contract type.

**Mapping:** `permanent → annual` · `contractor → day` · `freelance → hourly` · `fixed_price → fixed`

**Files to change:**
- `src/app/supplier/demands/[id]/submit/page.tsx` — pass contract_type to candidate form
- `src/app/supplier/candidates/candidate-form.tsx` — accept `defaultRateType` prop, set on mount

---

### WFX-032 — Approval pending badge in sidebar
**Status:** ⬜ Todo

Show a badge count on the Demands sidebar link when demands are awaiting the current user's approval. Same pattern as Submissions badge.

**Files to change:**
- `src/app/dashboard/sidebar.tsx` — query pending_approval demands count, show badge on Demands link
- Optionally: server action to get pending approval count (or inline query in sidebar)

---

### WFX-020 — Tenant management
**Status:** ⬜ Todo

New settings area at `/dashboard/settings/tenants` where admins can create and manage client companies (tenants).

**DB:** `tenants` table already exists (from migration 024). Needs: UI page + CRUD actions.

**Files to change:**
- `supabase/migrations/20260622000026_tenant_management.sql` — RLS policies for tenants table
- `src/app/dashboard/settings/tenants/page.tsx` — tenant list
- `src/app/dashboard/settings/tenants/[id]/page.tsx` — tenant detail + edit
- `src/lib/actions/tenants.ts` — createTenant, updateTenant, deactivateTenant
- `src/app/dashboard/sidebar.tsx` — add Settings section for admin

---

### WFX-021 — Per-tenant workflow configuration
**Status:** ⬜ Todo

On the tenant detail page, show and edit the workflow configuration (MSP review toggle, approval levels, screening toggle).

**DB:** `tenant_configs` table already exists (from migration 024). Needs: UI + update action.

**Files to change:**
- `src/app/dashboard/settings/tenants/[id]/page.tsx` — embed config form
- `src/lib/actions/tenants.ts` — updateTenantConfig action

---

## Sprint Log

| Date | Event |
|---|---|
| 2026-06-21 | Sprint 2 kickoff — 4 stories, 19 points |
| 2026-06-21 | Sprint 2 complete — all 4 stories shipped, deployed to production |

---

---

# Sprint 3 — WorkforceX

> **Sprint Goal:** Role config per tenant + user management + demo seed data
> **Started:** 2026-06-21 | **Completed:** 2026-06-21
> **PO:** Alessandro Micciché | **Dev:** Claude

## Sprint Stories

| ID | Title | Size | Status |
|---|---|---|---|
| WFX-022 | Role configuration per tenant | L (8) | ✅ Done |
| WFX-023 | User management per tenant — invite + list + deactivate | L (8) | ✅ Done |
| WFX-027 | Seed multi-tenant test data | M (3) | ✅ Done |

**Total:** 19 points

## Sprint Log

| Date | Event |
|---|---|
| 2026-06-21 | Sprint 3 kickoff + complete — all 3 stories shipped, deployed to production |

---

---

# Sprint 4 — WorkforceX

> **Sprint Goal:** Data isolation + interview capture
> **Started:** 2026-06-21 | **Completed:** 2026-06-21
> **PO:** Alessandro Micciché | **Dev:** Claude

## Sprint Stories

| ID | Title | Size | Status |
|---|---|---|---|
| WFX-024 | MSP Service — multi-tenant data isolation | L (8) | ✅ Done |
| WFX-025 | Customer read-only view in ProcessPanel | M (3) | ✅ Done |
| WFX-028 | Interview data capture per submission | L (8) | ✅ Done |

**Total:** 19 points

## Story Details

### WFX-024 — Multi-tenant data isolation
- `tenant_id` column added to `demands` table; backfilled from creator's profile
- `get_my_tenant_id()` SECURITY DEFINER function (avoids RLS recursion)
- `demands_select` RLS policy updated: recruiter sees own-tenant or unscoped demands; HM sees all demands in own tenant (not just self-created); admin sees all
- `createDemand` server action auto-sets `tenant_id` from creator's profile

### WFX-025 — Customer Read-Only badge
- `ProcessPanel` now shows a grey "View Only" badge (eye icon) when a user's role has no available transitions for the current status and the demand is not in a terminal state

### WFX-028 — Interview data capture
- `submission_interviews` table with RLS (recruiters/admins full access; HM read-only)
- `addInterview` + `deleteInterview` server actions in `src/lib/actions/interviews.ts`
- `InterviewSection` component inside the submission detail drawer: date, type chip, star rating, interviewer, notes; instant optimistic update on add/delete

## Sprint Log

| Date | Event |
|---|---|
| 2026-06-21 | Sprint 4 kickoff + complete — all 3 stories shipped |

---

---

# Sprint 5 — WorkforceX

> **Sprint Goal:** Mobile responsiveness, tenant context, procurement/finance roles, user creation UX
> **Started:** 2026-06-21 | **Completed:** 2026-06-21
> **PO:** Alessandro Micciché | **Dev:** Claude

## Sprint Stories

| ID | Title | Size | Status |
|---|---|---|---|
| WFX-033 | Mobile-responsive demands filter bar | XS (1) | ✅ Done |
| WFX-034 | Active client tenant indicator in sidebar | S (2) | ✅ Done |
| WFX-035 | DevUserSwitcher shows client tenant per user | XS (1) | ✅ Done |
| WFX-036 | Procurement + Finance as configurable platform roles | M (5) | ✅ Done |
| WFX-037 | User creation with explicit email + password | S (2) | ✅ Done |

**Total:** 11 points

## Story Details

### WFX-033 — Mobile demands filter
Filter bar in `demands/filter-bar.tsx` shows native `<select>` elements on mobile (hidden on sm+); chip strip shown only on sm+. Fixes overflow on small screens.

### WFX-034 — Active client context in sidebar
Sidebar brand area shows a blue house icon + client tenant name when the logged-in user has a `tenant_id`. Fetched in `dashboard/layout.tsx` from tenants table. Invisible for MSP-side roles with no tenant.

### WFX-035 — Tenant in DevUserSwitcher
Each user in the switcher step-2 list now shows their tenant name in blue before their email (e.g. "Siemens AG · hm@example.com"). Requires `tenantName` field on `UserOption`.

### WFX-036 — Procurement + Finance roles
`procurement` and `finance` added to the `user_role` Postgres enum (migration 029); TypeScript `UserRole` updated; sidebar nav grants them access to Demands, Submissions, and Awards; PREDEFINED_ROLES in tenant config extended to 7 roles; user invite form shows them under "Client Roles" optgroup.

### WFX-037 — Explicit password creation
`UsersSection` invite form has "Set password" toggle; when active, shows a password input (min 8 chars). If provided, uses it; if not, auto-generates a temp password as before. Auto-generated temp password is shown post-creation; user-set password is not revealed.

## Sprint Log

| Date | Event |
|---|---|
| 2026-06-21 | Sprint 5 kickoff + complete — all 5 stories shipped |

---

## Roadmap (future sprints)

### Sprint 6 — DevX + Reporting (~21 pts)
- WFX-026: DevUserSwitcher redesign — Admin → Tenant → Role → User (L)
- WFX-030: Spend analytics dashboard (XL)
