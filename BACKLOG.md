# WorkforceX — Product Backlog

> **Product Owner:** Alessandro Micciché
> **Dev Team:** Claude (AI)
> **Process:** 1-week sprints · Definition of Done = built + tested + deployed + testing checklist

---

## Priority Legend
| Priority | Meaning |
|---|---|
| P0 | Blocker — must fix before anything else |
| P1 | Current sprint candidate |
| P2 | Next sprint candidate |
| P3 | Future / nice-to-have |

## Size Legend
| Size | Points | Effort |
|---|---|---|
| XS | 1 | < 1 hour |
| S | 2 | Half day |
| M | 3–5 | 1–2 days |
| L | 8 | 3–4 days |
| XL | 13 | 1+ week |

---

## 🏃 Sprint 2 — Planned (see SPRINT.md)

---

## 📋 Backlog

### UX & Workflow

---

#### [WFX-031] Supplier candidate rate type auto-set from demand contract type
**Priority:** P1 | **Size:** XS (1) | **Type:** Improvement

When a supplier submits a candidate to a demand, the rate type field should be pre-populated from the demand's contract type (permanent → annual, contractor → day, freelance → hourly). AI-generated candidates via DevDataGenerator should also get matching rates.

**Acceptance Criteria:**
- [ ] Supplier submission form pre-selects rate type based on demand contract type on mount
- [ ] DevDataGenerator instructs Claude to use a matching rate value when demand context is present
- [ ] Rate type mapping: `permanent → annual`, `contractor → day`, `freelance → hourly`, `fixed_price → fixed`

---

#### [WFX-032] Approval pending badge in sidebar navigation
**Priority:** P1 | **Size:** S (2) | **Type:** Improvement

When one or more demands are in `pending_approval` status and the current user's role can approve them, show a badge count on the Demands sidebar link (same pattern as Submissions inbox badge).

**Acceptance Criteria:**
- [ ] Admin and hiring_manager roles see the badge
- [ ] Badge count = number of demands in `pending_approval` status (all for admin, own demands for HM)
- [ ] Badge clears when user visits `/dashboard/demands` (or when no pending approvals remain)
- [ ] Consistent visual style with existing Submissions badge

---

### Architecture & Multi-Tenancy

---

#### [WFX-020] Tenant management — create and manage client companies
**Priority:** P1 | **Size:** L (8) | **Type:** Feature

As an Admin, I want to create and manage tenant (client) companies in a config area so that each client has its own isolated configuration.

**Acceptance Criteria:**
- [ ] `/dashboard/settings/tenants` page lists all tenants
- [ ] Create / edit / deactivate tenant
- [ ] Each tenant has: name, slug, logo (optional), active flag
- [ ] Admin can open tenant detail → see config + users

---

#### [WFX-021] Per-tenant workflow configuration
**Priority:** P1 | **Size:** L (8) | **Type:** Feature

As an Admin, I want to configure the workflow steps per tenant (MSP review on/off, approval levels 0–3, MSP screening on/off, PO step on/off) so that each client has a tailored process.

**Acceptance Criteria:**
- [ ] Tenant config UI on tenant detail page
- [ ] Toggle: MSP review before approval
- [ ] Dropdown: approval levels (0 / 1 / 2 / 3) + role per level
- [ ] Toggle: MSP screening
- [ ] Toggle: PO/contracting step
- [ ] Changes take effect immediately on demand process panel

---

#### [WFX-022] Role configuration per tenant
**Priority:** P1 | **Size:** L (8) | **Type:** Feature

As an Admin, I want to define which roles exist per tenant and what actions each role is permitted to perform in the workflow so that the platform is flexible per client.

**Acceptance Criteria:**
- [ ] Predefined role types: MSP Admin, MSP Service, Client HM, Client Procurement, Client Finance, Supplier, Candidate
- [ ] Per tenant: activate/deactivate role types
- [ ] Per role: view which workflow actions are permitted
- [ ] Config stored in `tenant_configs`

---

