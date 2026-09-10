# PeerBridge — Student Wellbeing & Anonymous Peer Support Platform

**PeerBridge** is a secure, anonymous-first, multi-university platform designed to empower students to seek and provide peer support for mental wellbeing and academic growth. Built with an event-driven micro-modular full-stack architecture, PeerBridge integrates real-time messaging, multi-layered AI content moderation, automated crisis intervention, dynamic trust gamification, and strict GDPR-compliant privacy engineering.

---

## 📋 Table of Contents

- [Key Objectives & Design Philosophy](#-key-objectives--design-philosophy)
- [Architecture Overview](#-architecture-overview)
- [Comprehensive Feature Coverage](#-comprehensive-feature-coverage)
  - [1. Anonymous Identity & Privacy Engineering (GDPR)](#1-anonymous-identity--privacy-engineering-gdpr)
  - [2. Multi-Role Access Control (RBAC)](#2-multi-role-access-control-rbac)
  - [3. Academic Support Board & Peer Matching](#3-academic-support-board--peer-matching)
  - [4. Dynamic Trust, Reputation & Gamification System](#4-dynamic-trust-reputation--gamification-system)
  - [5. Real-Time Messaging & Consent-Based Chat System](#5-real-time-messaging--consent-based-chat-system)
  - [6. Crisis SOS Emergency Response System](#6-crisis-sos-emergency-response-system)
  - [7. Multi-Layered AI Content Moderation Pipeline](#7-multi-layered-ai-content-moderation-pipeline)
  - [8. Wellbeing & Mood Tracking Analytics](#8-wellbeing--mood-tracking-analytics)
  - [9. Admin Panel & Moderation Management](#9-admin-panel--moderation-management)
  - [10. Automated Maintenance & Background Jobs](#10-automated-maintenance--background-jobs)
- [Database Schema & Data Model](#-database-schema--data-model)
- [API Route Reference](#-api-route-reference)
- [Tech Stack & Dependencies](#-tech-stack--dependencies)
- [Quick Start & Local Setup](#-quick-start--local-setup)
- [Environment Configuration](#-environment-configuration)
- [Available Scripts](#-available-scripts)

---

## 🎯 Key Objectives & Design Philosophy

- **Anonymous-First Security**: Student PII (personally identifiable information) is completely decoupled from activity. Interaction takes place using pseudonymous identifiers (e.g. `Peer_XXXXX`).
- **Privacy by Design**: Fully compliant with GDPR data protection principles, featuring explicit user consents, data audit logging, and a 30-day grace period for account deletion requests.
- **Safety & Proactive Intervention**: Multi-layered automated filtering prevents hate speech, harassment, and threats while providing real-time panic response for self-harm or acute distress calls.
- **Peer Empowerment & Trust Gamification**: Encourages constructive peer support by rewarding helpful interactions with dynamic trust scores, badge tiers, and monthly departmental leaderboards.
- **Consensual Peer Communication**: Eliminates spam and unsolicited harassment by requiring consent before any direct 1-on-1 messaging session opens.

---

## 🏗️ Architecture Overview

```
                          ┌───────────────────────────┐
                          │   React 18 + Vite Client  │
                          │ (Tailwind CSS, Recharts)  │
                          └─────────────┬─────────────┘
                                        │ (HTTP REST / WebSockets)
                                        ▼
                          ┌───────────────────────────┐
                          │   Node.js / Express API   │
                          └──────┬──────────────┬─────┘
                                 │              │
        ┌────────────────────────┼──────────────┼────────────────────────┐
        ▼                        ▼              ▼                        ▼
┌──────────────┐         ┌──────────────┐ ┌───────────┐        ┌──────────────────┐
│ MySQL 8.0 DB │         │ Socket.io    │ │ Node-Cron │        │ AI Moderation    │
│ (Raw SQL)    │         │ Real-Time    │ │ Purge Engine│       │ (Gemini / TFJS / │
└──────────────┘         └──────────────┘ └───────────┘        │ Perspective API) │
                                                               └──────────────────┘
```

The application is structured into two main decoupled workspaces:
- **`server/`**: Express.js REST API with feature-focused domain modules, Socket.io real-time server, cron cleanups, and MySQL query pooling.
- **`client/`**: Vite React single-page application utilizing modern Context API for state management, framer-motion animations, and Recharts analytics.

---

## 🌟 Comprehensive Feature Coverage

### 1. Anonymous Identity & Privacy Engineering (GDPR)
- **Pseudonymous Identity Generator**: Automatically generates non-reversible pseudonyms (`anonymous_id`) for every profile upon registration to safeguard user identity across chat rooms and public support boards.
- **GDPR Consent Controls**: Users retain explicit toggles for Data Collection, Mood Tracking, and AI Analysis consent.
- **Account Deletion Workflow**: Supports user-requested account deletion with a 30-day grace period, warning notifications, and an automated background purge.
- **Token Blacklisting**: Revokes JWTs on user logout or emergency account suspension to instantly terminate active sessions.

### 2. Multi-Role Access Control (RBAC)
Supports granular permissions across 4 primary user roles:
- **Student**: Access to wellbeing tools, academic posting, helper registration, peer chat, and leaderboard rankings.
- **Faculty**: Access to departmental broadcasts, crisis SOS emergency alerts, student risk monitoring, and academic trend analytics.
- **Admin**: System-wide operational monitoring, user trust adjustments, moderation appeal review, and audit log inspection.
- **Super Admin**: Master account privileges including role elevation, system seeding, and full database access.

### 3. Academic Support Board & Peer Matching
- **Help Request Posting**: Students post requests categorized by subject and urgency level (`low`, `medium`, `high`, `critical`).
- **Anti-Spam Daily Limits**: Enforces post limits per user (`daily_post_tracker`) to maintain high board quality.
- **Peer Helper Directory**: Students register as helpers by setting their subject expertise, availability status (`available`, `busy`, `offline`), and maximum concurrent help capacity.
- **Smart Peer Matcher**: Queries qualified helpers based on subject alignment, current capacity, and minimum trust score threshold (≥30).
- **Auto-Initiated Helper Chat**: Initiating help automatically generates a consent-accepted chat session and sends an auto-context introduction message.
- **Faculty Trend Dashboard (`FacultyTrends.jsx`)**: Aggregates 30-day academic stress analytics by subject and department for faculty awareness.

### 4. Dynamic Trust, Reputation & Gamification System
- **Trust & Behavior Score Engine**: Dynamic score system (0–100) reflecting a user’s platform standing.
  - **Score Boosts**: +10 for successful peer help, +5 for 5-star feedback, +3 for fast response (<5 mins), +15 for helping with critical urgency requests.
  - **Score Penalties**: -2 for safety warnings, -4 for content removal, -6 for account suspension, -4 for false SOS alarms.
- **Automated Badge Tier Escalation**: Users automatically earn and unlock tier badges:
  - 🥉 **Bronze** (0–39): New member
  - 🥈 **Silver** (40–59): Trusted peer
  - 🥇 **Gold** (60–79): Reliable helper
  - 💎 **Platinum** (80–100): Elite contributor
- **Monthly Peer Leaderboard (`Leaderboard.jsx`)**: Real-time departmental rankings derived from help count, average peer ratings, and trust scores.
- **Trust Audit History**: Complete record of all reputation changes stored in `trust_score_history`.

### 5. Real-Time Messaging & Consent-Based Chat System
- **Consent-Based Chat Requests**: Users must send a chat request specifying subject context before 1-on-1 direct messaging opens.
- **Socket.io Integration**: Provides instant messaging, active user presence, typing indicators, and read confirmations.
- **Multi-Mode Communication**: Supports standard `chat_only`, `study_group` collaboration, and `campus_meeting` coordination.
- **Ephemeral Messages**: Configurable message retention and auto-expiration (`expires_at`).
- **Departmental & Emergency Broadcasts**: Enables faculty and administrators to publish persistent announcements targeted by department.

### 6. Crisis SOS Emergency Response System
- **One-Click Emergency Panic Button (`SOSButton.jsx`)**: Students in acute distress can instantly emit a crisis signal across categories (`self-harm`, `harassment`, `medical`, `other`) with severity levels (`LOW`, `MEDIUM`, `HIGH`).
- **Context-Aware Payload**: Automatically attaches recent mood tracking data to assist responders while keeping student identity protected where applicable.
- **Real-Time Dispatch**: Emits instant WebSocket alerts to online faculty members and administration dashboards for immediate intervention.
- **Faculty Assignment & Resolution**: Admins/Faculty can claim incident records, track intervention history, and mark cases resolved.

### 7. Multi-Layered AI Content Moderation Pipeline
Every submitted post, request, or profile update passes through a 3-layer automated moderation system:
1. **Layer 1: Multilingual Keyword & Regex Filter**: Detects self-harm, violent threats, harassment, and abusive slang across **English**, **Roman Urdu**, and **Urdu Script**.
2. **Layer 2: Perspective API & TensorFlow Toxicity**: Evaluates severe toxicity, insult, and threat probability scores (`@tensorflow-models/toxicity`, `@tensorflow/tfjs`).
3. **Layer 3: Google Gemini API Context Analysis**: Analyzes contextual risk patterns (`geminiApi.js`) to catch subtle or indirect harassment.
- **Automated Escalation Pipeline**:
  - **Warning**: Notifies the user and deducts behavior points.
  - **Content Removal**: Removes violating content from public boards.
  - **Account Suspension**: Automatically locks accounts for 24 hours if behavior score drops below 10, invalidating active sessions.
- **Moderation Appeals Queue**: Flagged academic posts enter an appeal pipeline (`request_appeals`) allowing users to request human review by admins.

### 8. Wellbeing & Mood Tracking Analytics
- **Daily Mood Logger**: Students track their emotional state (1–5 score) with optional personal reflection notes.
- **Personal Trend Visualization**: Interactive charts mapping emotional patterns over time.
- **Emergency Context Integration**: Integrates recent mood logs into SOS emergency dispatches for emergency personnel context.

### 9. Admin Panel & Moderation Management
- **Centralized Telemetry Dashboard (`AdminPanel.jsx`)**: Displays real-time operational statistics for total users, active SOS calls, pending academic appeals, and trust score distribution.
- **Moderation Queue Management**: Human oversight interface to approve, dismiss, or escalate flagged content.
- **User Account Management**: Soft-lock/unlock user accounts, override trust scores, and inspect system audit logs (`audit_logs`).

### 10. Automated Maintenance & Background Jobs
Powered by `node-cron` (`cleaner.cron.js`), the server continuously performs background tasks:
- Purges expired 6-digit email OTPs.
- Hard-deletes user profiles whose 30-day GDPR deletion window has elapsed.
- Cleans up expired chat requests and ephemeral messages.
- Re-aggregates monthly leaderboard ranks.

---

## 🗄️ Database Schema & Data Model

The application uses MySQL 8.0 with relational integrity, foreign key cascades, and indexing for optimal query performance.

| Table Name | Purpose / Functionality |
| :--- | :--- |
| `users` | Primary user credential store, roles, lock states, OTP verification, and deletion schedule timestamps. |
| `profiles` | User profiles containing anonymous IDs, role-specific attributes (semester, department, skills), trust scores, and consent preferences. |
| `anonymous_id_map` | Secure mapping between system `user_id` and public `anonymous_id`. |
| `academic_requests` | Peer support requests detailing subject, urgency, description, status, helper assignment, and AI moderation flags. |
| `helper_listings` | Directory of peer mentors with subject JSON arrays, current help count, and max capacity. |
| `request_appeals` | Moderation appeal submissions for flagged or rejected academic requests. |
| `daily_post_tracker` | Anti-spam tracker maintaining daily post counts per user. |
| `chat_requests` | Consent-based messaging invitations with status tracking (`pending`, `accepted`, `declined`, `expired`). |
| `chat_messages` | Real-time chat history supporting room keys, chat modes, broadcast flags, and auto-expiration timestamps. |
| `sos_records` | Crisis emergency records with category, severity, status, assigned faculty, and attached mood data. |
| `mood_entries` | Time-series mood tracking logs for student self-monitoring. |
| `trust_score_history` | Audit log tracking every trust score modification, reason, and delta. |
| `badge_tiers` | User achievement tiers (`bronze`, `silver`, `gold`, `platinum`) and tier unlock timestamps. |
| `monthly_leaderboard` | Pre-aggregated monthly rankings per department for performant leaderboard queries. |
| `feedback` | Peer ratings (1–5 stars) and comments linked to completed support sessions. |
| `broadcasts` | Departmental and campus-wide announcements published by faculty/admins. |
| `blacklisted_tokens` | Revoked JWT tokens for secure session invalidation. |
| `audit_logs` | System-wide administrative action logs for security auditing. |

---

## 🔌 API Route Reference

### 🔑 Auth Module (`/api/auth`)
- `POST /api/auth/register` — Register a new student/faculty account.
- `POST /api/auth/login` — Authenticate user, issue JWT token.
- `POST /api/auth/logout` — Blacklist current active token.
- `POST /api/auth/forgot-password` — Generate & send 6-digit email OTP.
- `POST /api/auth/verify-otp` — Validate reset OTP.
- `POST /api/auth/reset-password` — Update user password with valid OTP session.

### 👤 Profile & Privacy Module (`/api/profile`)
- `GET /api/profile/me` — Fetch current logged-in user profile & consent settings.
- `PUT /api/profile/me` — Update profile details, skills, department, and office hours.
- `PUT /api/profile/onboarding` — Save initial onboarding setup & consent choices.
- `POST /api/profile/request-deletion` — Schedule account deletion under GDPR 30-day grace period.
- `POST /api/profile/cancel-deletion` — Cancel scheduled account deletion.

### 📚 Academic Support Module (`/api/academic`)
- `GET /api/academic/requests` — Retrieve open academic help requests (optional subject filter).
- `GET /api/academic/my-requests` — Retrieve help requests posted by the logged-in user.
- `POST /api/academic/requests` — Submit a new academic help request (AI moderated & rate limited).
- `POST /api/academic/register-helper` — Register or update subjects as a peer helper.
- `GET /api/academic/helpers` — Query available peer helpers for a subject.
- `POST /api/academic/initiate-chat` — Accept a request and launch a peer chat room.
- `POST /api/academic/resolve` — Mark request resolved and provide rating for helper.
- `POST /api/academic/appeal` — Submit a moderation appeal for a flagged request.
- `GET /api/academic/faculty-trends` — Retrieve 30-day subject stress trends (Faculty only).

### 🏆 Trust & Gamification Module (`/api/trust`)
- `GET /api/trust/leaderboard` — Get monthly leaderboard rankings (optional department filter).
- `GET /api/trust/badge` — Fetch current user badge tier and score statistics.
- `GET /api/trust/history` — Get history of trust score changes.

### 💬 Communication & Chat Module (`/api/communication`, `/api/chat`)
- `POST /api/communication/request-chat` — Send consent-based chat request.
- `GET /api/communication/chat-requests` — List pending incoming/outgoing chat requests.
- `PUT /api/communication/chat-requests/:id` — Accept or decline chat request.
- `GET /api/chat/messages/:targetUserId` — Fetch conversation history with a peer.
- `POST /api/chat/broadcast` — Post a departmental broadcast (Faculty/Admin).

### 🚨 Safety & Emergency SOS Module (`/api/safety`, `/api/communication/sos`)
- `POST /api/communication/sos` — Trigger a high-priority crisis SOS emergency alert.
- `GET /api/safety/sos-records` — List active/resolved SOS incidents (Faculty/Admin).
- `PUT /api/safety/sos-records/:id` — Update SOS status or assign faculty responder.
- `POST /api/safety/mood` — Log daily mood score and reflection notes.
- `GET /api/safety/mood-history` — Fetch historical mood records.

### 🛡️ Admin Panel Module (`/api/admin`)
- `GET /api/admin/analytics` — System metrics and telemetry overview.
- `GET /api/admin/moderation-queue` — Inspect pending AI-flagged content items.
- `PUT /api/admin/moderation-queue/:id` — Approve or reject flagged content.
- `GET /api/admin/appeals` — Review submitted moderation appeals.
- `PUT /api/admin/appeals/:id` — Approve or reject user appeal.
- `GET /api/admin/users` — Search and manage platform users.
- `POST /api/admin/adjust-trust` — Manually modify user trust score with reason.
- `GET /api/admin/audit-logs` — Inspect administrative activity logs.

---

## 🛠️ Tech Stack & Dependencies

### Frontend (Client)
- **Framework**: React 18, Vite
- **Styling & UI**: Tailwind CSS v3, PostCSS, Framer Motion
- **Icons & Visuals**: Lucide React, Recharts (analytics graphs)
- **State & Routing**: React Router v6, Context API (`AuthContext`, `ThemeContext`, `SocketContext`)
- **Networking**: Axios, Socket.io-client
- **Feedback**: React Hot Toast

### Backend (Server)
- **Runtime & Server**: Node.js 18+, Express.js
- **Database Layer**: MySQL 8.0, `mysql2` (Connection pooling, raw SQL queries)
- **Real-Time Engine**: Socket.io
- **Security & Protection**: Helmet, Express Rate Limit, bcryptjs, JsonWebToken (JWT)
- **AI Moderation**: Google Gemini API (`@google/genai`), Perspective API, TensorFlow.js (`@tensorflow/tfjs`, `@tensorflow-models/toxicity`)
- **Scheduler & Mail**: Node-Cron, Nodemailer
- **Logging & Utilities**: Winston, Winston Daily Rotate File, Morgan, Multer

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **MySQL Server** (v8.0 or higher)
- **npm** (v9.0.0 or higher)

### 1. Repository Setup & Dependency Installation
Clone the repository and install root, client, and server dependencies using the master setup script:
```bash
npm run install:all
```

### 2. Database Configuration
Start your MySQL server and create the `peerbridge` database:
```sql
CREATE DATABASE peerbridge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Environment Setup
Create the required environment variable files:
```bash
# Server Environment
cp server/.env.example server/.env

# Client Environment
cp client/.env.example client/.env
```

### 4. Database Seeding
Initialize the master Super Admin user account:
```bash
node server/src/database/seeds/superadmin_seed.js
```
*(Note: Database tables and column migrations auto-execute automatically when the server starts up).*

### 5. Running the Application
Launch both backend and frontend development servers concurrently:
```bash
npm run dev
```
- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`
- **API Health Check**: `http://localhost:5000/api/health`

---

## ⚙️ Environment Configuration

### Server (`server/.env`)
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database Connection
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=peerbridge

# JWT Authentication Secret
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Email Service (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# AI Moderation API Keys (Optional)
GEMINI_API_KEY=your_google_gemini_api_key
PERSPECTIVE_API_KEY=your_perspective_api_key
```

### Client (`client/.env`)
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 📜 Available Scripts

Run from the workspace root:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs both backend and frontend servers concurrently. |
| `npm run dev:server` | Runs backend server only with Nodemon auto-reload. |
| `npm run dev:client` | Runs frontend Vite dev server only. |
| `npm run install:all` | Installs dependencies across root, `server/`, and `client/`. |
| `npm run lint` | Runs ESLint across both backend and frontend codebases. |

---

## 🛡️ License

This project is licensed under the **ISC License**.
