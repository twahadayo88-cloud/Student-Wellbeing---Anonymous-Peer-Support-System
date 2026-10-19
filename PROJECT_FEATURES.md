# PeerBridge Project Feature Guide

## 1. Project overview

PeerBridge is a student wellbeing and anonymous peer-support web application. It combines:

- A React single-page web client.
- An Express REST API and Socket.IO real-time server.
- A MySQL persistence layer with schema and migration scripts.
- A separate FastAPI service for text classification used by content-safety checks.

The implemented product brings together student-to-student academic help, opt-in chat, wellbeing check-ins, study resources, campus notices, complaints, trust features, and role-based administration.

## 2. Roles and access

The code uses four primary roles:

| Role | Main capabilities represented in the application |
|---|---|
| Student | Use peer support, chat, mood tracking, complaints, resources, notices, and profile features. |
| Faculty | Review assigned complaints and submitted resources; view academic trends; publish department announcements; use faculty-facing dashboards. |
| Admin | Administrative dashboards, user and moderation operations, escalated complaints, and aggregated wellbeing information. |
| Super Admin | Higher-authority administrative operations, including complaint audit/reveal workflows. |

The client protects role-specific routes, and backend route handlers also apply role checks. Public registration assigns student/faculty based on email text (`faculty` or `staff` indicates faculty); admin roles are not granted through those public email patterns.

## 3. Feature modules

### 3.1 Authentication and account access

- Registration and login.
- Password hashing and verification.
- JWT-based authenticated requests and logout/token invalidation.
- Account lockout after repeated failed login attempts.
- Forgot-password, one-time verification code (OTP), and password reset flows.
- Rate limits are applied to authentication and API traffic.
- User roles control access to protected pages and API actions.

**Client screens:** Landing, Register, Login, Forgot Password, Verify OTP, Reset Password.

### 3.2 Profile, onboarding, and privacy

- View and update the current user's profile.
- Public profile lookup by anonymous identifier.
- Generated anonymous display IDs separate everyday public identity from the account email.
- First-use onboarding completion for students.
- Consent preferences can be updated.
- Request account deletion and cancel a pending deletion.
- Profile fields support student information and faculty details such as department/subjects.

**Client screen/components:** Profile, Onboarding modal, profile/dashboard identity displays.

### 3.3 Dashboard and home experience

- Role-aware dashboard entry point.
- Student dashboard data includes active conversations, pending chat requests, recommended peers, anonymous ID, and trust badge information.
- Student onboarding can be prompted from the dashboard.
- Faculty dashboard surfaces faculty-specific activity/trend components.
- Chat request center provides a place to review incoming and outgoing requests.
- Theme context supports switching between light and dark presentation.

**Client screen/components:** Dashboard, FacultyDashboard, ChatRequestsCenter, Sidebar, Navbar, PageHeader, Footer, PageWrapper.

### 3.4 Academic Support Board

- Students can create structured academic-help requests with subject, title, description, and urgency.
- Requests can be browsed, filtered, opened for detail, and tracked through statuses such as open, matched, in progress, resolved, and closed.
- Students can register as helpers and manage helper availability.
- Requests can be appealed when moderation rejects them.
- Admins have an approval/rejection queue for academic requests.
- Faculty can view academic trend information, including request patterns and unmatched-request signals.
- Posting/request activity is subject to moderation and configured posting limits.
- Reusable UI pieces cover request creation, request cards, request detail, and faculty trends.

**Client screen/components:** Academic Board, Post Request modal, Request Card, Request Detail modal, Faculty Trends.

### 3.5 Intelligent peer matching

