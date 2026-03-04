# MOVZZ — Master Roadmap

> Reliability-Orchestrated Mobility Platform · Chennai, India
> Last updated: March 2026

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ DONE | Implemented and working |
| 🔄 IN PROGRESS | Partially implemented |
| ⬜ TODO | Not yet started |
| 🤖 AI | New AI engine task (from AI Implementation Plan) |

---

## Grand Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Section 1 — Foundation | 33 | 33 | 0 |
| Section 2 — Platform Features | 22 | 9 | 13 |
| Section 3 — AI Intelligence Layer | 23 | 8 | 15 |
| **TOTAL** | **78** | **50** | **28** |

**Progress: 50/78 tasks (64%)**

---

## SECTION 1 — Foundation (33/33 Complete ✅)

### Phase 1 — Core Backend (12/12 ✅)

| # | Task | Status | Key File(s) |
|---|------|--------|-------------|
| 1 | Express + TypeScript + Prisma scaffold | ✅ DONE | `backend/src/index.ts` |
| 2 | PostgreSQL schema — Users, Providers, Bookings, BookingAttempts, BookingLogs | ✅ DONE | `backend/prisma/schema.prisma` |
| 3 | Redis cache with in-memory fallback | ✅ DONE | `backend/src/config/redis.ts` |
| 4 | OTP authentication (phone) with JWT | ✅ DONE | `backend/src/controllers/auth.controller.ts` |
| 5 | Fare engine — mode-specific rates, surge, Haversine×1.35, airport detection, paise precision | ✅ DONE | `backend/src/services/fare.service.ts` |
| 6 | Provider scoring — basic reliability from historical success rate | ✅ DONE | `backend/src/services/provider-scoring.service.ts` |
| 7 | Booking state machine — SEARCHING → CONFIRMED → IN_PROGRESS → COMPLETED / FAILED / CANCELLED / MANUAL_ESCALATION | ✅ DONE | `backend/src/services/booking.service.ts` |
| 8 | Recovery service — 3-level retry, auto-escalation, ₹100 compensation credit | ✅ DONE | `backend/src/services/recovery.service.ts` |
| 9 | Quotes API — ranked options with reliability rationale | ✅ DONE | `backend/src/services/quotes.service.ts` |
| 10 | Booking API — create, poll status, cancel | ✅ DONE | `backend/src/controllers/booking.controller.ts` |
| 11 | Admin dashboard API — stats, provider list | ✅ DONE | `backend/src/controllers/admin.controller.ts` |
| 12 | Rate limiting, CORS, Helmet security headers | ✅ DONE | `backend/src/index.ts` |

---

### Phase 2 — Frontend Prototype (7/7 ✅)

| # | Task | Status | Key File(s) |
|---|------|--------|-------------|
| 13 | React + Vite scaffold with Zustand state management | ✅ DONE | `frontend/src/App.jsx` |
| 14 | 5-screen flow: Landing → Auth → Transport → Destination → Results | ✅ DONE | `frontend/src/App.jsx` |
| 15 | Transport mode selector — CAB (Economy/Comfort/Premium), Bike, Auto, Metro | ✅ DONE | `frontend/src/App.jsx` |
| 16 | Results screen — ranked quote cards with reliability score, ETA, price, tags (BEST / CHEAPEST / PREMIUM) | ✅ DONE | `frontend/src/App.jsx` |
| 17 | Auth store — OTP send/verify, JWT storage, auth state | ✅ DONE | `frontend/src/stores/authStore.ts` |
| 18 | Booking store — fetchQuotes, createBooking, Socket.IO state sync | ✅ DONE | `frontend/src/stores/bookingStore.ts` |
| 19 | API client (axios) with JWT header injection | ✅ DONE | `frontend/src/api/client.ts` |

---

### Phase 3 — Production Hardening (5/5 ✅)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 20 | WebSockets (Socket.IO) — `booking:state_changed` server-push, per-user rooms, JWT on handshake | ✅ DONE | `backend/src/config/socket.ts`, `frontend/src/stores/bookingStore.ts` |
| 21 | Google OAuth2 — direct REST flow, no Passport.js, `phone = "oauth_google_<sub>"` | ✅ DONE | `backend/src/controllers/oauth.controller.ts` |
| 22 | Mapbox geocoding autocomplete — 300ms debounce, India filter, `onMouseDown` before blur | ✅ DONE | `frontend/src/App.jsx` |
| 23 | Interactive map — react-map-gl, green (pickup) + orange (dropoff) markers, auto-pan on coord change | ✅ DONE | `frontend/src/App.jsx` |
| 24 | Chennai preset location chips with real lat/lng coordinates | ✅ DONE | `frontend/src/App.jsx` |

