# MOVZZ — Master Roadmap (Combined)
> Reliability-Orchestrated Mobility Platform · Chennai, India
> Last updated: March 10, 2026

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ DONE | Implemented and working |
| 🔴 CRITICAL | Security risk / launch blocker |
| 🟠 HIGH | Needed for beta users |
| 🟡 MEDIUM | Important but deferrable post-launch |
| 🟢 NICE | Post-launch enhancement |
| ⬜ TODO | Not yet started |
| 🤖 AI | AI engine task |

---

## Grand Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Section 0 — Security Hardening | 11 | 11 | 0 |
| Section 1 — Foundation | 34 | 34 | 0 |
| Section 2 — Platform Features | 26 | 9 | 17 |
| Section 3 — AI Intelligence Layer | 23 | 13 | 10 |
| Section 4 — Production & Deployment | 14 | 0 | 14 |
| **TOTAL** | **108** | **67** | **41** |

**Progress: 67/108 tasks (62%)**

---

## SECTION 0 — Security Hardening ✅ (11/11 Complete)

> Completed March 10, 2026 — all 11 vulnerabilities patched.

| # | Priority | Task | Status |
|---|----------|------|--------|
| S1 | 🔴 | **Remove hardcoded JWT fallback secret** — throws `Error('JWT_SECRET is required')` on startup | ✅ DONE |
| S2 | 🔴 | **Fix auth race condition** — `auth.controller.ts` uses `prisma.user.upsert()` — atomic, no duplicate crash | ✅ DONE |
| S3 | 🔴 | **Fix OAuth race condition** — `oauth.controller.ts` uses `upsert` — safe under concurrent logins | ✅ DONE |
| S4 | 🔴 | **Add admin role protection** — `role String @default("user")` in schema; `requireAdmin` middleware on all `/admin/` routes | ✅ DONE |
| S5 | 🔴 | **Fix hardcoded API URL** — all three files now use `VITE_API_URL` env var with localhost fallback | ✅ DONE |
| S6 | 🔴 | **Protect env files** — `.gitignore` fixed; `backend/.env.example` + `frontend/.env.example` created | ✅ DONE |
| S7 | 🟠 | **OTP rate limiting** — `express-rate-limit` on `/verify-otp`: 5 attempts per phone per 10 min | ✅ DONE |
| S8 | 🟠 | **Fix Socket memory leak** — handler refs stored; `socket.off()` called with same refs on disconnect | ✅ DONE |
| S9 | 🟠 | **Fix dual fare engine** — `quotes.service.ts` FARE_CONFIGS aligned with `fare.service.ts` rates | ✅ DONE |
| S10 | 🟠 | **Add token expiry** — `tokenExpiry = Date.now() + 7d` on login; auto-logout on startup if expired | ✅ DONE |
| S11 | 🟠 | **Harden CORS + global rate limit** — CORS locked to allowlist; 100 req/15 min global limiter | ✅ DONE |

---

## SECTION 1 — Foundation ✅ (34/34 Complete)

### Phase 1 — Core Backend ✅ (12/12)

| # | Task | Status | Key File(s) |
|---|------|--------|-------------|
| 1 | Express + TypeScript + Prisma scaffold | ✅ DONE | `backend/src/index.ts` |
| 2 | PostgreSQL schema — Users, Providers, Bookings, BookingAttempts, BookingLogs | ✅ DONE | `backend/prisma/schema.prisma` |
| 3 | Redis cache with in-memory fallback | ✅ DONE | `backend/src/config/redis.ts` |
| 4 | OTP authentication (phone) with JWT | ✅ DONE | `backend/src/controllers/auth.controller.ts` |
| 5 | Fare engine — mode-specific rates, surge, Haversine×1.35, airport detection, paise precision | ✅ DONE | `backend/src/services/fare.service.ts` |
| 6 | Provider scoring — reliability from historical success rate | ✅ DONE | `backend/src/services/provider-scoring.service.ts` |
| 7 | Booking state machine — SEARCHING → CONFIRMED → IN_PROGRESS → COMPLETED / FAILED / CANCELLED / MANUAL_ESCALATION | ✅ DONE | `backend/src/services/booking.service.ts` |
| 8 | Recovery service — 3-level retry, auto-escalation, ₹100 compensation credit | ✅ DONE | `backend/src/services/recovery.service.ts` |
| 9 | Quotes API — ranked options with reliability rationale | ✅ DONE | `backend/src/services/quotes.service.ts` |
| 10 | Booking API — create, poll status, cancel | ✅ DONE | `backend/src/controllers/booking.controller.ts` |
| 11 | Admin dashboard API — stats, provider list | ✅ DONE | `backend/src/controllers/admin.controller.ts` |
| 12 | Rate limiting, CORS, Helmet security headers | ✅ DONE | `backend/src/index.ts` |

