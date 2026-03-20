# 🛡️ Community Guardian

**A real-time community safety platform that aggregates, verifies, and delivers location-aware security alerts using AI — empowering neighborhoods to stay informed and connected.**

> Built for the Palo Alto Networks Hackathon — Scenario: Community Safety & Alert System

---

## 📌 Problem Statement

Communities lack a centralized, intelligent system to aggregate safety-relevant information from diverse sources (cybersecurity advisories, weather warnings, financial fraud alerts, phishing databases, and local news) and deliver it in a timely, location-aware, and actionable format.

Existing solutions are fragmented: weather apps don't cover cyber threats, news apps don't verify or prioritize by severity, and none provide AI-generated safety checklists or community coordination tools.

**Community Guardian solves this by:**
- Aggregating alerts from 5+ real-time data sources into a unified feed
- Using GPT-4o-mini to verify, categorize, extract locations, and generate actionable safety checklists
- Filtering alerts by user location (100km radius) with severity-based prioritization
- Enabling "Safe Circles" — neighborhood groups with real-time location sharing and messaging
- Providing a searchable phishing database powered by PhishTank
- Falling back gracefully to rule-based heuristics when AI is unavailable

---

## 🎬 Demo & Core Flow

### End-to-End Flow: Create → View → Update + Search/Filter

| Step | Action |
|------|--------|
| **Register/Login** | JWT-authenticated account creation with email + password |
| **Set Location** | Auto-detect via browser geolocation or manual lat/lng entry |
| **View Feed** | Browse all incidents sorted by severity (HIGH → MEDIUM → LOW) |
| **Filter/Search** | Filter by category (Crime, Weather, Cyber, Scam, Health) and severity |
| **View Alert Detail** | See AI-generated safety checklist, immediate action step, source link |
| **Location Alerts** | Alerts tab shows only incidents within 100km of your location |
| **Phishing Search** | Search PhishTank's verified phishing URL database with pagination |
| **Safe Circles** | Create/join groups, send real-time messages, share live location on map |
| **AI Chatbot** | Ask the Guardian Assistant about safety tips and app features |

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router v6 |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | Supabase (managed PostgreSQL) |
| **AI** | OpenAI GPT-4o-mini (verification, categorization, checklists, chatbot) |
| **Real-time** | Socket.io (circle messaging + live location sharing) |
| **Maps** | Leaflet + React-Leaflet + OpenStreetMap |
| **Scheduling** | node-cron (30-min fetch cycles, daily cleanup) |
| **Testing** | Vitest + fast-check (property-based testing) |
| **Auth** | JWT + bcrypt |

---

## 🧠 AI Integration + Fallback

### AI Capabilities (GPT-4o-mini)

The AI pipeline processes every incoming alert through a structured prompt that returns JSON:

```
Raw Alert → AI Filter → { verified, confidence, category, severity, summary, actionStep, steps[], location }
```

| AI Feature | Description |
|-----------|-------------|
| **Verification** | Determines if an alert is legitimate (boolean + confidence 0–1) |
| **Categorization** | Classifies into CRIME, WEATHER, HEALTH, SCAM, CYBER, or OTHER |
| **Severity Assessment** | Assigns LOW, MEDIUM, or HIGH based on threat analysis |
| **Location Extraction** | Extracts city/region names and maps to lat/lng coordinates |
| **Safety Checklists** | Generates 3–4 actionable safety steps specific to the threat type |
| **Immediate Action** | Produces a single urgent action recommendation (max 80 chars) |
| **Chatbot** | Conversational assistant with context history for safety guidance |

### Rule-Based Fallback (When AI is Unavailable)

When the OpenAI API key is missing or the API fails, the system degrades gracefully:

| Fallback Feature | Implementation |
|-----------------|----------------|
| **Category Guessing** | Regex-based keyword matching (e.g., `/theft\|robbery\|assault/` → CRIME) |
| **Severity Guessing** | Keyword analysis for threat level indicators |
| **Safety Checklists** | Pre-built checklist templates per category (6 categories × 4 steps each) |
| **Location Extraction** | Database of 100+ known cities with coordinates (Haversine distance matching) |
| **UI Indicator** | `FallbackBanner` component warns users: "AI verification unavailable — exercise extra caution" |

The fallback ensures the app remains fully functional without any AI dependency.

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│  ┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌─────────┐ ┌──────┐│
│  │ Feed │ │Alerts│ │Phishing│ │Circles │ │ Profile │ │ Chat ││
│  └──┬───┘ └──┬───┘ └───┬────┘ └───┬────┘ └────┬────┘ └──┬───┘│
│     │        │         │          │            │         │     │
│     └────────┴─────────┴────┬─────┴────────────┴─────────┘     │
│                             │ Axios + Socket.io-client          │
└─────────────────────────────┼───────────────────────────────────┘
                              │ REST API + WebSocket