---

### Phase 4 — Background Jobs / BullMQ (4/4 ✅)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 25 | BullMQ queue singletons — booking-timeout, recovery-retry, sms-dispatch | ✅ DONE | `backend/src/config/queues.ts` |
| 26 | Booking timeout worker — auto-cancel SEARCHING after 5 min, issue compensation | ✅ DONE | `backend/src/workers/booking-timeout.worker.ts` |
| 27 | Recovery retry worker — async provider retry, 2s delay, delegates to 3-level retry | ✅ DONE | `backend/src/workers/recovery.worker.ts` |
| 28 | SMS dispatch worker — 3 retries, exponential backoff, Twilio-ready (mock in dev) | ✅ DONE | `backend/src/workers/sms.worker.ts` |

---

### Phase 9 — Admin Panel (5/5 ✅)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 29 | Full Admin Panel UI at `/admin` — 4 tabs: Dashboard, Escalations, Providers, Metrics | ✅ DONE | `frontend/src/Admin.jsx` |
| 30 | Live booking map — react-map-gl, color-coded markers by state, 10s poll + Socket.IO push | ✅ DONE | `frontend/src/Admin.jsx`, `backend/src/controllers/admin.controller.ts` |
| 31 | Provider management — list, pause/resume, add new provider form | ✅ DONE | `frontend/src/Admin.jsx` |
| 32 | Manual escalation queue — ops confirms MANUAL_ESCALATION bookings with provider ID | ✅ DONE | `frontend/src/Admin.jsx` |
| 33 | Analytics tab — today's booking states, weekly revenue, top providers | ✅ DONE | `frontend/src/Admin.jsx` |

---

### Phase 7 — Infrastructure (3/4 ✅)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 34 | Sentry error tracking — `@sentry/node` + `@sentry/react`, real DSN active, gated on env var | ✅ DONE | `backend/src/index.ts`, `frontend/src/main.jsx` |
| 35 | Neon.tech — cloud Postgres DATABASE_URL swap ready in `backend/.env` | ✅ DONE | `backend/.env` (commented format) |
| 36 | AWS S3 — presigned URL pattern, profile photo upload endpoint, avatar in app header | ✅ DONE | `backend/src/services/s3.service.ts`, `backend/src/controllers/upload.controller.ts` |

---

### Phase 6 — Notifications (1/4 ✅)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 37 | Transactional email via Resend — confirmation, cancellation, compensation; fire-and-forget on state transitions | ✅ DONE | `backend/src/services/email.service.ts`, `RESEND_API_KEY` set |

---

### Phase 10 — Mobile (1/6 ✅)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 38 | PWA — vite-plugin-pwa, service worker, web manifest, offline cache, installable on Android/iOS | ✅ DONE | `frontend/vite.config.js`, `vite-plugin-pwa` |

---

## SECTION 2 — Platform Features (5/22 Done, 17 Remaining)

### Phase 5 — Payments ✅ (4/4)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 39 | Razorpay — create payment link endpoint | ✅ DONE | `POST /api/v1/payments/create-link` · Payment Links API (rzp.io/l/...) |
| 40 | Razorpay — verify payment + HMAC-SHA256 signature check | ✅ DONE | `POST /api/v1/payments/verify` · sets `paidAt` on Booking |
| 41 | Frontend — Razorpay Payment Link redirect | ✅ DONE | `window.location.href = shortUrl` · return detection via URL params on mount |
| 42 | Provider payout tracking (T+2 terms) | ✅ DONE | `Payout` table, `scheduleProviderPayout()` in `payment.service.ts` |

---

### Phase 6 — Notifications (remaining) 🔄 (1/4 done)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 43 | Twilio SMS — real OTP delivery | ⬜ TODO | Replace `console.log` mock in `sms.worker.ts` · needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| 44 | FCM push notifications — booking state changes, driver ETA | ⬜ TODO | Needs React Native or PWA service worker |
| 45 | WhatsApp API via Twilio | ⬜ TODO | Same Twilio credentials, different endpoint |

---

### Phase 7 — Infrastructure (remaining) 🔄 (3/4 done)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 46 | CDN — CloudFront or Cloudflare in front of S3 | ⬜ TODO | Static asset delivery for frontend + S3 files |

---