### Phase 2 — Frontend Prototype ✅ (7/7)

| # | Task | Status | Key File(s) |
|---|------|--------|-------------|
| 13 | React + Vite scaffold with Zustand state management | ✅ DONE | `frontend/src/App.jsx` |
| 14 | 5-screen flow: Landing → Auth → Transport → Destination → Results | ✅ DONE | `frontend/src/App.jsx` |
| 15 | Transport mode selector — CAB (Economy/Comfort/Premium), Bike, Auto, Metro | ✅ DONE | `frontend/src/App.jsx` |
| 16 | Results screen — ranked quote cards with reliability score, ETA, price, tags | ✅ DONE | `frontend/src/App.jsx` |
| 17 | Auth store — OTP send/verify, JWT storage, auth state | ✅ DONE | `frontend/src/stores/authStore.ts` |
| 18 | Booking store — fetchQuotes, createBooking, Socket.IO state sync | ✅ DONE | `frontend/src/stores/bookingStore.ts` |
| 19 | API client (axios) with JWT header injection | ✅ DONE | `frontend/src/api/client.ts` |

### Phase 3 — Production Hardening ✅ (5/5)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 20 | WebSockets (Socket.IO) — `booking:state_changed` server-push, per-user rooms, JWT on handshake | ✅ DONE | `backend/src/config/socket.ts` |
| 21 | Google OAuth2 — direct REST flow, no Passport.js | ✅ DONE | `backend/src/controllers/oauth.controller.ts` |
| 22 | Mapbox geocoding autocomplete — 300ms debounce, India filter | ✅ DONE | `frontend/src/App.jsx` |
| 23 | Interactive map — react-map-gl, green/orange markers, auto-pan | ✅ DONE | `frontend/src/App.jsx` |
| 24 | Chennai preset location chips with real lat/lng | ✅ DONE | `frontend/src/App.jsx` |

### Phase 4 — Background Jobs / BullMQ ✅ (4/4)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 25 | BullMQ queue singletons — booking-timeout, recovery-retry, sms-dispatch, nightly-aggregation, ml-data-collection | ✅ DONE | `backend/src/config/queues.ts` |
| 26 | Booking timeout worker — auto-cancel SEARCHING after 5 min | ✅ DONE | `backend/src/workers/booking-timeout.worker.ts` |
| 27 | Recovery retry worker — async provider retry, 2s delay | ✅ DONE | `backend/src/workers/recovery.worker.ts` |
| 28 | SMS dispatch worker — 3 retries, exponential backoff, Twilio-ready (mock in dev) | ✅ DONE | `backend/src/workers/sms.worker.ts` |

### Phase 5 — Payments ✅ (5/5)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 29 | Razorpay — create payment link endpoint | ✅ DONE | `POST /api/v1/payments/create-link` |
| 30 | Razorpay — verify payment + HMAC-SHA256 signature check | ✅ DONE | `POST /api/v1/payments/verify` |
| 31 | Frontend — Razorpay Payment Link redirect + return detection | ✅ DONE | `frontend/src/App.jsx` |
| 32 | Provider payout tracking (T+2 terms) | ✅ DONE | `Payout` table, `payment.service.ts` |
| **NEW** | **Razorpay webhook handler** — server-to-server `payment_link.paid` event; HMAC-SHA256 verification; idempotent; auto-schedules T+2 payout | ✅ DONE | `POST /api/v1/payments/webhook`, `payment.service.ts` |

