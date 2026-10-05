# PeerBridge — Phase 2 Master Plan
==========================================================
Confirmed decisions this plan is built on:
- **Faculty role is retained** — removed only: direct open student↔faculty chat, and the
  dead `counselor_admin` reference.
- **Faculty keeps:** profile, department broadcast/verified announcements (one-way), and
  becomes the **Level 1 reviewer** in the new Complaint & Escalation System.
- **Higher Authority (Admin/Super Admin)** = Level 2 — sees only escalated complaints, and
  is the sole owner of the permanent audit trail ("cluster head/manager" record).
- **SOS is fully removed** — no emergency button, no severity classification, no auto-dispatch.
- **Domain:** single university, email-domain based registration/role detection.
- **Mood Tracker trends:** visible only to Admin/Super Admin, never to Faculty.

---

# PART A — All 12 Modules, Updated

Legend: ✅ Keep as-is · 🔄 Update/modify · ❌ Removed · ➕ New

### 1. Authentication & Role Engine
✅ Register/Login · University email-based registration · JWT generation · Automatic role
detection from email domain · Brute-force lock (5 attempts/30 min) · Bcrypt password
storage · Session expiry & logout · Landing-page login/register entry · Super Admin
manually seeded by IT.
🔄 Role enum stays `student / faculty / admin / super_admin` — confirm no `counselor_admin`
anywhere in DB or code.

### 2. Smart User Profile System
✅ Unified role-based profile (student/faculty/admin) · Anonymous Display ID for students ·
Skills/subject tags · Hidden behavior score · Crypto separation of real identity & anonymous
ID · Consent collection for mood/analytics · Right to erasure (72h) · Chat log
auto-delete (30 days unless flagged) · Faculty profile (department, designation, subjects,
office hours) · First-login onboarding screen.
No changes needed here.

### 3. Communication Hub
✅ Real-time chat (Socket.io) · Typing indicators & read receipts · Block/report · Chat modes
(Chat Only, Study Group, Campus Meeting) · End-to-end encryption · Chat log auto-expiry (30
days) · Audit logs.
🔄 "Role based messaging" is now **student-student only** — no student↔faculty open chat.
🔄 TensorFlow NLP scan stays, but its output now feeds the shared abuse-detection service
(flag/hold message) instead of triggering SOS.
🔄 Faculty broadcast messaging **stays** — it's one-way (department/group announcements),
not a chat channel, so it doesn't count as "direct student-to-faculty path."
❌ "Severity scoring with automatic Crisis SOS trigger" — removed.
❌ "Anonymous SOS communication channel for emergencies" — removed.
🔄 Audit log bullet: "moderation & SOS triggers" → "moderation & content-flagging events."

### 4. Academic Support Board
✅ Structured help-request posts (subject/urgency tags) · Auto chat initiation on match ·
Request lifecycle (Open/Matched/In Progress/Resolved/Closed) · Faculty trend dashboard
(help patterns by department) · Reputation points on resolution · Helper listings · Daily
post limit · AI moderation pipeline (clean/hold/reject+appeal).
No structural changes — faculty trend dashboard here is a legitimate read-only faculty
feature (viewing patterns, not chatting), so it's unaffected by the chat restriction.

### 5. Intelligent Peer Matching Engine *(Phase 2 focus — see Part B)*
✅ Multi-factor matching (subject/semester/activity) · Weighted scoring (subject, semester,
trust score, activity) · Trust-score filtering · Accept/decline with response window ·
Feedback loop.
❌ "Faculty expertise tags used during helper matching" — removed; this engine is
student-to-student only.
🔄 "Escalation to faculty trend view if no match found in 24h" — **kept as a read-only
dashboard signal** (unmatched requests become visible on the faculty trend dashboard from
Module 4), but with **no chat/contact action** attached to it. Faculty sees the pattern,
does not get pulled into a conversation.
✅ Anonymous ID only, real identity never revealed.

### 6. Safety & Harassment Monitor
✅ Multi-layer content safety detection · Keyword filtering · Human-in-the-loop review for
flagged content · Escalation levels (warning→removal→suspension→identity reveal) ·
Behavior score updates · Cross-module monitoring (chats, posts, uploads) · Rotating
anonymous ID tokens · GDPR-style compliance checks.
🔄 "Perspective API" / "Gemini API" wrappers → replaced by the **shared local
abuse-detection service** (keyword list + TensorFlow.js sentiment/toxicity), since no
external paid API is actually configured in the stack (per the existing codebase audit).
🔄 Data retention: "posts auto-delete after 90 days, **SOS logs kept 1 year**" → SOS clause
removed; general moderation/audit logs follow the existing audit-log retention policy.