### Phase 8 — Provider Integrations ⬜ (0/4)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 47 | Fast Track Cabs API integration | ⬜ TODO | Real provider dispatch instead of mock scoring |
| 48 | Chennai Call Taxi API integration | ⬜ TODO | Local fleet operator |
| 49 | Uber/Ola aggregator fallback | ⬜ TODO | When all MOVZZ providers fail — last resort layer |
| 50 | Provider onboarding portal — KYC + doc upload | ⬜ TODO | S3 `providerDocKey()` already wired, needs admin UI + flow |

---

### Phase 10 — Mobile Apps (remaining) 🔄 (1/6 done)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 51 | React Native user app — port 5-screen flow | ⬜ TODO | Expo recommended · reuse existing API + WebSocket |
| 52 | React Native driver app — accept/reject rides, navigation | ⬜ TODO | Separate app with driver-specific Socket.IO events |
| 53 | Driver location tracking — real-time GPS updates | ⬜ TODO | New `driver:location_update` Socket.IO event |
| 54 | In-app FCM push notifications | ⬜ TODO | Firebase + React Native Push Notification library |
| 55 | App Store + Play Store deployment | ⬜ TODO | Expo EAS build |

---

## SECTION 3 — AI Intelligence Layer 🤖 (0/23 — All New)

> **Current state:** Provider scoring uses a basic historical success rate. No context, no orchestration strategy, no demand forecasting, no dynamic pricing.
>
> This section implements 7 AI engines across 4 weeks to transform MOVZZ into a true reliability-orchestrated platform.
>
> **Target outcomes:** Booking success rate 75% → 92%+, confirmation time 45s → <20s, revenue +10–15% via fair pricing.

---

### Week 1 — Core AI Foundation ✅ (8/8)

| # | Task | Status | Files |
|---|------|--------|-------|
| AI-1 | TypeScript AI interfaces | ✅ DONE | `backend/src/types/ai.types.ts` — `RideContext`, `ProviderMetrics`, `ReliabilityScore`, `ScoreBreakdown`, `Zone`, `WeatherCondition`, `OrchestrationStrategy` enums |
| AI-2 | Context Builder Service | ✅ DONE | `backend/src/services/context-builder.service.ts` — Chennai zone detection, Haversine distance, peak hours, weekend, ride type |
| AI-3 | Provider Metrics Service | ✅ DONE | `backend/src/services/provider-metrics.service.ts` — hourly rates, recency windows (1h/6h/24h/7d), streaks, Redis 5-min cache |
| AI-4 | Reliability Predictor | ✅ DONE | `backend/src/services/provider-scoring.service.ts` — `predictReliability()` added; 8 contextual adjustments; existing functions untouched |
| AI-5 | Orchestration Service | ✅ DONE | `backend/src/services/ai/orchestration.service.ts` — `decideStrategy()` + `executeStrategy()` with SEQUENTIAL/PARALLEL_2/PARALLEL_3/CASCADE/EMERGENCY |
| AI-6 | Failure Detector Service | ✅ DONE | `backend/src/services/ai/failure-detector.service.ts` — risk scoring, tiered interventions, ₹50 credit at riskScore ≥ 85 |
| AI-7 | Prisma migration — AI fields | ✅ DONE | `schema.prisma` — `orchestrationStrategy`, `aiReliabilityScore`, `contextSnapshot`, `timeToConfirm` on Booking; `currentActiveRides`, `maxCapacity` on Provider |
| AI-8 | Wire AI into booking.service.ts | ✅ DONE | `backend/src/services/booking.service.ts` — `assignWithAI()` replaces `assignProvider()` with AI path + fallback |

---

### Week 2 — Performance + Visible AI in UI (0/5) ⬜