### Phase 9 — Admin Panel ✅ (5/5)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 33 | Full Admin Panel UI at `/admin` — 4 tabs: Dashboard, Escalations, Providers, Metrics | ✅ DONE | `frontend/src/Admin.jsx` |
| 34 | Live booking map — react-map-gl, color-coded markers by state | ✅ DONE | `frontend/src/Admin.jsx` |
| 35 | Provider management — list, pause/resume, add new provider | ✅ DONE | `frontend/src/Admin.jsx` |
| 36 | Manual escalation queue — ops confirms MANUAL_ESCALATION bookings | ✅ DONE | `frontend/src/Admin.jsx` |
| 37 | Analytics tab — today's booking states, weekly revenue, top providers | ✅ DONE | `frontend/src/Admin.jsx` |

### Phase 7 — Infrastructure (partial) ✅ (3/4)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 38 | Sentry error tracking — `@sentry/node` + `@sentry/react`, gated on env var | ✅ DONE | `backend/src/index.ts`, `frontend/src/main.jsx` |
| 39 | Neon.tech — cloud Postgres DATABASE_URL swap ready in `backend/.env` | ✅ DONE | `backend/.env` (commented format) |
| 40 | AWS S3 — presigned URL pattern, profile photo upload endpoint | ✅ DONE | `backend/src/services/s3.service.ts` |

### Phase 6 — Notifications (partial) ✅ (1/4)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 41 | Transactional email via Resend — confirmation, cancellation, compensation | ✅ DONE | `backend/src/services/email.service.ts` |

### Phase 10 — Mobile (partial) ✅ (1/6)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 42 | PWA — vite-plugin-pwa, service worker, web manifest, offline cache, installable | ✅ DONE | `frontend/vite.config.js` |

---

## SECTION 2 — Platform Features ⬜ (9/26 Done, 17 Remaining)

### Phase 6 — Notifications (remaining) 🔄 (1/4 done)

| # | Priority | Task | Notes |
|---|----------|------|-------|
| 43 | 🟠 | **Twilio SMS — real OTP delivery** — replace `console.log` mock in `sms.worker.ts` with Twilio client; verify India DLT sender ID | Needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| 44 | 🟢 | FCM push notifications — booking state changes, driver ETA | Needs React Native or PWA service worker + Firebase project |
| 45 | 🟡 | WhatsApp API via Twilio — booking alerts, driver confirmation | Same Twilio credentials, different endpoint; create message templates |

### Phase 7 — Infrastructure (remaining) 🔄 (3/4 done)

| # | Priority | Task | Notes |
|---|----------|------|-------|
| 46 | 🟡 | CDN — CloudFront or Cloudflare in front of S3 | Quick win ~1 hr after S3 verified |

### Phase 8 — Provider Integrations ⬜ (0/6 — all new)

| # | Priority | Task | File(s) |
|---|----------|------|---------|
| P0 | 🟠 | **Create `IProvider` interface + `ProviderRegistry`** — standard contract for all providers: `getEstimate()`, `checkAvailability()`, `bookRide?()` | `backend/src/services/providers/provider.interface.ts` NEW, `provider.registry.ts` NEW |
| 47 | 🟠 | **Fast Track Cabs integration** — WhatsApp Business API booking or manual confirmation flow; show price with "confirmation required" tag | `backend/src/services/providers/fasttrack.provider.ts` NEW |
| 48 | 🟠 | **Chennai Call Taxi integration** — same pattern as Fast Track | `backend/src/services/providers/chennai-call-taxi.provider.ts` NEW |
| 49 | 🟡 | Uber/Ola/Rapido aggregator fallback — reverse-engineer price estimate APIs (no booking); Redis cache 5 min; graceful fallback if unavailable | `uber.provider.ts`, `ola.provider.ts`, `rapido.provider.ts` NEW |
| 50 | 🟡 | Provider onboarding portal — KYC + doc upload UI; `s3.providerDocKey()` already wired | Admin UI new tab + upload flow |
| P1 | 🟠 | **Provider Health Dashboard** — new Admin tab: status, success rate, response time, rate limits per provider | `frontend/src/Admin.jsx`, `GET /api/v1/admin/providers/health` NEW |