### 7. Mood & Wellbeing Tracker *(Phase 2 focus — see Part B)*
✅ Optional daily anonymous check-in · 5-level emoji scale · Gentle reminders for missed
check-ins · Pattern detection for consecutive low entries · Mood stored anonymized ·
Optional text response.
❌ "Rule-based alert — 3 consecutive low entries notify counselor" — removed (this was a
crisis-trigger; inconsistent with SOS removal).
❌ "Automated wellness check-in after SOS resolution" — removed (SOS no longer exists).
🔄 "Mood score forwarded to Resource Library for personalized filtering" — kept, this is
just content personalization, not an alert.
🔄 "Aggregated wellbeing trends for admins only" → **clarified: visible only to
Admin/Super Admin (Higher Authority). Faculty does not see mood data, individual or
aggregated.**

### 8. Complaint & Escalation System *(renamed from "Crisis SOS & Escalation" — Phase 2 focus, see Part B)*
❌ SOS emergency button, 10-second cancellation countdown, category-based SOS routing,
office-hours/on-call routing, escalation to counselor→HOD→emergency contact, auto-attached
mood history, mental-health-vs-physical-threat classification — **all removed.**
➕ Student-to-student complaint/report system.
➕ Fixed complaint categories (harassment, abusive language, academic dispute, privacy
violation, spam/scam, other — finalize exact list against your SRS wording).
➕ Two-level workflow: **Level 1 = Faculty** (sees only complaints assigned to them) →
**Level 2 = Higher Authority/Admin** (sees only complaints Faculty has escalated).
➕ Abusive-language auto-flagging on every complaint submission via the shared
abuse-detection service (raises priority, does not auto-escalate levels).
➕ Permanent, append-only audit trail — owned and fully readable only by Higher Authority
(this is the "cluster head/manager" record the panel asked for).
➕ Identity-reveal stays gated behind Higher Authority + justification + secondary approval
(reuses the existing pattern from Module 11).
➕ Clear in-app disclaimer: genuine emergencies must go to real-world emergency
services — the platform does not simulate handling them.

### 9. Resource & Study Library *(Phase 2 focus — see Part B)*
✅ Demand-driven resource ranking · Advanced search/filter (subject/semester) · Rating &
review · Auto-flagging of low-rated resources · AI file scan for malicious content ·
**Faculty approval workflow retained** (subject relevance & quality check) · AI-personalized
recommendations via Mood Tracker API · Personal bookmarks.
No structural changes — faculty's role here is a review/approval action, not open chat, so
it's unaffected.

### 10. Community Notice Board *(Phase 2 focus — see Part B)*
✅ Categories (Study Groups, Lost & Found, Events, Announcements) · Smart location
clustering · Post expiry with reminder/extension · Anonymous chat integration · Sensitive-info
blocking (phone numbers, payment requests) · Trending algorithm · Anonymous reporting
(3 reports→auto-hold) · Engagement reactions · Keyword search/filters · **Faculty verified
announcements with push notifications retained** · AI moderation pipeline.
🔄 Categories become a **required, enforced field** at post creation (not just a planned
list).
🔄 AI moderation pipeline explicitly wired to the shared abuse-detection service
(keyword + sentiment) — same engine used everywhere else, no separate logic.

### 11. Admin Panel *(Phase 2 focus — see Part B)*
✅ Real-time platform safety monitoring · Aggregated mood trend analytics by department
(Admin/Super Admin only) · Complete violation history · Controlled identity-reveal system ·
Data breach detection · Appeals management for AI-rejected content · AI moderation rules
manager · Repeat offender review · Behavior score manual override · Usage statistics ·
Weekly policy review.
❌ "Role based access separation (Super Admin, **Counselor Admin**, Dept Admin)" →
🔄 becomes **Super Admin, Dept Admin** (Higher Authority tier only — `counselor_admin`
does not exist).
❌ "SOS alert management & response tracking," "Crisis & SOS manager (Step 3
escalations)," "Crisis alerts panel with response tracking" — all removed.
➕ **Complaint & Escalation dashboard** — Higher Authority view shows escalated complaints
only, plus full read-only access to the permanent `complaint_history` audit trail.
➕ Note: Faculty's own assigned-complaint queue lives in a separate **Faculty Portal view**,
not inside the Admin Panel (Admin Panel is Higher Authority-only).