| # | Task | Status | Files |
|---|------|--------|-------|
| AI-9 | Nightly Aggregation Job | ⬜ TODO | `backend/src/jobs/nightly-aggregation.job.ts` NEW · BullMQ cron at 2 AM · per-provider: success rates by hour/day/zone/distance range, last 24h/7d rates, preferred zones · stores in `ProviderMetricsCache` table · Redis also updated |
| AI-10 | Cache Service | ⬜ TODO | `backend/src/services/cache.service.ts` NEW · `getOrCompute(key, ttl, fn)` pattern · key prefixes: `provider:{id}:metrics` (5min), `context:weather:{lat},{lng}` (30min), `context:traffic` (5min), `zone:mapping` (1day) |
| AI-11 | ML Data Collection Worker | ⬜ TODO | `backend/src/workers/ml-data-collection.worker.ts` NEW · triggers after COMPLETED/FAILED · logs: full RideContext, all provider scores at time of booking, selected provider, orchestration strategy, actual outcome, `timeToConfirm`, `timeToComplete` · stored in `MLTrainingData` table |
| AI-12 | Prisma migration — cache + ML tables | ⬜ TODO | `backend/prisma/schema.prisma` · new: `ProviderMetricsCache` (providerId, metricType, metricKey, metricValue, computedAt, unique constraint) · new: `MLTrainingData` (contextSnapshot Json, providerScores Json, selectedProviderId, orchestrationStrategy, actualOutcome, timeToConfirm) |
| AI-13 | Frontend — AI-enhanced Results screen | ⬜ TODO | `frontend/src/App.jsx` MODIFY · reliability score progress bar (green >90 / yellow >75 / red <75) · AI reasoning text below each quote card · tags as colored badges (MOST_RELIABLE / CHEAPEST / PREMIUM) · new Socket.IO events: `booking:ai_decision`, `booking:provider_queried`, `booking:failure_risk_update` · live status text: "Analyzing providers…" → "Querying Fast Track…" → "Confirmed!" |

---

### Week 3 — Demand Forecasting + Fair Dynamic Pricing (0/5) ⬜

| # | Task | Status | Files |
|---|------|--------|-------|
| AI-14 | Demand Forecaster Service | ⬜ TODO | `backend/src/services/ai/demand-forecaster.service.ts` NEW · pattern matching (no ML yet) · per zone/hour: avg rides last 4 weeks same day/hour, trend (increasing/decreasing), day-of-week multiplier, event multiplier (manual CSV of Chennai events: concerts, cricket, holidays), weather multiplier (rain +30%) · outputs: predictedRides + confidenceLow/High interval |
| AI-15 | Prisma migration — demand forecasts | ⬜ TODO | `backend/prisma/schema.prisma` · new: `DemandForecast` (zone, forecastHour DateTime, predictedRides Float, confidenceLow Float, confidenceHigh Float, actualRides Int?, forecastAccuracy Float?, unique on zone+forecastHour) |
| AI-16 | Proactive driver positioning job | ⬜ TODO | `backend/src/jobs/demand-forecast-update.job.ts` NEW · nightly: generate 24h forecasts, detect supply gaps (predictedRides > available drivers in zone) · trigger: WhatsApp/SMS to drivers in shortage zone ("High demand 6–9 AM Airport. ₹100 bonus per ride") · track effectiveness in DB |
| AI-17 | Enhanced fare.service.ts — dynamic pricing | ⬜ TODO | `backend/src/services/fare.service.ts` ENHANCE · add demand multiplier (+5–15%, demand > supply) · weather: clear 0% / rain +8% / heavy rain +15% / storm +20% · traffic: low –5% / high +8% / jam +12% · time-of-day: late-night +10% / peak +5% · **hard cap: base fare × 1.2 max (never more than +20%)** · Movzz Pass users always get base fare (no surge) |
| AI-18 | Pricing breakdown API + frontend | ⬜ TODO | `backend/src/controllers/booking.controller.ts` MODIFY · quotes response adds: `{ fareEstimate, baseFare, breakdown: [{factor, amount}], explanation }` · `frontend/src/App.jsx`: tap quote card → show pricing breakdown modal with "Why this price?" explanation |

---

### Week 4 — Provider Analytics + User Personalization (0/5) ⬜

| # | Task | Status | Files |
|---|------|--------|-------|
| AI-19 | Provider Analytics Service | ⬜ TODO | `backend/src/services/ai/provider-analytics.service.ts` NEW · mine acceptance patterns (which zones/distances/fares accepted most) · behavioral profiles: airport specialist, short-ride vs long-distance, morning person vs night owl, price-sensitive vs volume-focused · outputs: human-readable recommendations ("Send them more airport rides 6–9 AM") |
| AI-20 | Provider Dashboard Endpoint | ⬜ TODO | `backend/src/controllers/provider-dashboard.controller.ts` NEW · `GET /api/v1/providers/:id/insights` · response: `overallStats`, `yourBestTimes[]`, `yourPreferredZones[]`, `earningsOptimization { recommendation, potential }`, `aiInsights[]` |
| AI-21 | User Personalization Service | ⬜ TODO | `backend/src/services/ai/personalization.service.ts` NEW · `buildUserProfile(userId)`: favorite providers (repeat 5-star), commute detection (same route weekly), pre-book vs last-minute, price sensitivity · `GET /api/v1/users/me/recommendations`: pre-filled route, suggested provider, Movzz Pass upsell if 12+ rides/month |
| AI-22 | Prisma migration — personalization tables | ⬜ TODO | `backend/prisma/schema.prisma` · new: `UserPreference` (userId, preferenceType, preferenceKey, preferenceValue, confidence Float, learnedAt, lastUsedAt, unique on userId+type+key) · new: `UserPattern` (userId, patternType, patternData Json, confidence Float, detectedAt, lastOccurrence) |
| AI-23 | Admin AI Dashboard | ⬜ TODO | `backend/src/controllers/admin.controller.ts` ENHANCE + `frontend/src/Admin.jsx` MODIFY · new endpoints: `GET /admin/ai-performance` (orchestration strategy distribution, prediction accuracy, success rate with vs without AI) · `GET /admin/demand-insights` (forecast vs actual, supply shortage alerts, zone-by-hour heatmap) · `GET /admin/provider-rankings` (top 10 reliable, underperforming list) · Admin panel: new AI Performance tab with charts |