┌─────────────────────────────┼───────────────────────────────────┐
│                        BACKEND (Express + TS)                   │
│  ┌──────────────────────────┴──────────────────────────────┐    │
│  │                    API Routes                           │    │
│  │  /auth  /feed  /alerts  /phishing  /circles  /chat     │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│  ┌──────────────┐  ┌───────┴────────┐  ┌──────────────────┐    │
│  │  Scheduler   │  │  AI Filter     │  │  Socket.io       │    │
│  │  (node-cron) │  │  (GPT-4o-mini) │  │  (real-time)     │    │
│  │  30min fetch │  │  + Fallback    │  │  messages + loc  │    │
│  └──────┬───────┘  └───────┬────────┘  └──────────────────┘    │
│         │                  │                                    │
│  ┌──────┴──────────────────┴───────────────────────────────┐    │
│  │              Data Fetchers                              │    │
│  │  CISA KEV │ RBI RSS │ PhishTank │ RSS News │ Weather    │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│  ┌──────────────────────────┴──────────────────────────────┐    │
│  │           Deduplication Engine                          │    │
│  │  Content Hash (SHA-256) + Semantic Similarity (Jaccard) │    │
│  │  + Geographic Proximity (Haversine ≤ 150km)             │    │
│  └──────────────────────────┬──────────────────────────────┘    │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Supabase (PgSQL) │
                    │  users, incidents, │
                    │  circles, messages,│
                    │  location_shares   │
                    └───────────────────┘
```

---

## 📊 Data Sources

All data is fetched from public APIs — **no scraping of live sites**.

| Source | Type | API Key Required | Data |
|--------|------|:---:|------|
| [CISA KEV Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | Cybersecurity | ❌ | Known exploited vulnerabilities |
| [RBI RSS Feed](https://www.rbi.org.in/scripts/rss.aspx) | Financial | ❌ | Reserve Bank of India advisories |
| [PhishTank](https://www.phishtank.com/) | Phishing | ❌ | Verified phishing URLs |
| [Open-Meteo](https://open-meteo.com/) | Weather | ❌ | Per-user weather alerts (global) |
| RSS News Feeds (10 sources) | News | ❌ | NDTV, Times of India, The Hindu, Indian Express, Hindustan Times, The Hacker News, BleepingComputer, Krebs on Security, BBC, Reuters |

### Synthetic Seed Data

A seed script (`npm run seed`) populates the database with sample alerts across all categories (Weather, Cyber, Scam, Crime, Health, News) including location-specific data for Bengaluru. This ensures the app is demo-ready without requiring live API calls.

---

## 🔐 Security

| Measure | Implementation |
|---------|---------------|
| **API Keys** | Stored in `.env`, never committed. `.env.example` provided. |
| **Authentication** | JWT tokens (7-day expiry) with bcrypt password hashing (10 rounds) |
| **Authorization** | Middleware-protected routes; circle membership verified before access |
| **CORS** | Configured to allow only the frontend origin |
| **Input Validation** | Required field checks, type validation, coordinate range validation |
| **Location Privacy** | Location sharing is opt-in with configurable expiration (15/30/60 min) |
| **No Scraping** | All data from public APIs with proper User-Agent headers |

---

## ✅ Testing

The project uses Vitest with fast-check for property-based testing.

**Test file:** `backend/server/normalize.test.ts`

| Test | Type | What It Validates |
|------|------|-------------------|
| Semantic deduplication (property-based) | PBT | Alerts with same event type + overlapping geography (≤150km) are deduplicated |
| Avalanche alerts — Idaho regions | Unit | Concrete case: two avalanche alerts ~70km apart are detected as duplicates |
| Flood warnings — adjacent IL counties | Unit | Concrete case: Cook County + DuPage County flood warnings deduplicated |
| Winter storm — California mountains | Edge | Alerts with same `source_url` but different text are hash-deduplicated |

```bash
# Run tests
cd backend
npm test
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- OpenAI API key (optional — app works without it via fallback)

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd community-guardian

# 2. Backend setup
cd backend
cp .env.example .env
# Edit .env with your Supabase URL, service key, and optionally OpenAI key
npm install

# 3. Database setup — run the SQL from backend/src/db/setup.ts in Supabase SQL Editor
# Then run migrations:
#   backend/migrations/add_alerts_columns.sql
#   backend/migrations/add_news_columns.sql

# 4. Seed sample data
npm run seed

# 5. Start backend
npm run dev

# 6. Frontend setup (new terminal)
cd ../frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:3001`.

### Environment Variables

```env
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-api-key        # Optional
NEWS_API_KEY=                                  # Optional
FRONTEND_URL=http://localhost:5173
```

---

## 🗄️ Database Schema

```sql
users          (id, email, password_hash, display_name, location_lat, location_lng)
incidents      (id, external_id, title, description, category, severity, source,
                source_url, article_url, image_url, location_lat, location_lng,
                location_radius, verified, ai_processed, ai_confidence,
                action_step, steps, content_hash, created_at, expires_at)