### 12. Reputation & Trust Score
✅ Trust score (0–100), recalculated every 24h · Visible only to matching engine ·
Monthly department leaderboard · Integration with peer matching · Badge tiers · Score
increase/decrease rules · Weighted formula (helpfulness, resolution count, violations,
response time).
No changes needed here.

---

# PART B — Detailed Feature Breakdown for the 6 Phase-2 Modules

## Module 1: Intelligent Peer Matching Engine
| Feature | What it means to build |
|---|---|
| Multi-factor matching | Score candidate helpers by subject match, semester proximity, and recent activity level |
| Weighted scoring | Combine subject/semester/trust-score/activity into one ranked score, tunable weights |
| Trust-score filtering | Exclude/deprioritize helpers below a minimum trust threshold |
| Accept/decline flow | Matched helper gets a bounded time window to accept; auto-expire and re-match if declined/ignored |
| Feedback loop | Post-resolution feedback adjusts future matching weight for that helper |
| Reliability fixes | Fix the broken REST-message-stub / Socket.io inconsistency so accepted matches reliably produce a working conversation |
| Abuse detection in chat | Every message run through the shared abuse-detection service; flagged messages held/logged |
| Unmatched-request signal | After 24h with no match, request appears flagged on the faculty trend dashboard (read-only, no chat trigger) |

## Module 2: Mood & Wellbeing Tracker
| Feature | What it means to build |
|---|---|
| Daily check-in | 5-level emoji mood scale, one entry per day, optional free-text |
| Schema fix | Resolve `notes` vs `note` mismatch between service and DB column |
| Personal trend view | Student sees their own 7/30-day mood history as a simple chart |
| Reminder | Gentle in-app nudge if no check-in for N days — no push/SMS unless already built |
| Free-text safety filter | Run optional text through the abuse-detection service for profanity filtering before storage only — no alerting |
| Aggregated admin view | Fully anonymized, department-level trend graphs, **restricted to Admin/Super Admin role only** |
| Resource linkage | Mood score can bias Resource Library recommendations (e.g. suggest relevant wellbeing content) |

## Module 3: Resource & Study Library
| Feature | What it means to build |
|---|---|
| Upload flow | Title, description, subject/semester tags, file or link, uploader anonymous ID |
| Faculty approval queue | Faculty reviews pending resources for subject relevance/quality before publish |
| Content safety scan | File type/size validation + description/title run through abuse-detection service |
| Search & filter | By subject, semester, category, rating, recency |
| Rating & review | Students rate/review; low-rated resources (below threshold) auto-return to review queue |
| Bookmarks | Personal saved-resources list per student |

## Module 4: Complaint & Escalation System
| Feature | What it means to build |
|---|---|
| Complaint submission | Student files a complaint against another student or content, with category + description + optional evidence reference (message/post ID) |
| Categories | Fixed set: harassment, abusive language, academic dispute, privacy violation, spam/scam, other |
| Level 1 — Faculty | Auto-assigned to an available faculty reviewer; sees **only their own assigned complaints** |
| Faculty actions | Resolve directly, reject with logged reason, or escalate to Level 2 |
| Level 2 — Higher Authority | Sees **only escalated complaints**; can resolve, reject, or take further action (e.g. identity reveal) |
| Abuse auto-flag | Submission text run through the shared abuse-detection service; high-severity flags raise priority in the faculty queue (does not auto-escalate) |
| Permanent audit trail | Append-only `complaint_history` log of every status change/assignment/escalation, fully readable only by Higher Authority — this is the panel's "cluster head/manager" record |
| Identity reveal | Only Higher Authority, with justification + secondary approval (reuse existing pattern) |
| Emergency disclaimer | Static, always-visible note directing genuine emergencies to real-world services |