---

## SECTION 4 — Summary by Phase

| Phase | Description | Total | Done | Status |
|-------|-------------|-------|------|--------|
| 1 | Core Backend | 12 | 12 | ✅ Complete |
| 2 | Frontend Prototype | 7 | 7 | ✅ Complete |
| 3 | Production Hardening | 5 | 5 | ✅ Complete |
| 4 | Background Jobs (BullMQ) | 4 | 4 | ✅ Complete |
| 5 | Payments (Razorpay) | 4 | 4 | ✅ Complete |
| 6 | Notifications | 4 | 1 | 🔄 In progress |
| 7 | Infrastructure | 4 | 3 | 🔄 In progress |
| 8 | Provider Integrations | 4 | 0 | ⬜ Not started |
| 9 | Admin Panel | 5 | 5 | ✅ Complete |
| 10 | Mobile Apps | 6 | 1 | 🔄 In progress |
| AI Week 1 | Core AI (Reliability + Orchestration + Failure Detection) | 8 | 8 | ✅ Complete |
| AI Week 2 | Performance + ML Data + AI in UI | 5 | 0 | ⬜ Not started |
| AI Week 3 | Demand Forecasting + Dynamic Pricing | 5 | 0 | ⬜ Not started |
| AI Week 4 | Analytics + Personalization | 5 | 0 | ⬜ Not started |
| **TOTAL** | | **78** | **50** | **64% done** |

---

## SECTION 5 — Recommended Priority Order

| Priority | Task(s) | Effort | Rationale |
|----------|---------|--------|-----------|
| **1** | Twilio SMS — real OTP (#43) | 2 hrs | OTP is still `console.log` — no real user can sign up |
| **2** | Razorpay payments (#39–41) | 1 day | Core revenue flow — nothing monetizes without it |
| **3** | AI Week 1 — Core AI (#AI-1 to AI-8) | 1 week | Biggest product differentiator; enables orchestration + failure prevention |
| **4** | AI Week 2 — Performance + UI (#AI-9 to AI-13) | 1 week | Makes AI visible to users; scores and reasoning shown in results screen |
| **5** | CDN (#46) | 1 hr | Quick win — CloudFront/Cloudflare in front of S3 |
| **6** | AI Week 3 — Forecasting + Pricing (#AI-14 to AI-18) | 1 week | Revenue optimization + proactive driver supply management |
| **7** | AI Week 4 — Analytics + Personalization (#AI-19 to AI-23) | 1 week | Provider retention + user engagement |
| **8** | WhatsApp notifications (#45) | 2 hrs | Ride alerts via WhatsApp (Twilio, same credentials) |
| **9** | Provider integrations (#47–50) | 2 days | Real dispatch network beyond mock scoring |
| **10** | React Native (#51–55) | 3–4 weeks | Full mobile product for both users and drivers |

---

## AI Success Metrics (Track Weekly After AI Week 1)

| Metric | Baseline (Now) | Target (Post-AI) |
|--------|---------------|-----------------|
| Booking success rate | ~75% | 92%+ |
| Avg time to confirmation | ~45 seconds | <20 seconds |
| Rides needing manual ops | ~20% | <5% |
| AI prediction accuracy | — | >90% (predicted vs actual outcome) |
| Revenue from dynamic pricing | 0% | +10–15% |
| User satisfaction (avg rating) | ~4.2 | 4.7+ |

---

*MOVZZ Master Roadmap · March 2026 · **50/78 tasks done (64%)***