circles        (id, name, invite_code, owner_id)
circle_members (circle_id, user_id, joined_at)
messages       (id, circle_id, user_id, content, created_at)
location_shares(id, circle_id, user_id, lat, lng, expires_at)
```

---

## ⚖️ Responsible AI

| Consideration | How We Address It |
|--------------|-------------------|
| **Transparency** | Every alert shows whether it's AI-verified or unverified, with confidence percentage |
| **Graceful Degradation** | Full rule-based fallback when AI is unavailable — the app never breaks |
| **User Warning** | `FallbackBanner` component explicitly warns users when AI verification is offline |
| **No Hallucination Risk** | AI processes structured data (titles + descriptions) — it doesn't generate alerts from scratch |
| **Confidence Scores** | AI confidence (0–1) is displayed to users so they can judge reliability |
| **Human Override** | Users can see the original source link and verify information independently |
| **Data Privacy** | Location sharing is opt-in, time-limited, and user-controlled |
| **No PII in AI Calls** | Only alert titles/descriptions are sent to OpenAI — no user data |
| **Synthetic Data** | Seed data is fully synthetic; no real user data is used |

---

## 🔮 Future Enhancements

| Enhancement | Description |
|------------|-------------|
| **Push Notifications** | Web push / mobile notifications for high-severity alerts in user's area |
| **Multi-language Support** | Translate alerts into regional languages (Hindi, Tamil, etc.) |
| **Incident Reporting** | Allow users to submit community-sourced incidents with photo evidence |
| **Alert Upvote/Downvote** | Community validation to complement AI verification |
| **Offline Mode** | Service worker + IndexedDB for cached alerts when offline |
| **SMS Alerts** | Twilio integration for critical alerts to users without the app open |
| **Admin Dashboard** | Moderation panel for reviewing flagged content and managing users |
| **Historical Analytics** | Trend analysis and heatmaps showing incident patterns over time |
| **Integration with Emergency Services** | Direct 911/112 calling with pre-filled incident context |
| **Fine-tuned AI Model** | Train a domain-specific model on safety data for better categorization |

---

## ⚠️ Known Limitations

| Limitation | Detail |
|-----------|--------|
| **PhishTank Rate Limits** | Free tier has aggressive rate limiting; mitigated with caching + exponential backoff |
| **Weather Alerts Scope** | Open-Meteo provides weather codes, not official NWS-style alert text |
| **Location Accuracy** | City-level extraction from text is approximate; relies on a known-cities database |
| **No Email Verification** | Registration doesn't verify email addresses |
| **Single Region Optimization** | Location matching is optimized for India + major global cities; smaller towns may not be recognized |
| **No Rate Limiting on API** | Backend endpoints lack request rate limiting (should add express-rate-limit) |
| **No Pagination on Feed** | Feed loads top 50 results; infinite scroll not yet implemented |

---

## 🧩 Design Tradeoffs

| Decision | Tradeoff | Rationale |
|----------|----------|-----------|
| **Supabase over raw PostgreSQL** | Vendor lock-in vs. speed | Supabase provides auth, real-time, and hosting out of the box — ideal for a hackathon prototype |
| **GPT-4o-mini over GPT-4** | Accuracy vs. cost/speed | 4o-mini is 10x cheaper and fast enough for alert categorization; structured JSON output keeps it reliable |
| **Jaccard Similarity for Dedup** | Simplicity vs. precision | Lightweight, no ML model needed; combined with event-type + geo-proximity it catches 90%+ of duplicates |
| **Socket.io over SSE** | Complexity vs. bidirectionality | Circles need two-way communication (messages + location); SSE would only handle server→client |
| **Cron-based Fetching over Webhooks** | Polling overhead vs. reliability | Most data sources don't offer webhooks; 30-min polling is a pragmatic choice |
| **In-memory PhishTank Cache** | Memory usage vs. latency | Avoids repeated API calls; 1-hour TTL keeps data fresh enough |

---

## 📁 Project Structure

```
├── backend/
│   ├── server/
│   │   ├── fetchers/          # Data source fetchers (CISA, RBI, PhishTank, RSS, Weather)
│   │   ├── aiFilter.ts        # AI verification + fallback logic
│   │   ├── normalize.ts       # Deduplication engine (hash + semantic)
│   │   ├── normalize.test.ts  # Property-based tests
│   │   ├── scheduler.ts       # Cron job orchestrator
│   │   └── seed.ts            # Sample data seeder
│   ├── src/
│   │   ├── db/                # Supabase client + schema setup
│   │   ├── middleware/        # JWT auth middleware
│   │   ├── routes/            # API routes (auth, feed, alerts, circles, chat, phishing)
│   │   ├── services/          # AI verification + data fetcher services
│   │   ├── socket.ts          # Socket.io event handlers
│   │   └── index.ts           # Express server entry point
│   └── migrations/            # SQL migration files
├── frontend/
│   ├── src/
│   │   ├── components/        # AlertCard, Chatbot, FallbackBanner, Layout, DigestFeed
│   │   ├── context/           # AuthContext (JWT state management)
│   │   ├── hooks/             # useLocationAlerts (geolocation + alert fetching)
│   │   ├── lib/               # Axios API client
│   │   └── pages/             # Feed, Alerts, Phishing, Circles, Profile, Login, Register
│   └── index.html
└── README.md
```

---

## 👤 Author

Built with ☕ and curiosity.

---

*This project uses synthetic data only. No real user data is collected or stored. API keys are managed via environment variables and never committed to version control.*