## Module 5: Community Notice Board
| Feature | What it means to build |
|---|---|
| Enforced categories | Study Groups / Lost & Found / Events / Announcements (+ any you finalize) — required at post creation, filterable in UI |
| Faculty verified announcements | Faculty/admin post official announcements with an "Official" badge and push notification, one-way (no reply-chat with faculty) |
| Abuse detection on posts | Every post scanned before publish: clean→live, medium→hold for faculty/moderator review, high→reject+appeal |
| Sensitive-info blocking | Auto-detect and block phone numbers/payment requests in post body |
| Reporting | 3 reports on a post → auto-hold, routed into the same review queue as Module 4 complaints |
| Trending | Recalculate trending score periodically from views/replies/saves |

## Module 6: Admin Panel
| Feature | What it means to build |
|---|---|
| Role cleanup | Confirm `counselor_admin` removed everywhere; access separation is Super Admin / Dept Admin only |
| Complaint dashboard (Higher Authority) | Escalated complaints only, plus full permanent `complaint_history` read access |
| Faculty Portal (separate view) | Faculty's own assigned-complaint queue, resource-approval queue, notice-board moderation queue — lives outside the Admin Panel proper |
| Mood analytics | Department-level aggregated trend graphs, Admin/Super Admin only |
| Broken-query fixes | Repair/rebuild `moderation_queue`, `notifications`, `trust_score_components` tables so admin queries stop failing |
| Moderation queue view | Unified view of everything the abuse-detection service flagged across chat, notice board, resources, and complaints |
| Leaderboard fix | Remove hard-coded client fallback data; show real data or an explicit empty state |

---

# PART C — Agent Build Prompts

## Prompt 0 — Foundation (run first, once)

```
You are working in the PeerBridge repository (server/: Node.js + Express + MySQL +
Socket.io; client/: React 18 + Vite + Tailwind). Read server/database_schema.sql,
server/database_migration.sql, and the existing route/controller structure before changing
anything.

Do the following foundational work before any of the six feature-module prompts:

1. ROLE CLEANUP (faculty role is KEPT — do not remove it)
   - Remove every reference to the `counselor_admin` role in client code — it has no
     backend/database equivalent. Do not replace it with anything; access separation is
     simply Super Admin and Dept Admin (both under a conceptual "Higher Authority" tier).
   - Remove the direct student↔faculty open chat/messaging path specifically — grep for
     any route, socket event, or UI screen that lets a student and a faculty member open a
     1:1 or ad-hoc chat, and remove it. Do NOT remove faculty broadcast/announcement
     features — those are one-way and must stay.
   - Confirm faculty retains: profile (department, designation, subjects, office hours),
     department broadcast, academic-support faculty trend dashboard (read-only).

2. DOMAIN CONFIG
   - Formalize single-university scope: registration restricted to a configurable email
     domain via an environment variable (`ALLOWED_EMAIL_DOMAIN`), validated at
     registration.

3. SOS REMOVAL
   - Delete the SOS button, SOS socket events, `sos_records` usage, SOS admin/faculty
     screens, and any cron/cleanup jobs tied to SOS. Confirm no remaining code path can
     trigger an emergency/crisis dispatch. Do NOT touch `mood_entries` — Mood Tracker is
     unaffected and handled separately.

4. SHARED ABUSE-DETECTION SERVICE
   - Build one shared service (e.g. `server/src/services/contentSafety.service.js`) that:
     a) checks text against a maintained multilingual profanity/abusive-word list (English
        + Roman Urdu at minimum), and
     b) runs sentiment/toxicity scoring using the existing TensorFlow.js toxicity model
        already in the stack (do not add a new paid external API).
   - Contract: `{ isFlagged: boolean, severity: 'low'|'medium'|'high', matchedTerms:
     string[], sentimentScore: number }`.
   - This will be imported by chat (Module 1), the complaint system (Module 4), and the
     notice board (Module 5). Build it once here.

Report back a summary of every file changed, and every table/column you propose to
add/drop, and wait for confirmation before running destructive migrations.
```

## Prompt 1 — Intelligent Peer Matching Engine