### Phase 10 — Mobile Apps (remaining) 🔄 (1/6 done)

| # | Priority | Task | Notes |
|---|----------|------|-------|
| 51 | 🟢 | React Native user app — port 5-screen flow (Expo recommended) | Reuse existing API + WebSocket |
| 52 | 🟢 | React Native driver app — accept/reject rides, navigation | Separate app; driver-specific Socket.IO events |
| 53 | 🟢 | Driver location tracking — real-time GPS `driver:location_update` event | New event in `backend/src/config/socket.ts` |
| 54 | 🟢 | In-app FCM push notifications | Firebase + React Native Push Notification library |
| 55 | 🟢 | App Store + Play Store deployment | Expo EAS build |

---

## SECTION 3 — AI Intelligence Layer 🤖 (13/23 Done, 10 Remaining)

> **Achieved targets (post AI Week 1):** Booking success rate 75% → tracked. Confirmation time 45s → tracked.
> **Remaining target:** Revenue +10–15% via fair dynamic pricing (AI Week 3).

### AI Week 1 — Core AI Foundation ✅ (8/8)

| # | Task | Status | Files |
|---|------|--------|-------|
| AI-1 | TypeScript AI interfaces — `RideContext`, `ProviderMetrics`, `ReliabilityScore`, `ScoreBreakdown`, all enums | ✅ DONE | `backend/src/types/ai.types.ts` |
| AI-2 | Context Builder Service — Chennai zone detection, Haversine distance, peak hours, weekend, ride type | ✅ DONE | `backend/src/services/context-builder.service.ts` |
| AI-3 | Provider Metrics Service — hourly rates, recency windows (1h/6h/24h/7d), streaks, Redis 5-min cache | ✅ DONE | `backend/src/services/provider-metrics.service.ts` |
| AI-4 | Reliability Predictor — `predictReliability()` with 8 contextual adjustments | ✅ DONE | `backend/src/services/provider-scoring.service.ts` |
| AI-5 | Orchestration Service — `decideStrategy()` + `executeStrategy()` with SEQUENTIAL / PARALLEL_2 / PARALLEL_3 / CASCADE / EMERGENCY | ✅ DONE | `backend/src/services/ai/orchestration.service.ts` |
| AI-6 | Failure Detector Service — risk scoring, tiered interventions, ₹50 credit at riskScore ≥ 85 | ✅ DONE | `backend/src/services/ai/failure-detector.service.ts` |
| AI-7 | Prisma migration — AI fields on Booking + Provider | ✅ DONE | `backend/prisma/schema.prisma` |
| AI-8 | Wire AI into booking.service.ts — `assignWithAI()` with fallback to legacy `assignProvider()` | ✅ DONE | `backend/src/services/booking.service.ts` |

### AI Week 2 — Performance + Visible AI in UI ✅ (5/5)

| # | Priority | Task | Status | Files |
|---|----------|------|--------|-------|
| AI-9 | 🟠 | **Nightly Aggregation Worker** — BullMQ CRON at midnight; per-provider success rates; rolling reliability (90%+10%); invalidates Redis cache | ✅ DONE | `backend/src/workers/nightly-aggregation.worker.ts` |
| AI-10 | 🟠 | **Cache Service** — `getOrCompute(key, ttl, fn)` pattern; `CacheKeys` builder; `TTL` constants; `invalidateProviderScores()` | ✅ DONE | `backend/src/services/ai/cache.service.ts` |
| AI-11 | 🟠 | **ML Data Collection Worker** — triggers on COMPLETED/FAILED/CANCELLED; writes `MLTrainingData` row with context, scores, outcome, distance, hour, day | ✅ DONE | `backend/src/workers/ml-data.worker.ts` |
| AI-12 | 🟠 | **Prisma schema — AI Week 2 tables** — `ProviderMetricsCache` (Redis-backed aggregated metrics) + `MLTrainingData` (booking outcome training rows) | ✅ DONE | `backend/prisma/schema.prisma` |
| AI-13 | 🟠 | **Frontend AI-enhanced results screen** — reliability progress bar (green/yellow/red), AI reasoning text (`why`), emoji badges, MOVZZ score chip, animated booking status with orchestration strategy badge | ✅ DONE | `frontend/src/App.jsx` |