- The authenticated `GET /api/match/recommendations` endpoint ranks up to 10 other students. Candidates are filtered to students who are not the requester and are not scheduled for deletion.
- Scoring compares subject overlap, semester proximity, trust score, and recent activity. Default weights are 40/25/20/15 respectively and can be changed with `MATCH_WEIGHT_SUBJECT`, `MATCH_WEIGHT_SEMESTER`, `MATCH_WEIGHT_TRUST`, and `MATCH_WEIGHT_ACTIVITY`.
- Recent activity is a proxy based on the later of profile update time and chat-message activity: activity within 1, 7, 30, and 90 days receives progressively lower scores.
- Helper listings require student role, a matching subject, available status, unused help capacity, and at least the configured minimum trust score (`MATCH_MIN_TRUST_SCORE`, default 30). The listing response includes the anonymous ID and matching-related profile fields, but omits internal account/listing IDs.
- An academic help offer is sent to one eligible helper at a time. The helper has 15 minutes to accept or decline; a once-per-minute background job expires unanswered offers. Declines/timeouts exclude that helper and offer to the next-best eligible helper. The cascade is capped by `MATCH_MAX_OFFER_ATTEMPTS` (default 5); if no candidate remains, the request stays open.
- Acceptance moves the request to in-progress and opens the consent-based chat. Resolving a request stores a 1-to-5 helper rating, which affects that helper's later matching score by a capped adjustment (`MATCH_FEEDBACK_MAX`, default 5 percentage points). Feedback is a ranking signal, not model retraining.
- Faculty can see department-scoped counts and a read-only list of clean requests that remain open for more than 24 hours. This is a passive trend signal: it does not notify faculty, reveal a student's identity, or provide a contact/chat action.
- Recommendation results, candidate helper-list results, and academic-offer events use anonymous IDs rather than email or display names. Candidate helper-list responses omit internal account/listing IDs; internal account IDs remain server-side for authorization, persistence, and matching.

The matching API is mounted under `/api/match`; academic request lifecycle and helper management are exposed under `/api/academic`.

### Manual verification: Intelligent Peer Matching Engine

Use a development database and test accounts only. These checks exercise the matching paths without waiting 24 hours or 15 minutes in real time.

#### Preparation

1. Start MySQL, the API (`npm run dev:server` from the repository root), the client (`npm run dev:client`), and the AI service if moderation is enabled for academic posts.
2. Create three student accounts: one requester and at least two helpers. Create a faculty account in the same department as the requester.
3. Set the test profiles to known matching data. For example, after replacing the email addresses and values with your test data:

   ```sql
   UPDATE profiles p
   JOIN users u ON u.id = p.user_id
   SET p.subjects = JSON_ARRAY('Computer Science', 'Mathematics'),
       p.semester = 3,
       p.trust_score = 80,
       p.department = 'Computer Science'
   WHERE u.email IN (
     'requester@example.test',
     'helper-one@example.test',
     'helper-two@example.test',
     'faculty@example.test'
   );
   ```