```
Context: matching/academic-support code already exists but has reliability issues, and the
old design referenced faculty-expertise-based matching and faculty chat escalation, both of
which are now out of scope for this engine.

Tasks:
1. Fix the chat request → accept/decline → conversation flow end to end (REST + Socket.io).
   Resolve any state where a match is created but no usable conversation results.
2. Resolve the `POST /api/communication/messages` REST stub vs Socket.io inconsistency:
   either implement it properly or remove client code paths calling it, and document
   Socket.io as the single supported send path.
3. Remove "Faculty expertise tags used during helper matching" — this engine is
   student-to-student only.
4. Keep "escalate to faculty trend view after 24h with no match" but implement it as a
   **read-only signal only**: the unmatched request appears as a flagged item on the
   existing faculty trend dashboard (Module: Academic Support Board). Do NOT attach any
   chat/contact/messaging action to this — faculty can see the pattern, not start a
   conversation from it.
5. Wire the shared abuse-detection service (Prompt 0) into every live chat message: hold
   high-severity messages, log medium-severity ones, never silently drop low-severity ones.
6. Verify trust-score filtering uses live data, not stale/fallback values.

Acceptance criteria: two students can post/request help, match, and chat reliably in real
time; faculty sees unmatched-request patterns on their dashboard with no chat entry point;
abusive messages are flagged automatically.
```

## Prompt 2 — Mood & Wellbeing Tracker

```
Context: `mood_entries` exists but is broken end to end (field mismatch, no mounted API, no
UI). Build this module fully, with no crisis-trigger logic of any kind.

Tasks:
1. Fix the `notes`/`note` field mismatch between service and schema.
2. Build and mount REST endpoints: submit check-in (5-level emoji + optional text), fetch
   own history, fetch own trend summary.
3. Run optional free-text through the shared abuse-detection service for profanity
   filtering only before storage — this must never trigger any notification to any role.
4. Build student UI: daily check-in widget, personal trend chart, gentle in-app reminder
   after N missed days.
5. Build an aggregated, fully anonymized department-level trend view in the Admin Panel,
   restricted to **Admin and Super Admin roles only** — add an explicit role check so
   Faculty cannot access this endpoint or screen under any condition.
6. Do not implement any "notify counselor/faculty on low mood" logic — this was
   intentionally removed.

Acceptance criteria: a student can log mood daily and see their own trend; only Admin/Super
Admin can see aggregated data; no individual mood data is ever exposed to Faculty or
triggers any alert to any user.
```

## Prompt 3 — Resource & Study Library

```
Context: build largely from scratch. Faculty approval workflow is retained here — this is
a review/approval action, not a chat feature, so it's unaffected by the chat restriction.

Tasks:
1. Data model: resources with title, description, subject/semester/category tags,
   uploader (anonymous ID), file or link, status (pending/approved/rejected/flagged),
   rating aggregate, bookmark relation.
2. Upload flow: basic file type/size validation, plus title/description run through the
   shared abuse-detection service.
3. Faculty review queue: pending resources approved/rejected by faculty for subject
   relevance/quality — this stays as originally scoped.
4. Student features: search/filter (subject/semester/category), rating & review, bookmarks.
5. Auto-flagging: resources below a rating threshold return to the review queue rather than
   being auto-deleted.

Acceptance criteria: a student uploads a resource, faculty approves/rejects it, and
approved resources are searchable/bookmarkable/rateable.
```

## Prompt 4 — Complaint & Escalation System

```
Context: replaces the old "Crisis SOS & Escalation" module entirely. No SOS button, no
severity classification, no emergency dispatch remains anywhere (verify Prompt 0 completed
this). This module lets students report problems with other students, reviewed first by
Faculty, escalated only when necessary to Higher Authority (Admin/Super Admin).

Data model:
1. `complaints`: id, reporter_anonymous_id, reported_against_anonymous_id (nullable),
   category, description, evidence_refs, status
   (open/under_review/escalated/resolved/rejected), current_level (1=Faculty,
   2=Higher Authority), assigned_faculty_id (nullable), created_at, resolved_at,
   resolution_notes.
2. `complaint_history`: append-only audit log of every status change/assignment/
   escalation — who, what, when. This table is **never auto-purged** and is fully
   readable **only by Admin/Super Admin (Higher Authority)** — this is the permanent
   "cluster head/manager" record required by the panel.
3. Categories: harassment, abusive_language, academic_dispute, privacy_violation,
   spam_or_scam, other (finalize wording against your SRS before locking).

Workflow:
1. New complaint → auto-assigned to an available Faculty reviewer (Level 1). A faculty
   member sees **only complaints assigned to them** — never a global queue.
2. Faculty can resolve directly, reject with a logged reason, or escalate to Level 2.
3. Higher Authority (Admin/Super Admin) sees **only escalated (Level 2) complaints** —
   never unescalated Level 1 items.
4. Every submission runs through the shared abuse-detection service (Prompt 0); high
   severity raises priority in the faculty queue but does NOT auto-escalate the level — a
   human decides that.
5. Reporter/reported-against identities stay pseudonymous by default; only Higher
   Authority can unmask via the existing identity-reveal pattern (justification +
   secondary approval).
6. Build the Faculty-facing queue as part of a **Faculty Portal view**, separate from the
   Admin Panel (which is Higher-Authority-only) — see Prompt 6 for the Admin Panel side.

Explicitly excluded: any emergency button, physical-threat category, countdown/
confirmation pattern, or automatic notification to real-world emergency services. Add a
static disclaimer directing genuine emergencies to real-world contacts.

Acceptance criteria: a student can file a complaint; it lands with exactly one faculty
reviewer; faculty can resolve or escalate; an escalated case becomes visible to Higher
Authority only; the full history is permanently queryable by Higher Authority only.
```