#### [WFX-023] User management per tenant — create users and assign roles
**Priority:** P1 | **Size:** L (8) | **Type:** Feature

As an Admin or MSP Service user, I want to create users and assign them to a tenant + role so that clients and suppliers can log in with the right access.

**Acceptance Criteria:**
- [ ] User creation form: email, role, tenant
- [ ] Invite-by-email flow (or auto-generated credentials)
- [ ] User list per tenant with role badges
- [ ] Deactivate user

---

#### [WFX-024] MSP Service user — multi-tenant data isolation
**Priority:** P1 | **Size:** L (8) | **Type:** Feature

As an MSP Service user, I want to see all data for my assigned clients (demands, submissions, candidates) but nothing from other clients so that data stays isolated.

**Acceptance Criteria:**
- [ ] `profiles` has `tenant_id` — MSP Service users are assigned to one or more tenants
- [ ] All data queries scoped to assigned tenants
- [ ] MSP Service can perform all actions within assigned tenants
- [ ] Admin can assign MSP Service users to tenants

---

#### [WFX-025] Customer user — read-only view throughout process
**Priority:** P2 | **Size:** M (5) | **Type:** Feature

As a Client user (HM, Procurement, Finance), I want to always see the current status of a demand I'm involved in regardless of which process stage it's in, but only be able to take actions when it's my turn.

**Acceptance Criteria:**
- [ ] Client users can always view demand detail + history
- [ ] Action buttons only appear when role is the designated actor for current status
- [ ] View-only badge shown when demand is in another role's hands

---

#### [WFX-026] User Switch redesign — Admin → Tenant → Role → User
**Priority:** P2 | **Size:** L (8) | **Type:** Improvement

As a developer/tester, I want the DevUserSwitcher to let me pick: platform level (Admin) or a specific tenant → then a role → then a user, so I can test all personas easily.

**Acceptance Criteria:**
- [ ] Step 1: Select scope (Platform Admin / Tenant name)
- [ ] Step 2: Select role within that scope
- [ ] Step 3: Select user
- [ ] Compact, modal or dropdown UI

---

#### [WFX-027] Seed multi-tenant test data
**Priority:** P2 | **Size:** M (3) | **Type:** Dev/Test

As a developer, I want realistic multi-tenant test data so I can test the platform with multiple clients, roles, and workflow configurations.

**Acceptance Criteria:**
- [ ] 2 demo tenants: "Siemens AG" (full MSP workflow) + "Allianz SE" (self-service, no MSP review)
- [ ] Users per tenant: HM, Procurement, Finance approver
- [ ] MSP Service users assigned to each tenant
- [ ] 3–5 demands per tenant in various statuses

---

### Candidate & Interview

---

#### [WFX-028] Interview data capture per candidate/submission
**Priority:** P2 | **Size:** L (8) | **Type:** Feature

As a Hiring Manager, I want to capture structured interview feedback per candidate within a demand (1st interview, 2nd interview, rating, notes) so that selection decisions are documented.

**Acceptance Criteria:**
- [ ] Interview panel on submission detail: add interview round (date, interviewer, type, rating 1–5, notes)
- [ ] Multiple rounds per submission
- [ ] Summary visible in submission row (interview count + avg rating)
- [ ] Informs the shortlisting/award decision

---

#### [WFX-029] Rates by contract type for candidates
**Priority:** P2 | **Size:** S (2) | **Type:** Improvement

Already in Sprint 1 — see WFX-012.

---

### Reporting

---

#### [WFX-030] Spend analytics dashboard
**Priority:** P3 | **Size:** XL (13) | **Type:** Feature

As an Admin / MSP, I want to see spend by tenant, supplier, and period + KPIs (time-to-fill, submission rate) so that I can measure platform performance.

---

## ✅ Done

*(Completed stories move here after sprint review)*

- [WFX-001–019] Initial platform build (Auth, Demands, Suppliers, Candidates, Submissions, Matching, Career Portal, Engagements, Notifications, Social Media, Career Avatar, Workflow v1, Workflow v2)