4. Register both helper accounts with the helper feature/API for `Computer Science`, and ensure both listings are available and have help capacity. Use at least one helper with a trust score below the configured minimum as a negative test.
5. Authenticate in separate browser sessions (or use each account's own token) so requester, helpers, and faculty can act as the correct role.

#### Checks

1. **Recommendation ranking:** As the requester, open the dashboard and check recommended peers, or call `GET /api/match/recommendations`. Confirm matching-subject, nearby-semester, trusted, recently active students rank ahead of less relevant candidates. Confirm the requester is not listed and the result is capped at 10.
2. **Trust and eligibility filters:** Call `GET /api/academic/helpers?subject=Computer%20Science`. Confirm helpers below `MATCH_MIN_TRUST_SCORE`, unavailable helpers, full-capacity helpers, non-students, and the requester are absent. Confirm returned candidates have anonymous IDs and no `id`, `user_id`, or email fields.
3. **Weighted score behavior:** In a development environment, change a matching weight (for example, temporarily increase the subject weight) and restart the API. Compare recommendation ordering for controlled profiles, then restore the default weights. Confirm subject, semester, trust, and activity each affect ordering; no single feedback rating should overwhelm the normalized base score.
4. **Offer and acceptance:** As a helper, choose an open matching request and offer help. Confirm the requester sees the request update, the intended helper receives a pending chat request, and the request expires at a time about 15 minutes after creation. Accept it as the helper; confirm the academic request moves to `in_progress` and the chat becomes available.
5. **Decline and ranked cascade:** Create a fresh request with at least two eligible helpers. Decline the first offer. Confirm that helper is excluded and the next eligible helper receives the offer; the same helper should not receive the same request again.
6. **Timeout and cascade:** For a test offer only, set its `chat_requests.expires_at` to a past time in the database. Wait for the once-per-minute expiry job. Confirm the offer is marked expired, the timed-out helper is excluded, and the next candidate receives an offer. Do not edit production data.
7. **Attempt limit/no candidate:** Temporarily make all remaining helpers unavailable or below the trust threshold (or exhaust `MATCH_MAX_OFFER_ATTEMPTS` with test offers). Confirm the academic request returns/remains open rather than being assigned to an ineligible helper.
8. **Feedback loop:** Resolve a matched test request with a rating from 1 to 5. Confirm a `helper_feedback` record is stored for the resolved request. On a later test request, inspect candidate ordering and confirm the capped feedback adjustment can influence rank while subject/semester/trust/activity still contribute.
9. **24-hour faculty signal:** As faculty, open the Academic Board trends. In a test database, age a clean, still-open request by setting its `created_at` to more than 24 hours ago. Refresh trends and confirm it appears in the unmatched count/list for the requester's department. Confirm the view shows request details such as subject/urgency/wait time but no reporter identity and offers no contact/chat action. Restore or remove the test data afterward.
10. **Anonymous identity check:** Inspect the responses to the recommendation and candidate-helper endpoints and the `chat_request:new` event in browser developer tools. Confirm they contain pseudonymous IDs and necessary matching context, but no email, real name, or internal user ID.

For the manual checks requiring multiple accounts, use private/incognito browser windows or separate browsers so each session remains authenticated as the intended role.

### 3.6 Chat and communication

- Students can request a chat and the recipient can accept or decline.
- Pending requests are available through the chat request API.
- Authenticated users exchange messages through Socket.IO in real time.
- Conversation/message history is available through communication endpoints.
- Chat UI includes connection state, message display, and message seen/read events.
- Typing and other live chat events are handled through the Socket.IO layer.
- Users can block or report another user and flag messages.
- Faculty/administrative department broadcasts are separate from direct student chat.
- The REST `POST /api/communication/messages` handler is not the normal send path; the code directs chat sending through Socket.IO.

**Client screen/components:** Chat, ChatBox, Chat Request modal, dashboard chat-request center.

### 3.7 Mood and wellbeing tracker

- Mood tracking is opt-in through the Mood Tracker page. Turning consent off deletes that student's active mood rows; the API also rejects personal mood operations without consent.
- A consenting student can submit one five-level emoji check-in per day, with an optional note of up to 500 characters. A database advisory lock prevents simultaneous requests from creating multiple same-day entries.
- Notes are checked and matching profanity terms are masked before storage.
- The mood table stores a keyed HMAC pseudonymous subject token and department snapshot instead of a direct account `user_id`. The server derives the token from the authenticated account and a stable secret, which allows that student to read their own history and receive mood-based recommendations.
- This is pseudonymous rather than absolute anonymity: the application can associate the account with its keyed token. Keep `MOOD_DATA_SECRET` stable (or keep `JWT_SECRET` stable when using the fallback); rotating it makes existing mood rows unavailable to the affected user.
- Students can view their own mood history and seven-day trend. Consecutive entries with scores of 1 or 2 are counted as a personal pattern; a score of 3 or above resets the count. The insight is shown only to the student and does not trigger alerts or emergency workflows.
- Missed-check-in reminders are gentle, in-app prompts after two missed calendar days. No push, SMS, or email reminder is sent.
- Low mood scores rank wellbeing/wellness resources earlier in the student's library recommendations. This is a ranking preference, not an exclusive filter. If the student has not consented, their mood is not read and recommendations use the neutral default.
- Only admin and super-admin roles can call the aggregated trend endpoint; faculty are excluded. Department/day results with fewer than five distinct participants are suppressed. This is small-group suppression, not differential privacy.
- Withdrawing consent deletes the current pseudonymous mood rows. Scheduled account deletion also removes them. Existing historical database backups created before the pseudonymization migration may still contain legacy mood identifiers and require separate retention handling.

**Client screen:** Mood Tracker.

#### Manual verification: Mood and Wellbeing Tracker

Use a development database and test accounts. The steps below check the student interface, API restrictions, storage shape, recommendations, and aggregate privacy. Do not edit production mood data to simulate dates.

##### Preparation

1. Start MySQL, the API (`npm run dev:server` from the repository root), and the client (`npm run dev:client`).
2. Ensure the API environment has a stable `MOOD_DATA_SECRET`. If unset, it falls back to `JWT_SECRET`; do not rotate the selected key after mood entries have been created.
3. Create one student account, one faculty account, and one admin account. Set a department on the student profile and the faculty profile. Sign in as each account in a separate browser session.
4. Confirm the migration has run. In MySQL, check that `mood_entries` has `mood_subject_id`, `department`, `mood_score`, `notes`, `consecutive_low_count`, and `created_at`, and no `user_id` column:

   ```sql
   SHOW COLUMNS FROM mood_entries;
   ```

##### Checks

1. **Consent is optional and enforced:** As the student with mood consent off, open `/mood`. Confirm no mood data is loaded and the page explains pseudonymous storage, personal features, and the opt-in. Attempt `POST /api/mood` and `GET /api/mood/history` with that student's token; both should return `403`.
2. **Enable consent:** Click the opt-in button. Confirm the setting is saved, the check-in controls become available, and `GET /api/profile/me` reports `consent_mood_tracking: true`.
3. **Five emoji levels:** Confirm the page displays five distinct selectable emoji/labels. Select one and submit; confirm the saved API response succeeds and the score is in the 1–5 range.
4. **One check-in per calendar day:** Submit a second check-in that day. Confirm the existing entry is returned as already submitted and no second row is added. Verify the same via the UI's checked-in state.
5. **Optional note and moderation:** Submit another day's test check-in with no note and confirm it is accepted. On a separate eligible test day, submit a note containing a term in the configured moderation vocabulary; inspect only the test row and confirm the matching term is masked, not stored verbatim.
6. **Pseudonymous storage and personal access:** After a check-in, confirm rows in `mood_entries` have a 64-character `mood_subject_id` and no direct `user_id` column. Call history with the student's token and confirm only that student's entries are returned; repeat as another student and confirm the first student's history is not returned.
7. **Trend/history:** Create several test check-ins on different test dates (in an isolated development database) and open the page. Confirm the chart shows daily averages for the most recent seven days and history returns no more than the requested date range.
8. **Gentle missed-check-in nudge:** In a development database, set the test student's last `mood_entries.created_at` to at least two calendar days ago. Reload `/mood`; confirm an in-app nudge appears. Submit today's check-in and confirm the nudge clears. No push/email service is expected.
9. **Consecutive-low pattern:** Submit scores of 1 or 2 on consecutive test check-in days. Confirm the count increases and the personal insight appears at three low entries. Submit a score of 3 or higher on a later test day and confirm the count resets. Confirm no faculty/admin notification is generated.
10. **Resource personalization:** As a consenting student, create or locate approved resources in `wellbeing` and non-wellbeing categories. With the latest score at 1 or 2, call `GET /api/resources/recommendations` and confirm wellbeing items are prioritized, not the only items returned. Set the latest score to 3 or higher on a test day and confirm the special wellbeing priority no longer applies. Withdraw consent and confirm recommendations use the neutral default without reading that student's mood row.
11. **Admin-only aggregation and group suppression:** With fewer than five consenting students with check-ins for a given department/day, call `GET /api/mood/aggregated` as admin and confirm that group/date is absent. Add test check-ins for at least five distinct students in that same department/day; confirm admin sees only date, department, averages, counts, and no per-student tokens or entries. Call the same route as faculty and confirm `403`.
12. **Withdraw consent and erase:** As the student, click “Withdraw consent and delete my mood data” and confirm the prompt. Verify consent becomes false, the active mood rows for that pseudonymous subject are deleted, personal history/trends/reminders are no longer available, and resource recommendations stop using the mood score. Re-enable consent and verify the student starts with no prior history.
13. **Account deletion cleanup:** In the development database only, schedule a test account for deletion and allow the account-maintenance job to run after its scheduled time. Confirm its pseudonymous mood rows are removed along with the account.

Restore or remove any modified test dates/records after verification. Historical backups made before migration are separate from the active database and may retain old mood identifiers.

### 3.8 Resource and study library

- Students can browse and search study resources.
- Filters include subject, semester, category, and text search.
- Students can submit resources using a file or a link, with metadata such as title, description, subject, and category.
- Upload validation checks supported file types/signatures and size limits.
- Submitted resources may be held or flagged for safety/review.
- Faculty have a pending-review queue and assess subject relevance and resource quality on 1-5 scales before approving or rejecting. Rejections require a reason; the faculty decision is not automatically blocked by the scores.
- Students can add/remove bookmarks and view their saved resources.
- Students can rate and review resources; repeat reviews are constrained by the user/resource relationship.
- Any approved resource whose average student rating falls below 1.5 is automatically flagged and returned to the faculty queue.
- The For You list uses a transparent scoring algorithm based on a student's profile subjects and semester, past high ratings, resource engagement, and mood-related categories when mood tracking is consented to. Mood context is obtained through the Mood Tracker module interface.
- This recommendation scorer is local and rule-based, not an AI/ML recommendation model. The separate AI service in this project is for text moderation, not resource recommendations.

**Client screen/components:** Resource Library.

#### Manual verification: Resource and Study Library additions

Use a development database and test accounts. The steps below cover low-rating thresholds, faculty assessment, mood consent, and personalized ordering. Do not use production data.

##### Preparation

1. Start MySQL, the API (`npm run dev:server` from the repository root), and the client (`npm run dev:client`).
2. Create one uploader student, two reviewer students, a faculty account, and two recommendation test students. Use separate browser sessions for each account.
3. Have the uploader submit resources and have faculty approve them before student rating or recommendation tests. Include test resources in the same subject/semester with different categories (for example, Wellbeing and Practice), plus at least one resource for a different subject and semester.
4. Set each recommendation student's profile subjects and semester to match some—but not all—of the test resources. For mood tests, enable mood-tracking consent for those students.

##### Automatic low-rating flag

1. As a student, open an approved resource and submit a 1-star rating. Refresh the resource list and confirm its status changes to `flagged` and it no longer appears in the approved browse list.
2. As faculty, open the Resource Library approval queue. Confirm the resource appears with the reason “Average rating below 1.5; returned to faculty review queue.”
3. Verify the strict threshold: use a second approved resource and have reviewer one give it 1 star and reviewer two give it 2 stars. Its average is exactly 1.5, so it should remain approved. Have reviewer two update their rating to 1 star; the average becomes 1.0 and the resource should then be flagged.
4. Confirm each student can update their existing rating and that the average uses the latest rating rather than counting repeat submissions as extra reviews.

##### Faculty relevance and quality workflow

1. As a student, upload two pending resources with clear subject and semester information. Confirm neither is visible in student Browse before faculty approval.
2. As faculty, open the Approval Queue. For each resource, assess the displayed title, description, subject, semester, category, and file/link. Select both Subject relevance and Resource quality scores from 1 to 5.
3. Approve one resource. Confirm it appears in student Browse and the uploader's My Uploads view shows the saved assessment scores.
4. Reject the other resource with a reason of at least five characters. Confirm it remains unavailable in Browse and the uploader's My Uploads view shows its rejected status, assessment scores, and review note.
5. Try to review a resource without selecting both scores. The page must prevent the action; a direct `PATCH /api/resources/:id/approval` request missing either score should return a validation error. Try rejecting with no reason or a too-short reason and confirm rejection is refused.

##### Mood-personalized recommendations

1. As a consenting recommendation student, submit a low mood check-in (score 1 or 2) in Mood Tracker. Call `GET /api/mood/recommendation-context` with that student's token and confirm the response contains `consented: true` and their latest `mood_score`, without notes or identity fields.
2. Open Resource Library > For You. Confirm resources matching the student's profile subject and semester rank above otherwise comparable unmatched resources, and wellbeing resources receive a boost for a low mood.
3. As a second student with the same profile preferences but a high mood check-in (score 4 or 5), call the same Mood Tracker endpoint and view For You. Confirm study/practice resources receive the positive-mood category preference instead of the low-mood wellbeing boost.
4. Withdraw mood consent for one student. Confirm the context endpoint returns `consented: false` and `mood_score: null`, and that For You still loads using profile and resource feedback signals without using their mood.
5. Give a recommendation student a 4- or 5-star rating on one approved resource, refresh For You, and confirm personal positive feedback contributes to that resource's ranking. Verify that mood is used only when consent is enabled.
6. Treat these checks as verification of the implemented local scoring and Mood Tracker module integration—not an AI model call. The current AI service handles text moderation and does not generate resource recommendations.

### 3.9 Community notice board and announcements

- Users can create and browse notice posts in categories including study groups, lost and found, and events.
- Search and category filters are supported; posts can include location fields and optional coordinates for nearby filtering.
- Posts expire after a configured period; owners can request an extension and submit an appeal where offered.
- Students can report posts, react to posts, and save posts.
- Notice text is checked for prohibited phone-number/payment-request content and passed through content-safety moderation.
- Flagged/rejected posts can be routed to moderation.
- Faculty and higher-authority roles can publish department-scoped official announcements; these are distinct from community posts and can notify department students.
- Faculty have a review queue for posts.

**Client screens:** Notice Board and Announcements.

### 3.10 Complaints and escalation

- Students can submit complaints against another student using fixed categories (harassment, abusive language, academic dispute, privacy violation, spam/scam, or other).
- Complaint text is checked by shared content-safety logic; a flag can raise priority but does not itself escalate the complaint.
- New complaints are assigned to an available faculty reviewer; faculty views are scoped to complaints assigned to that reviewer.
- Students can view the status of their own submissions.
- Faculty can review at Level 1 and escalate cases.
- Admin/super-admin views focus on escalated Level 2 complaints and can resolve them.
- Higher-authority audit trails record complaint events.
- Identity-reveal operations have a request/approval flow with a justification and an additional approval step.
- The complaint flow is a reporting and review workflow, not an emergency/SOS response system.

**Client screens:** Complaints and Complaint Review.

### 3.11 Trust, reputation, and feedback

- Authenticated users can view the trust leaderboard and their badge.
- Badge tiers are represented as Bronze, Silver, Gold, and Platinum.
- Feedback/rating is collected through the feedback API and can inform helper reputation/matching.
- Administrative routes support trust-history and moderation-related management.
- Academic support resolutions and helper feedback contribute to the reputation/matching model where configured.

**Client screen/components:** Leaderboard, BadgeDisplay.

### 3.12 Administration and moderation operations

- Dashboard statistics and user listing/management.
- Role updates and account unlocking.
- Review of violations and audit-log entries.
- Review of appeals and policy-review records.
- Create, update, and delete custom moderation rules.
- Repeat-offender and security-signal views.
- Academic request review queue.
- Complaint escalation, resolution, audit, and identity-reveal approval workflows.
- Moderation queue actions include approval, rejection, and escalation in the safety module.

**Client screen:** Admin Panel.

### 3.13 Shared content safety

- A shared backend content-safety service checks a built-in vocabulary that includes English and Roman Urdu abuse/threat terms.
- Admin-configurable moderation terms can be cached and incorporated.
- Content may be given low, medium, or high severity; callers can hold, reject, mask, or route content according to their own workflow.
- The optional AI call uses the separate local model service when a caller explicitly enables it.
- The service can continue with keyword checks if the AI service is unavailable.
- Safety checks are used by areas such as chat, academic content, complaints, mood notes, resources, and notices where connected.

### 3.14 AI text-classification service

- Separate FastAPI application exposes `/`, `/health`, and `/predict`.
- Requests are validated to contain non-empty text; preprocessing lowercases text, removes URLs and mentions, reduces repeated characters, and normalizes whitespace.
- A TF-IDF vectorizer and trained SGD classifier return a category, flag status, confidence, academic probability, and abusive/off-topic probability.
- The configured threshold is `0.70`; the classifier's label meaning is academic/study-appropriate versus off-topic/abusive content, not a general mental-health diagnosis.
- Training script combines the processed training CSV, when present, with generated academic and off-topic examples, then saves the model and vectorizer artifacts.

### 3.15 Background jobs, database, and shared infrastructure

- MySQL connection/configuration and database health-check utilities.
- SQL schema, migration scripts, migration runner, and a super-admin seed utility.
- Socket.IO configuration for authenticated real-time events.
- Scheduled cleanup/maintenance logic for items such as expired offers, chats, deletion lifecycle, and anonymous identity rotation.
- Request logging, application logging, error handling, not-found handling, and API rate limiting.
- Security middleware includes Helmet and configured CORS.

## 4. Client page inventory

| Page | Purpose |
|---|---|
| Landing | Public introduction and entry into registration/login. |
| Register / Login | Create an account or authenticate. |
| Forgot Password / Verify OTP / Reset Password | Password-recovery flow. |
| Dashboard | Role-aware home, peer recommendations, requests, and chat entry. |
| Profile | View/update personal profile and preferences. |
| Chat | Student chat experience. |
| Academic Board | Browse/manage academic help requests. |
| Mood Tracker | Daily check-in and personal trend/history. |
| Complaints | Submit and track own complaints. |
| Complaint Review | Faculty/admin complaint review workflows. |
| Resource Library | Browse, upload, review, and save study resources. |
| Notice Board | Community notices and interactions. |
| Announcements | Department announcement feed. |
| Leaderboard | Trust/reputation rankings and badge information. |
| Admin Panel | Administrative user, moderation, and operational views. |
| 404 route | Fallback for unrecognized routes. |

## 5. Main API surface

The Express app mounts these feature prefixes:

| Prefix | Feature area |
|---|---|
| `/api/health` | API health response. |
| `/api/auth` | Registration, login, logout, and password recovery. |
| `/api/profile` | Profile, onboarding, consent, and account deletion. |
| `/api/communication` | Conversations, message history, reporting/blocking, and broadcasts. |
| `/api/chat` | Chat-request creation, response, and pending requests. |
| `/api/match` | Peer recommendations. |
| `/api/academic` | Academic requests, helpers, trends, appeals, and review. |
| `/api/mood` | Mood check-ins, personal trends/reminders, and admin aggregates. |
| `/api/resources` | Resource listing, submission, review, bookmarks, and ratings. |
| `/api/notices` | Community posts, announcements, reporting, reactions, saves, and review. |
| `/api/complaints` | Student complaints and faculty/admin escalation workflow. |
| `/api/trust` | Leaderboard and badge. |
| `/api/admin` | Administrative and moderation operations. |
| `/api/feedback` | Feedback submission. |

The safety module has route definitions in source, but those routes are not separately mounted by `server/src/app.js`; safety functionality exposed through the mounted application should therefore be understood through the mounted admin routes and shared service integrations.

## 6. Technologies

- **Client:** React 18, Vite, React Router, Axios, Tailwind CSS, Framer Motion, Recharts, Lucide icons, React Hot Toast, Socket.IO Client.
- **API/realtime server:** Node.js, Express, Socket.IO, MySQL (`mysql2`), JWT, bcryptjs, Helmet, express-rate-limit, Nodemailer, Winston, node-cron.
- **AI service:** Python, FastAPI, Pydantic, scikit-learn, pandas, NumPy, SciPy, and joblib.
- **Database:** MySQL with SQL schema/migrations and relational tables for users/profiles, requests, chat, moderation, complaints, resources, notices, mood, trust, and audit data.

## 7. Scope notes

- This guide describes the source currently present in the repository, not every feature discussed in planning documents.
- Some modules/routes have implementation files but may need integration or deployment configuration before they are available end to end (notably the separate safety router).
- The AI service must be running and its model artifacts must be available for AI-based text classification; keyword/custom-rule checks are separate.
- Email delivery, database connectivity, uploads, and external access depend on environment configuration and operational setup.
- This project is a peer-support and wellbeing tool; the documented complaint and moderation workflows should not be mistaken for professional counseling or emergency response.