## Prompt 5 — Community Notice Board

```
Context: faculty verified announcements are retained (one-way, not chat). Focus this phase
on enforcing categories and wiring abuse detection.

Tasks:
1. Enforce a required category field at post creation: Study Groups / Lost & Found /
   Events / Announcements (confirm/add any others from your SRS), with UI filter
   tabs/dropdown.
2. Keep faculty/admin-authored announcements with an "Official" badge and push
   notification — this remains one-way broadcast, with no reply-chat to faculty attached.
3. Run every post through the shared abuse-detection service before publish: clean→live,
   medium→hold for review, high→reject with appeal option.
4. Keep and verify: sensitive-info blocking (phone/payment info), post expiry/reminder,
   3-reports→auto-hold, engagement reactions, trending recalculation.
5. Route reported posts (3+ reports) into the same review queue used by the Complaint
   system (Prompt 4) so faculty/moderators check one place, not two.

Acceptance criteria: every post has an enforced category, is scanned before publishing, and
reported posts flow into the shared review queue.
```

## Prompt 6 — Admin Panel

```
Context: rebuild the Higher-Authority-facing dashboard and fix known broken queries. Also
stand up a separate Faculty Portal view (referenced in Prompt 4) so faculty's own queues
don't live inside the Admin Panel.

Tasks:
1. Confirm `counselor_admin` is fully removed from client role guards; access separation
   is Super Admin / Dept Admin only.
2. Build the Higher-Authority Admin Panel view: escalated complaints only (Prompt 4), full
   read access to permanent `complaint_history`, aggregated anonymized mood trends
   (Prompt 2, Admin/Super Admin only), platform-wide usage stats, user management,
   identity-reveal approvals.
3. Build/confirm a separate Faculty Portal view containing: their assigned-complaints
   queue, resource-approval queue (Prompt 3), notice-board moderation queue (Prompt 5),
   and their existing academic-support trend dashboard — none of this is visible inside
   the Higher-Authority Admin Panel.
4. Fix known schema mismatches: `moderation_queue`, `notifications`,
   `trust_score_components` are queried but not created by startup SQL — create them
   properly or remove dead code paths, whichever this phase actually needs.
5. Remove every remaining SOS-related admin/faculty screen (verification pass).
6. Add a unified moderation queue view surfacing everything the shared abuse-detection
   service flagged across chat, notice board, resources, and complaints — filterable by
   source module and severity.
7. Fix the client leaderboard's hard-coded fallback data — show real data or an explicit
   empty/error state.

Acceptance criteria: Higher Authority sees only escalated items + full audit history;
Faculty sees only their own assigned items in a separate portal; no screen anywhere
references SOS or counselor_admin; all admin queries run against tables that exist.
```

---

# PART D — Agent Verification Prompts

Run these after the corresponding build prompt to get an honest self-report of what was
actually implemented, before you mark a module as done.

## Verification — Foundation (after Prompt 0)