### AI Week 3 — Demand Forecasting + Fair Dynamic Pricing ⬜ (0/5)

| # | Priority | Task | Files |
|---|----------|------|-------|
| AI-14 | 🟡 | **Demand Forecaster Service** — pattern matching; per zone/hour: avg rides last 4 weeks, trend, day-of-week multiplier, Chennai events CSV, weather multiplier (rain +30%); outputs `predictedRides` + confidence interval | `backend/src/services/ai/demand-forecaster.service.ts` NEW |
| AI-15 | 🟡 | **Prisma migration — demand forecasts** — `DemandForecast` table (zone, forecastHour, predictedRides, confidence, actualRides, forecastAccuracy) | `backend/prisma/schema.prisma` |
| AI-16 | 🟡 | **Proactive driver positioning job** — nightly 24h forecasts; detect supply gaps; trigger WhatsApp/SMS to drivers in shortage zone with ₹100 bonus incentive | `backend/src/jobs/demand-forecast-update.job.ts` NEW |
| AI-17 | 🟡 | **Enhanced dynamic pricing** — demand multiplier +5–15%; weather: rain +8% / heavy +15% / storm +20%; traffic: low –5% / jam +12%; **hard cap: base × 1.2**; Movzz Pass users always get base fare | `backend/src/services/fare.service.ts` |
| AI-18 | 🟡 | **Pricing breakdown API + frontend** — quotes response adds `{ baseFare, breakdown: [{factor, amount}], explanation }`; "Why this price?" modal | `backend/src/controllers/booking.controller.ts`, `frontend/src/App.jsx` |

### AI Week 4 — Provider Analytics + User Personalization ⬜ (0/5)

| # | Priority | Task | Files |
|---|----------|------|-------|
| AI-19 | 🟢 | **Provider Analytics Service** — behavioral profiles: airport specialist, morning vs night, price-sensitive vs volume; human-readable recommendations | `backend/src/services/ai/provider-analytics.service.ts` NEW |
| AI-20 | 🟢 | **Provider Dashboard Endpoint** — `GET /api/v1/providers/:id/insights` — overallStats, bestTimes, preferredZones, earningsOptimization, aiInsights | `backend/src/controllers/provider-dashboard.controller.ts` NEW |
| AI-21 | 🟢 | **User Personalization Service** — favorite providers, commute detection, pre-book vs last-minute, price sensitivity; `GET /api/v1/users/me/recommendations` | `backend/src/services/ai/personalization.service.ts` NEW |
| AI-22 | 🟢 | **Prisma migration — personalization tables** — `UserPreference` + `UserPattern` | `backend/prisma/schema.prisma` |
| AI-23 | 🟢 | **Admin AI Dashboard** — orchestration strategy distribution, prediction accuracy, AI vs non-AI success rate, demand vs actual heatmap | `backend/src/controllers/admin.controller.ts`, `frontend/src/Admin.jsx` |

---

## SECTION 4 — Production & Deployment ⬜ (0/14 — All New)

> Required before any real users. Run after Section 0 security fixes are complete.

### Production Setup

| # | Priority | Task | Notes |
|---|----------|------|-------|
| D1 | 🔴 | **Railway project setup** — create Postgres + Redis + Node.js service; connect GitHub repo; auto-deploy on push | railway.app — ~₹3,000–5,000/month |
| D2 | 🔴 | **Frontend deploy to Vercel** — import repo; set `VITE_API_URL` to Railway backend URL; SSL auto-configured | Auto-deploys on every git push to main |
| D3 | 🔴 | **Domain setup** — buy movzz.in; point DNS to Railway/Vercel; SSL configured automatically | ₹500–1,000/year |
| D4 | 🔴 | **Production DB migration** — run `npx prisma migrate deploy` on Railway; seed initial data: Chennai zones, transport modes, base fare rates, provider list | Railway console |
| D5 | 🔴 | **Set all production env vars** — JWT_SECRET (64-char random), Razorpay live keys, Twilio, Resend, Mapbox, Sentry DSNs, Google OAuth callback URL, RAZORPAY_WEBHOOK_SECRET | Railway dashboard env vars |
| D6 | 🟠 | **Razorpay production activation** — switch test → live keys; complete KYC (2–3 business days); set webhook `https://movzz.in/api/v1/payments/webhook`; test ₹1 live transaction | Razorpay dashboard |
| D7 | 🟠 | **Seed first admin user** — `UPDATE "User" SET role = 'admin' WHERE phone = '+91...'` via Prisma | Production DB |

