# PeerBridge — Student Wellbeing & Anonymous Peer Support Platform

**PeerBridge** is a secure, anonymous-first, multi-university platform designed to empower students to seek and provide peer support for mental wellbeing and academic growth. The repository contains a working foundation for authentication, profiles, academic requests, consent-based communication, trust scoring, administration, and Socket.io messaging. Some broader wellbeing, moderation, and database capabilities remain planned or need integration hardening; the implementation status below is the source of truth.

---

## 📋 Table of Contents

- [Key Objectives & Design Philosophy](#-key-objectives--design-philosophy)
- [Implementation Status](#-implementation-status)
- [Architecture Overview](#-architecture-overview)
- [Comprehensive Feature Coverage](#-comprehensive-feature-coverage)
- [Database Schema & Data Model](#-database-schema--data-model)
- [API Route Reference](#-api-route-reference)
- [Tech Stack & Dependencies](#-tech-stack--dependencies)
- [Quick Start & Local Setup](#-quick-start--local-setup)
- [Environment Configuration](#-environment-configuration)
- [Available Scripts](#-available-scripts)
- [Known Issues & Next Steps](#-known-issues--next-steps)

---

## 🎯 Key Objectives & Design Philosophy

- **Anonymous-First Security**: Public activity uses pseudonymous identifiers such as `Peer_XXXXX`; the current implementation still requires a database mapping between the account and pseudonym.
- **Privacy by Design**: Consent fields, audit logging, token invalidation, and scheduled account deletion are represented in the backend.
- **Safety & Proactive Intervention**: A Socket.io SOS path and local content checks exist, but the REST safety workflow and reliable SOS persistence are not complete.
- **Peer Empowerment & Trust Gamification**: Trust history, badges, leaderboard endpoints, feedback, and admin overrides exist; the client leaderboard is not fully connected to live data.
- **Consensual Peer Communication**: Chat request, accept/decline, block/report, and Socket.io conversation flows are present. Direct HTTP message sending is intentionally a rejecting stub.

---

## 🚧 Implementation Status

This audit compares the README claims with the files currently in `server/` and `client/`. Roughly **55% of the documented product scope is implemented in source**, but less is reliably runnable end to end because the startup schema and several service queries disagree.

| Area | Status | Current reality |
| :--- | :---: | :--- |
| Authentication, JWT, OTP, logout | ✅ | Register, login, logout, password reset, OTP verification, lockout, and blacklist code exist. Email delivery falls back to development logging when SMTP is unset. |
| Anonymous identity, consent, GDPR deletion | 🟡 | Pseudonyms, profile consent, deletion scheduling, cancellation, and cleanup jobs exist; identity history and deletion dependencies are incomplete. |
| RBAC | 🟡 | Student, faculty, admin, and super-admin checks exist. The client also references `counselor_admin`, which is not a database role. |
| Academic support board and helper matching | ✅ | Requests, helpers, availability, matching recommendations, appeals, trends, and admin review exist. Features a robust 1-minute offer cascade engine and bounded feedback loop adjustments for helper matching. |
| Trust, badges, feedback, leaderboard | 🟡 | Backend services and routes exist, but trust recalculation expects a missing table and the client leaderboard contains fallback/mock rows. |
| Consent-based chat and real-time messaging | 🟡 | Socket.io chat, presence-related handlers, typing/read events, requests, blocks, reports, and broadcasts exist. REST message sending is a stub. |
| SOS emergency response | 🟡 | The SOS button and socket dispatch exist, but SOS inserts/selects use column and enum names that do not match the migration schema. |
| AI moderation | 🟡 | Keyword/regex and TensorFlow toxicity checks exist. Gemini and Perspective are local wrappers, not configured external API integrations; moderation queue tables are not in startup SQL. |
| Mood tracking and wellbeing analytics | ❌ | A service helper and table definition exist, but no mounted mood API or user-facing mood page exists, and the service uses `notes` while SQL defines `note`. |
| Admin and moderation panel | 🟡 | Admin UI, stats, user management, SOS, audit, moderation, escalation, and trust screens exist, but route names differ from the original README and some queries depend on missing tables/columns. |
| Automated maintenance | 🟡 | Cron jobs cover deletion, chat expiration, wellness tasks, identity rotation, academic cleanup, and trust updates. OTP cleanup and several referenced legacy tables are absent. |

---

## 🏗️ Architecture Overview

```
                          ┌───────────────────────────┐
                          │   React 18 + Vite Client  │
                          │ Tailwind, Framer Motion,  │
                          │ Recharts, Socket.io       │
                          └─────────────┬─────────────┘
                                        │ HTTP REST / WebSockets
                                        ▼
                          ┌───────────────────────────┐
                          │   Node.js / Express API   │
                          └──────┬──────────────┬─────┘
                                 │              │
                         ┌───────▼──────┐ ┌─────▼────────────┐
                         │ MySQL / SQL  │ │ Socket.io + Cron │
                         │ migrations   │ │ real-time/jobs   │
                         └──────────────┘ └──────────────────┘
```

The application is split into two workspaces:
- **`server/`**: Express REST API, MySQL connection pool, Socket.io handlers, feature modules, and cron jobs.
- **`client/`**: Vite React single-page application using Context API, Tailwind CSS, Framer Motion, Recharts, and Axios.

---

## 🌟 Comprehensive Feature Coverage

### 1. Anonymous Identity & Privacy Engineering (🟡 Partial)
- Registration creates an anonymous profile identifier and profile/public lookup code exists.
- Consent update, onboarding, deletion scheduling, deletion cancellation, JWT blacklist, and audit logging code exist.
- The startup migration creates `anonymous_id_map`, but identity-history support is separate and not included in the startup migration.

### 2. Multi-Role Access Control (🟡 Partial)
- Backend role middleware supports `student`, `faculty`, `admin`, and `super_admin`.
- Admin and faculty route restrictions are present.
- `counselor_admin` appears in client route guards but is not in the SQL role enum and has no complete backend role flow.

### 3. Academic Support Board & Peer Matching (🟡 Partial)
- Requests, request lists/details/status/close, helper registration, helper availability, recommendations, faculty fallback, appeals, trends, and admin approve/reject code exist.
- The client includes academic board, request cards, posting, details, and faculty trends components.
- Initiating a chat and resolving/rating a request are not the README REST endpoints; these flows are handled through existing controllers/services and Socket.io paths, with no matching README route contract.

### 4. Dynamic Trust, Reputation & Gamification (🟡 Partial)
- Trust score changes, history, badges, feedback, leaderboard service, and admin override/reset routes exist.
- The backend references `trust_score_components`, which is not created by the startup SQL.
- `Leaderboard.jsx` has a hard-coded fallback dataset, so live leaderboard behavior is not guaranteed.

### 5. Real-Time Messaging & Consent-Based Chat (🟡 Partial)
- Socket.io handlers cover chat messages, typing/read events, requests, blocks, reports, broadcasts, and several chat modes.
- REST chat request routes are available under `/api/chat`.
- `POST /api/communication/messages` is a documented compatibility stub — it always returns HTTP 400 directing the client to use Socket.io. All chat messages **must** be sent through the authenticated Socket.io `send_message` event. No client code calls this REST endpoint.

### 6. Crisis SOS Emergency Response (🟡 Partial, currently broken)
- `SOSButton.jsx` emits a Socket.io SOS event and the server has dispatch/assignment-oriented handlers.
- The migration uses `student_id`, `category` values `self-harm|harassment|medical|other`, and uppercase severities. Socket/service code uses incompatible names such as `user_id`, `trigger_reason`, `mental_health`, and lowercase `high` in places, so persistence is unreliable.
- No `/api/communication/sos` or `/api/safety/sos-records` REST module is mounted.

### 7. Multi-Layered Content Moderation (🟡 Partial)
- Multilingual keyword/regex checks and TensorFlow toxicity are present.
- `geminiApi.js` and `perspectiveApi.js` are local wrappers; there is no installed Google Gemini/Perspective SDK or configured API-key path.
- Moderation routes exist below `/api/admin/moderation`, but `moderation_queue` is not created by the startup migrations.

### 8. Wellbeing & Mood Tracking Analytics (❌ Not a complete feature)
- `mood_entries` exists in the migration and service methods reference it.
- No safety router is mounted by `app.js`, no mood REST endpoints are available, and no React mood-tracking screen exists.
- The service reads/writes `notes`, while the migration column is `note`.

### 9. Admin Panel & Moderation Management (🟡 Partial)
- `AdminPanel.jsx` and backend admin/safety controllers provide stats, users, SOS, violations, audit logs, moderation, escalation, low-score, and identity-reveal screens/routes.
- The README route names `/analytics`, `/moderation-queue`, `/appeals`, and `/adjust-trust` are not the routes registered by the application.
- Some admin queries use `s.timestamp` although the SOS schema defines `created_at`.

### 10. Automated Maintenance & Background Jobs (🟡 Partial)
- `cleaner.cron.js` starts jobs for deletion, chat expiry, wellness tasks, anonymous rotation, academic cleanup, and trust updates.
- There is no dedicated expired-OTP cleanup matching the original README claim.
- Cleanup code references legacy tables such as `notice_board_posts` and `library_uploads`, which are not in the provided schema files.

---

## 🗄️ Database Schema & Data Model

`server/database_schema.sql` is a minimal base schema containing only `users`, `profiles`, and `audit_logs`. On startup, `server/database_migration.sql` is run followed by `src/database/apply_migration.js`; that migration assumes the base tables and other legacy tables already exist. It is not currently a complete fresh-database schema because it uses non-idempotent `ALTER TABLE` statements and does not create every table queried by the application.

| Table Name | Status | Actual purpose / discrepancy |
| :--- | :---: | :--- |
| `users` | ✅ | Base users, roles, locks, deletion and OTP fields. |
| `profiles` | ✅ | Base profile plus migration extensions for pseudonym, consent, skills, subjects, department, and trust. |
| `anonymous_id_map` | ✅ | Startup migration mapping account IDs to public anonymous IDs. |
| `academic_requests` | ✅ | Requests, urgency, status, moderation, matching, and appeals. |
| `helper_listings` | ✅ | Helper subjects, availability, and capacity. |
| `request_appeals` | ✅ | Appeal records and review state. |
| `daily_post_tracker` | ✅ | Per-user daily post counts. |
| `chat_requests` | ✅ | Consent request and expiry state. |
| `chat_messages` | 🟡 | Required by code and altered by migration, but not created in either supplied schema file. |
| `sos_records` | 🟡 | Created, but service/socket/admin column and enum expectations do not consistently match it. |
| `mood_entries` | 🟡 | Created with `note`; service expects `notes`; no API/UI workflow. |
| `trust_score_history` | ✅ | Trust changes and reasons. |
| `badge_tiers` | ✅ | Current and previous badge tiers. |
| `monthly_leaderboard` | ✅ | Monthly department rankings. |
| `feedback` | ✅ | Ratings and comments; request foreign key targets `chat_requests`. |
| `helper_feedback` | ✅ | Ratings from resolved academic requests powering the matching feedback loop. |
| `chat_offer_exclusions` | ✅ | Tracks helpers who declined/timed out of requests for cascade exclusions. |
| `broadcasts` | ✅ | Department announcements. |
| `blacklisted_tokens` | ✅ | Revoked JWTs. |
| `audit_logs` | ✅ | Administrative audit entries. |
| `scheduled_tasks` | 🟡 | Created, then altered again; duplicate/non-idempotent column statements remain. |
| `moderation_queue` | ❌ | Queried by safety/admin code but not created by supplied startup SQL. |
| `notifications` | ❌ | Queried by safety code but not created by supplied startup SQL. |
| `trust_score_components` | ❌ | Queried by trust code but not created by supplied startup SQL. |
| `anonymous_id_history` | ❌ | Referenced by identity rotation but only present in a separate migration not run by `server.js`. |

The schema therefore covers most README table names, but **a clean database setup cannot be considered reliable until the base schema, migration ordering, missing tables, duplicate alters, and service column names are reconciled**.

---

## 🔌 API Route Reference

These are the routes actually mounted by `server/src/app.js` and their route modules. All routes below except `/api/health` require authentication where noted by the route middleware.

### Health and Auth (`/api/health`, `/api/auth`)
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-otp`
- `POST /api/auth/reset-password`

### Profile (`/api/profile`)
- `GET /api/profile/me`
- `GET /api/profile/:anonymous_id`
- `PUT /api/profile/update`
- `POST /api/profile/complete-onboarding`
- `PATCH /api/profile/consent`
- `DELETE /api/profile/delete`
- `PUT /api/profile/cancel-deletion`

### Academic and Matching (`/api/academic`, `/api/match`)
- `POST /api/academic/request`
- `GET /api/academic/requests`
- `GET /api/academic/requests/my`
- `GET /api/academic/requests/:id`
- `PATCH /api/academic/requests/:id/status`
- `DELETE /api/academic/requests/:id`
- `POST /api/academic/helper/register`
- `GET /api/academic/helpers`
- `PATCH /api/academic/helper/availability`
- `POST /api/academic/requests/:id/appeal`
- `GET /api/academic/trends` (faculty)
- `GET /api/academic/admin/queue` (admin)
- `POST /api/academic/admin/:id/approve` (admin)
- `POST /api/academic/admin/:id/reject` (admin)
- `GET /api/match/recommendations`
- `GET /api/match/faculty`

### Communication, Chat, Feedback (`/api/communication`, `/api/chat`, `/api/feedback`)
- `GET /api/communication/conversations`
- `GET /api/communication/conversations/:id/messages`
- `POST /api/communication/messages` (currently a rejecting Socket.io-only stub)
- `POST /api/communication/messages/:id/flag`
- `POST /api/communication/block`
- `POST /api/communication/report`
- `GET /api/communication/broadcasts`
- `GET /api/chat/pending`
- `POST /api/chat/request`
- `POST /api/chat/respond`
- `POST /api/feedback`

### Trust (`/api/trust`)
- `GET /api/trust/leaderboard`
- `GET /api/trust/badge`
- `GET /api/trust/history`
- `GET /api/trust/history/:userId` (admin)
- `POST /api/trust/override` (admin)
- `DELETE /api/trust/history/:userId` (admin)

### Admin and Moderation (`/api/admin`)
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/sos`
- `GET /api/admin/violations`
- `GET /api/admin/audit-logs`
- `PATCH /api/admin/users/:id/role`
- `PATCH /api/admin/sos/:id/resolve`
- `PATCH /api/admin/users/:id/unlock`
- `GET /api/admin/moderation/queue`
- `POST /api/admin/moderation/:id/approve`
- `POST /api/admin/moderation/:id/reject`
- `POST /api/admin/moderation/:id/escalate`
- `GET /api/admin/escalations`
- `GET /api/admin/low-scores`
- `POST /api/admin/identity-reveal/:userId`

The original README documented several routes that are **missing or renamed**: `/api/profile/onboarding`, `/api/profile/request-deletion`, the academic `/register-helper`, `/initiate-chat`, `/resolve`, `/appeal`, and `/faculty-trends` paths, `/api/communication/request-chat`, `/api/communication/chat-requests`, `/api/chat/messages/:targetUserId`, `/api/chat/broadcast`, all `/api/safety/*` paths, `/api/communication/sos`, and admin `/analytics`, `/moderation-queue`, `/appeals`, and `/adjust-trust`. Socket.io events are not REST routes and are not listed as such here.

---

## 🛠️ Tech Stack & Dependencies

### Frontend (Client)
- React 18, React DOM, Vite, React Router 6
- Tailwind CSS 3, PostCSS, Autoprefixer
- Framer Motion, Lucide React, Recharts
- Axios, Socket.io-client, React Hot Toast
- ESLint with React, hooks, refresh plugins; Prettier

### Backend (Server)
- Node.js 18+ and Express 4
- MySQL 8 via `mysql2` and raw SQL
- Socket.io, Node-Cron
- Helmet, CORS, Express Rate Limit, bcryptjs, JsonWebToken
- Nodemailer, Morgan, Multer
- Winston and Winston Daily Rotate File
- TensorFlow.js and `@tensorflow-models/toxicity` for local toxicity checks

The manifests do **not** install `@google/genai`, a Perspective API client, or any other external Gemini/Perspective SDK. The README’s former “Gemini / Perspective API” claim was therefore inaccurate; the current wrappers are local code.

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- Node.js 18 or higher
- MySQL 8 or higher
- npm 9 or higher

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Create the database
```sql
CREATE DATABASE peerbridge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Copy the example environment files:
```bash
copy server\.env.example server\.env
copy client\.env.example client\.env
```

Fill in the MySQL and JWT values before starting the server. The current startup path runs `server/database_migration.sql` and `server/src/database/apply_migration.js`; because the supplied schema/migrations are not a complete fresh install, use a database backup or reconcile the missing base tables before relying on a new database.

### 3. Seed a super admin
```bash
node server/src/database/seeds/superadmin_seed.js
```

### 4. Seed fictional demo data (optional)
Start the backend once so its database migrations have run, then run this command from the workspace root:
```bash
npm run seed:demo
```

The demo seeder adds sample accounts and connected records for profiles, anonymous IDs, academic requests and matching, chat, mood history, resources, notices, reports, moderation, trust scores/badges, notifications, and audit views. It is additive and transactional: it does not clear existing data, and it skips when all demo accounts already exist. It requires `NODE_ENV=development` and only accepts a local MySQL host.

All demo accounts use the password `PeerBridgeDemo!2026`:

| Role | Login email |
| :--- | :--- |
| Student | `demo.student@peerbridge.test` |
| Student | `demo.student2@peerbridge.test` |
| Peer helper | `demo.helper.math@peerbridge.test` |
| Peer helper | `demo.helper.cs@peerbridge.test` |
| Peer helper | `demo.helper.wellbeing@peerbridge.test` |
| Peer helper | `demo.helper.general@peerbridge.test` |
| Faculty | `demo.faculty@peerbridge.test` |
| Admin | `demo.admin@peerbridge.test` |
| Super admin | `demo.superadmin@peerbridge.test` |

These are fictional development-only accounts; do not use the demo seeder on a shared or production database.

### 5. Run the application
```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Health check: `http://localhost:5000/api/health`

The backend can start without MySQL for health checks, but authenticated features and migrations will not work without a valid database connection.

---

## ⚙️ Environment Configuration

### Server (`server/.env`)
```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=peerbridge
JWT_SECRET=change-this-to-a-long-random-secret-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=change-this-refresh-secret-too
JWT_REFRESH_EXPIRES_IN=30d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
MAX_FILE_SIZE=5242880
LOG_LEVEL=debug
```

These are the server variables read by `env.config.js` and related utilities. `GEMINI_API_KEY` and `PERSPECTIVE_API_KEY` are **not used** and are intentionally not listed.

### Client (`client/.env`)
```env
VITE_API_URL=http://localhost:5000/api
```

The client derives the Socket.io origin by removing `/api` from `VITE_API_URL`. The former `VITE_API_BASE_URL` and `VITE_SOCKET_URL` names are not read by the current code.

Do not commit a real `server/.env`; it contains credentials and secrets.

---

## 📜 Available Scripts

Run from the workspace root:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs server and client development servers concurrently. |
| `npm run start` | Runs server and client start scripts concurrently. |
| `npm run dev:server` | Runs the backend with Nodemon. |
| `npm run dev:client` | Runs the Vite client. |
| `npm run seed:demo` | Adds fictional, development-only sample data to a local MySQL database. |
| `npm run install:all` | Installs root, server, and client dependencies. |
| `npm run lint` | Runs server and client ESLint commands. |
| `npm run build --prefix client` | Builds the client for production. |

---

## 🔧 Recently Resolved Issues (Module 1 - Matching Engine)

- **Offer Expiry & Cascade Mechanism**: Replaced the hourly chat expiry with a high-frequency (1-minute) cron job that automatically expires unaccepted academic chat requests after 15 minutes, marks the helper in the `chat_offer_exclusions` table, and intelligently cascades the offer to the next-best eligible helper using a weighted scoring formula (subject, semester, trust score, recent activity) without looping indefinitely.
- **Bounded Feedback Loop**: Resolved academic requests now store helper feedback in the `helper_feedback` table. This feedback is applied as a dynamically capped adjustment during future helper match scoring rather than overwriting base trust scores.
- **Atomic Chat Updates**: Enforced strict transactional atomicity on accepting/declining/expiring chat requests, verifying `expires_at >= NOW()` within the SQL updates to prevent race conditions.
- **Cleaned Cron Behaviors**: Corrected the hourly data minimization cron job to prevent double-cascades of academic requests and fixed minor linter errors.

---



---

## 🛡️ License

This project is licensed under the **ISC License**.