```
Review your own changes from the foundation task and report, with file references:
1. Grep the entire repo (server + client) for "counselor_admin" and "SOS" (case-insensitive)
   — list every remaining match, if any, and explain why each one is either safe to leave
   or needs further removal.
2. Confirm the student↔faculty open chat path is fully removed — show the specific
   route(s)/socket event(s)/component(s) you deleted or disabled, and confirm faculty
   broadcast/announcement functionality was NOT touched.
3. Show the exact contract (input/output shape) of the shared abuse-detection service you
   built, and list every place it is currently imported.
4. List every database table/column you added, dropped, or renamed, with the reasoning for
   each, and confirm none of these changes were run against a live database without
   explicit confirmation.
5. State any assumption you made that wasn't explicitly specified, so it can be reviewed.
```

## Verification — Module 1: Peer Matching

```
1. Walk through the accept/decline flow end to end and confirm: what happens if a helper
   ignores a match request past the response window? Does the request correctly re-match?
2. Show the final decision on the REST vs Socket.io message-sending inconsistency — which
   path is used, and where is that documented in code?
3. Confirm "Faculty expertise tags" is fully removed from matching logic — show where it
   used to be referenced and that it's gone.
4. Show the exact UI/data flow for the 24h-unmatched signal on the faculty trend dashboard,
   and confirm there is no button, link, or action that opens any chat/contact with faculty
   from that screen.
5. Demonstrate (describe or show logs of) a message being flagged by the abuse-detection
   service and what happens to it (held vs logged vs delivered).
```

## Verification — Module 2: Mood Tracker

```
1. Confirm the `notes`/`note` mismatch is resolved — show the final column/field name used
   consistently in schema, service, and API.
2. Attempt to access the aggregated mood trend endpoint/screen as a Faculty-role account
   (describe the test) and confirm it is rejected/forbidden.
3. Confirm no code path sends a notification, email, or alert to any user based on mood
   entries, individually or in aggregate — grep for any leftover "notify" logic tied to
   mood_entries and report what you find.
4. Show the reminder logic (missed-days threshold) and confirm it's in-app only.
```

## Verification — Module 3: Resource Library

```
1. Walk through a resource from upload → pending → faculty approval/rejection → visible
   in search, and confirm each state transition works.
2. Confirm the abuse-detection service is actually invoked on title/description at upload
   time (not just written in a comment) — show the call site.
3. Confirm the low-rating auto-flag logic returns items to the review queue rather than
   deleting them.
```

## Verification — Module 4: Complaint & Escalation

```
1. File a test complaint and confirm it is visible to exactly one faculty account (the
   assigned one) and not to any other faculty account.
2. Escalate that complaint and confirm: it disappears from the general (unescalated)
   context and becomes visible to a Higher Authority account; confirm a non-escalated
   complaint is NOT visible to any Higher Authority account.
3. Show the `complaint_history` entries generated by this test end to end (assignment →
   escalation → resolution) and confirm the table is append-only / not purged by any
   cleanup job.
4. Confirm the abuse-detection service ran on submission and show what "high severity"
   actually changes in the UI (priority flag) versus what it does NOT change (it must not
   auto-escalate the level).
5. Confirm no SOS-era code, table, or UI element remains reachable from this module — grep
   and report.
6. Show the identity-reveal flow requires both a Higher Authority role and a
   justification + secondary approval step.
```

## Verification — Module 5: Notice Board

```
1. Attempt to create a post without selecting a category and confirm it's rejected/
   required at the API level, not just the UI.
2. Post something containing flagged/abusive language (test content) and confirm it is
   held for review rather than published immediately.
3. Confirm faculty-authored announcements show the "Official" badge and do not expose any
   reply-chat entry point to the faculty author.
4. Trigger the 3-reports auto-hold and confirm the reported post appears in the same
   review queue used by the Complaint system, not a separate one.
```

## Verification — Module 6: Admin Panel

```
1. Log in as a Faculty account and confirm the Admin Panel (Higher-Authority) screens are
   not accessible; confirm the separate Faculty Portal shows only their assigned items.
2. Log in as Admin/Super Admin and confirm only escalated complaints appear, plus full
   `complaint_history` read access.
3. Exercise each previously-broken query path (`moderation_queue`, `notifications`,
   `trust_score_components`) and confirm it now returns real data or was cleanly removed —
   report which of the two you did for each.
4. Confirm the leaderboard no longer shows hard-coded fallback data — show what it displays
   when there is genuinely no data yet.
5. Grep the Admin Panel codebase for any remaining SOS reference and report the result.
```