### Testing

| # | Priority | Task | Notes |
|---|----------|------|-------|
| D8 | 🟠 | **Load testing (k6)** — ramp 10 → 50 → 100 concurrent users; target: 95% requests < 2s, 0% error, CPU < 70% | `backend/tests/load-test.js` NEW |
| D9 | 🟠 | **End-to-end user testing** — 5–10 testers; flow: signup → OTP → quote → booking → SMS → status update | Manual test plan |
| D10 | 🟠 | **Mobile responsiveness audit** — iPhone Safari + Android Chrome; min 44×44px touch targets; no horizontal scroll | Chrome DevTools + real devices |

### Legal & Documentation

| # | Priority | Task | Notes |
|---|----------|------|-------|
| D11 | 🟠 | **Terms of Service** — termly.io template; customize for ride-booking and reliability guarantee | `frontend/src/pages/Terms.jsx` NEW |
| D12 | 🟠 | **Privacy Policy** — DPDP Act (India) compliance basics | `frontend/src/pages/Privacy.jsx` NEW |
| D13 | 🟡 | **User FAQ / Help Center** — 4 sections: Getting Started, Pricing, Reliability, Account | `frontend/src/pages/Help.jsx` NEW |
| D14 | 🟡 | **Env documentation** — fully document all env vars in both `.env.example` files; update README with local setup | `backend/.env.example`, `frontend/.env.example`, `README.md` |

---

## SECTION 5 — Execution Order Summary

```
COMPLETED ✅:
  S1–S11                       ← Security hardening (all 11 done)
  #1–#42                       ← Full foundation (all 33 + webhook done)
  AI-1 through AI-13           ← AI Week 1 + Week 2 (13/23 done)
  Razorpay webhook             ← Server-to-server payment confirmation

NEXT (before beta):
  #43                          ← 🟠 Real Twilio OTP (users cannot sign up without it)
  P0 #47 #48                   ← 🟠 Provider interface + first 2 real providers
  P1                           ← 🟠 Provider health dashboard
  D1 D2 D3 D4 D5              ← 🔴 Deploy to production
  D6 D7 D8 D9 D10             ← 🟠 Activate services + test
  D11 D12                      ← 🟠 Legal (Terms + Privacy)

POST-LAUNCH:
  #49 #50                      ← 🟡 Uber/Ola/Rapido + provider onboarding
  #45 #46                      ← 🟡 WhatsApp + CDN
  AI-14 AI-15 AI-16 AI-17 AI-18 ← 🟡 AI Week 3 (demand forecasting + dynamic pricing)
  D13 D14                      ← 🟡 FAQ + env docs
  AI-19 AI-20 AI-21 AI-22 AI-23 ← 🟢 AI Week 4 (analytics + personalization)
  #44 #51 #52 #53 #54 #55     ← 🟢 FCM + React Native mobile apps
```

---

## AI Success Metrics (Track Weekly After AI Week 1)

| Metric | Baseline | Target (Post-AI) |
|--------|---------|-----------------|
| Booking success rate | ~75% | 92%+ |
| Avg time to confirmation | ~45 seconds | <20 seconds |
| Rides needing manual ops | ~20% | <5% |
| AI prediction accuracy | — | >90% (predicted vs actual outcome) |
| Revenue from dynamic pricing | 0% | +10–15% (AI Week 3) |
| User satisfaction (avg rating) | ~4.2 | 4.7+ |

---

*MOVZZ Master Roadmap · March 10, 2026 · **67/108 tasks done (62%)***
