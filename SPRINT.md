# Sprint 1 — WorkforceX

> **Sprint Goal:** Stabilize the demand workflow model; fix mobile UX gaps; align naming with MSP vocabulary
> **Started:** 2026-06-20 | **Target:** 2026-06-27
> **PO:** Alessandro Micciché | **Dev:** Claude

---

## Sprint Stories

| ID | Title | Size | Status |
|---|---|---|---|
| WFX-007 | Remove interview from demand status; shortlist/interview at submission level | M (5) | ✅ Done |
| WFX-010 | Compact ProcessPanel — show next-action owner, smaller buttons | S (2) | ✅ Done |
| WFX-011 | Notification on Pending Approval | S (2) | ✅ Done |
| WFX-012 | Candidate rates by contract type | S (2) | ✅ Done |
| WFX-013 | History: supplier upload events + per-candidate actions | M (3) | ✅ Done |
| WFX-015 | Demands list — mobile responsive | S (2) | ✅ Done |
| WFX-016 | Rename Engagements → Awards; Commission → Award | M (3) | ✅ Done |
| WFX-017 | Demand detail mobile status area overflow fix | XS (1) | ✅ Done |
| WFX-018 | Smarter candidate matching display (no horizontal scroll) | M (3) | ✅ Done |
| WFX-019 | Applicant full name in Match Pool (not "ApplicantX") | XS (1) | ✅ Done |

**Total:** 24 points

---

## Story Details

### WFX-007 — Remove interview from demand status
**Status:** 🟡 In Progress

Shortlisting and interview happen at the **submission** level, not the demand level. The demand stays in `screening` while candidates are interviewed. Only when a submission is awarded does the demand move to `awarded`.

**Changes needed:**
- [ ] Remove `interview` from `demand_status` enum (migration)
- [ ] Remove `interview` phase from ProcessPanel stepper
- [ ] Remove "Move to Interview" / "Back to Sourcing" transitions from `workflow/index.ts`
- [ ] Add `awarded` status (currently `award` in enum — confirm naming)
- [ ] Update filter-bar.tsx status list
- [ ] Update STATUS_LABELS / STATUS_COLORS in workflow/index.ts
- [ ] Update career portal isActive check (remove `interview` if present)
- [ ] Update `demands_public_read` policy in migration if needed

---

### WFX-010 — Compact ProcessPanel
**Status:** ⬜ Todo

- [ ] Reduce stepper to 1 line (no phase labels, just dots with tooltips)
- [ ] Shrink action buttons (smaller, gray ghost style for secondary)
- [ ] Add "Next action: [Role]" line below status badge

---

### WFX-011 — Notification on Pending Approval
**Status:** ⬜ Todo

- [ ] Trigger `createNotification` for all users with role `hiring_manager` when demand transitions to `pending_approval`
- [ ] New `NotificationType`: `demand_pending_approval`
- [ ] Add to notification type enum (migration or extend existing)
- [ ] Bell icon should link to the demand

---

### WFX-012 — Rates by contract type
**Status:** ⬜ Todo

- [ ] On candidate/supplier candidate forms: show "Day Rate (€/day)" for contractor, "Hourly Rate (€/hr)" for freelance, "Annual Salary (€/yr)" for permanent
- [ ] On demand form: same labeling for budget fields
- [ ] computeMatch() remains unit-agnostic (just numeric comparison)
- [ ] Display labels in submission rows and candidate lists

---

### WFX-013 — History with submission events
**Status:** ⬜ Todo

- [ ] Log to `process_history` when supplier submits candidates (action: `candidates_submitted`, notes: "Supplier X submitted N candidate(s)")
- [ ] Log when submission status changes: shortlisted, interview, rejected, hired
- [ ] ProcessPanel history log shows all events including submission-level ones
- [ ] Add submission actor name/role to history entries

---

### WFX-015 — Demands list mobile responsive
**Status:** ⬜ Todo

- [ ] On mobile: stack budget + dates below title instead of right-aligned column
- [ ] Skills chips: max 3 visible on mobile, hide rest
- [ ] Chevron: hide on mobile to save space
- [ ] Header "New Demand" button: icon only on mobile

---

### WFX-016 — Rename Engagements → Awards
**Status:** ⬜ Todo

- [ ] UI rename: "Engagements" → "Awards" throughout sidebar, breadcrumbs, page titles
- [ ] DB: `engagements` table stays (no rename needed in DB for now)
- [ ] Action: "Commission" → "Award Candidate"
- [ ] Award creation should create an approval entry (simple: set award status to `pending_approval` if config requires it)
- [ ] Sidebar link `/dashboard/awards` → redirect or rename route

---

### WFX-017 — Mobile status area overflow
**Status:** ⬜ Todo

- [ ] Demand detail page: ProcessPanel horizontal stepper overflows on narrow screens
- [ ] Use `overflow-x-auto` with `scrollbar-hide` on stepper container
- [ ] Or collapse to vertical stack on mobile (< 640px)

---

### WFX-018 — Smarter matching display
**Status:** ⬜ Todo

- [ ] Replace horizontal-scroll skills strip in match pool with wrapping chip grid
- [ ] On mobile: cards instead of table (already described in CLAUDE.md — verify implementation)
- [ ] Score ring: show number inside ring

---

### WFX-019 — Full name in Match Pool
**Status:** ⬜ Todo

- [ ] `getCandidateDisplayName()` already exists — verify it's used in match pool table rows
- [ ] If showing email alias ("Applicant1"), fix to use the helper
- [ ] Supplier candidates: show `name` field directly

---

## Sprint Log

| Date | Event |
|---|---|
| 2026-06-20 | Sprint 1 kickoff — backlog created, stories defined |
| 2026-06-21 | Sprint 1 complete — all 10 stories shipped, deployed to production |
