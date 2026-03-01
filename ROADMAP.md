# MOVZZ — Full Product Roadmap

> Reliability-Orchestrated Mobility Platform · Chennai, India
> Last updated: March 2026

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ DONE | Implemented and working |
| 🔄 IN PROGRESS | Partially implemented |
| ⬜ TODO | Not yet started |

---

## Phase 1 — Core Backend Foundation ✅

| # | Task | Status | Key Files |
|---|------|--------|-----------|
| 1 | Project scaffold (Express + TypeScript + Prisma) | ✅ DONE | `backend/src/index.ts`, `prisma/schema.prisma` |
| 2 | PostgreSQL schema — Users, Providers, Bookings, BookingAttempts, BookingLogs | ✅ DONE | `prisma/schema.prisma` |
| 3 | Redis cache (ioredis) with in-memory fallback | ✅ DONE | `backend/src/config/redis.ts` |
| 4 | OTP authentication (phone + email) with JWT | ✅ DONE | `backend/src/controllers/auth.controller.ts` |
| 5 | Fare engine — mode-specific rates, surge pricing, Haversine × 1.35 road factor, airport detection | ✅ DONE | `backend/src/services/fare.service.ts` |
| 6 | Provider scoring — reliability score from historical metrics | ✅ DONE | `backend/src/services/provider-scoring.service.ts` |
| 7 | Booking state machine — SEARCHING → CONFIRMED → IN_PROGRESS → COMPLETED / FAILED / CANCELLED / MANUAL_ESCALATION | ✅ DONE | `backend/src/services/booking.service.ts` |
| 8 | Recovery service — 3-level retry, auto-escalation to ops, ₹100 compensation credit | ✅ DONE | `backend/src/services/recovery.service.ts` |
| 9 | Quotes API — ranked ride options with reliability rationale | ✅ DONE | `backend/src/services/quotes.service.ts` |
| 10 | Booking API — create, poll status, cancel | ✅ DONE | `backend/src/controllers/booking.controller.ts` |
| 11 | Admin dashboard API — overview stats, provider list | ✅ DONE | `backend/src/controllers/admin.controller.ts` |
| 12 | Rate limiting, CORS, Helmet security headers | ✅ DONE | `backend/src/index.ts` |

---

## Phase 2 — Frontend Prototype ✅

| # | Task | Status | Key Files |
|---|------|--------|-----------|
| 13 | React + Vite scaffold with Zustand state management | ✅ DONE | `frontend/src/App.jsx` |
| 14 | 5-screen flow: Landing → Auth → Transport → Destination → Results | ✅ DONE | `frontend/src/App.jsx` |
| 15 | Transport mode selector — CAB (Economy/Comfort/Premium), Bike, Auto, Metro | ✅ DONE | `frontend/src/App.jsx` |
| 16 | Results screen — ranked quote cards with reliability score, ETA, price, tags (BEST / CHEAPEST / PREMIUM) | ✅ DONE | `frontend/src/App.jsx` |
| 17 | Auth store — OTP send/verify, JWT storage, auth state | ✅ DONE | `frontend/src/stores/authStore.ts` |
| 18 | Booking store — fetchQuotes, createBooking, Socket.IO state sync | ✅ DONE | `frontend/src/stores/bookingStore.ts` |
| 19 | API client (axios) with JWT header injection | ✅ DONE | `frontend/src/api/client.ts` |

---

## Phase 3 — Production Hardening ✅

| # | Task | Status | Key Files |
|---|------|--------|-----------|
| 20 | WebSockets (Socket.IO) — replaced 5-second polling with server-push `booking:state_changed` events | ✅ DONE | `backend/src/config/socket.ts`, `frontend/src/stores/bookingStore.ts` |
| 21 | Google OAuth2 (no Passport.js) — direct REST flow, id_token decode, JWT return | ✅ DONE | `backend/src/controllers/oauth.controller.ts` |
| 22 | Mapbox geocoding autocomplete — 300ms debounce, suggestion dropdowns | ✅ DONE | `frontend/src/App.jsx` |
| 23 | Interactive map — react-map-gl with green (pickup) and orange (dropoff) markers, auto-pan | ✅ DONE | `frontend/src/App.jsx` |
| 24 | Chennai-preset location chips with real coordinates | ✅ DONE | `frontend/src/App.jsx` |

---

## Phase 4 — Background Jobs ✅

| # | Task | Status | Key Files |
|---|------|--------|-----------|
| 25 | BullMQ queue singletons — booking-timeout, recovery-retry, sms-dispatch | ✅ DONE | `backend/src/config/queues.ts` |
| 26 | Booking timeout worker — auto-cancel bookings stuck in SEARCHING after 5 minutes + issue compensation | ✅ DONE | `backend/src/workers/booking-timeout.worker.ts` |
| 27 | Recovery retry worker — async provider retry with 2s delay, delegates to existing 3-level retry logic | ✅ DONE | `backend/src/workers/recovery.worker.ts` |
| 28 | SMS dispatch worker — retryable OTP delivery (3 attempts, exponential backoff), Twilio-ready | ✅ DONE | `backend/src/workers/sms.worker.ts` |

---

## Phase 5 — Payments ⬜

| # | Task | Status | Notes |
|---|------|--------|-------|
| 29 | Razorpay — create order endpoint | ⬜ TODO | `POST /api/v1/payments/create-order` · needs `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` |
| 30 | Razorpay — verify payment endpoint + HMAC-SHA256 signature check | ⬜ TODO | `POST /api/v1/payments/verify` · transitions booking to CONFIRMED on success |
| 31 | Frontend — Razorpay Web Checkout modal (CDN script, no new npm) | ⬜ TODO | Opens after `createBooking()` succeeds; test card 4111 1111 1111 1111 |
| 32 | Provider payout tracking (T+2 terms) | ⬜ TODO | Prisma schema addition — `ProviderPayout` table |

---

## Phase 6 — Notifications 🔄

| # | Task | Status | Notes |
|---|------|--------|-------|
| 33 | Twilio SMS — replace mock OTP delivery in sms.worker.ts | ⬜ TODO | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` env vars |
| 34 | Transactional email — booking confirmation, cancellation, compensation | ✅ DONE | `resend` · `RESEND_API_KEY` set · `backend/src/services/email.service.ts` · fires on state transitions |
| 35 | FCM push notifications — booking state changes, driver ETA updates | ⬜ TODO | Requires React Native or PWA service worker |
| 36 | WhatsApp API notifications via Twilio | ⬜ TODO | Same Twilio credentials, different endpoint |

---

## Phase 7 — Error Monitoring & Infrastructure 🔄

| # | Task | Status | Notes |
|---|------|--------|-------|
| 37 | Sentry — error tracking for backend + frontend | ✅ DONE | `@sentry/node` + `@sentry/react` · `SENTRY_DSN` set and active |
| 38 | Neon.tech — migrate from local Postgres to cloud | ✅ DONE | `DATABASE_URL` swap ready in `backend/.env` (cloud format commented) |
| 39 | AWS S3 — profile photos, document uploads | ✅ DONE | `@aws-sdk/client-s3` + presigner · `s3.service.ts` · `POST /upload/presign` · `PUT /upload/users/me/photo` · avatar in app header |
| 40 | CDN — static asset delivery for frontend | ⬜ TODO | CloudFront or Cloudflare in front of S3 |

---

## Phase 8 — Provider Integrations ⬜

| # | Task | Status | Notes |
|---|------|--------|-------|
| 41 | Fast Track Cabs API integration | ⬜ TODO | Real provider dispatch instead of mock scoring |
| 42 | Chennai Call Taxi API integration | ⬜ TODO | Local fleet operator |
| 43 | Uber/Ola API fallback (when all MOVZZ providers fail) | ⬜ TODO | Aggregator fallback layer |
| 44 | Provider onboarding portal — document upload, KYC | ⬜ TODO | Admin-side flow · S3 provider_doc upload already wired |

---

## Phase 9 — Admin Panel ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 45 | Full admin dashboard UI | ✅ DONE | `frontend/src/Admin.jsx` · accessible at `/admin` |
| 46 | Live booking map — all active bookings on a map | ✅ DONE | `GET /api/v1/admin/bookings/active` · react-map-gl markers · color-coded by state · 10s poll + Socket.IO push |
| 47 | Provider management — add/edit/deactivate, reliability history | ✅ DONE | Providers tab — list, pause/resume, add new |
| 48 | Manual escalation queue — ops team resolves MANUAL_ESCALATION bookings | ✅ DONE | Escalations tab — paste provider ID to manually assign |
| 49 | Analytics dashboard — daily rides, revenue, reliability trends | ✅ DONE | Metrics tab — today's states, weekly revenue, top providers |

---

## Phase 10 — Mobile Apps 🔄

| # | Task | Status | Notes |
|---|------|--------|-------|
| 50 | PWA — installable web app on Android/iOS | ✅ DONE | `vite-plugin-pwa` · service worker + manifest · SVG icons · offline cache |
| 51 | React Native user app — port existing 5-screen web flow | ⬜ TODO | Expo recommended; reuse existing API + WebSocket |
| 52 | React Native driver app — accept/reject rides, navigation | ⬜ TODO | Separate app with driver-specific Socket.IO events |
| 53 | Driver location tracking — real-time GPS updates | ⬜ TODO | New `driver:location_update` Socket.IO event |
| 54 | In-app FCM push notifications | ⬜ TODO | Firebase + React Native Push Notification library |
| 55 | App Store + Play Store deployment | ⬜ TODO | Expo EAS build |

---

## Summary

| Phase | Description | Tasks | Done | Status |
|-------|-------------|-------|------|--------|
| 1 | Core Backend Foundation | 12 | 12 | ✅ Complete |
| 2 | Frontend Prototype | 7 | 7 | ✅ Complete |
| 3 | Production Hardening | 5 | 5 | ✅ Complete |
| 4 | Background Jobs (BullMQ) | 4 | 4 | ✅ Complete |
| 5 | Payments (Razorpay) | 4 | 0 | ⬜ Not started |
| 6 | Notifications | 4 | 1 | 🔄 In progress |
| 7 | Error Monitoring & Infrastructure | 4 | 3 | 🔄 In progress |
| 8 | Provider Integrations | 4 | 0 | ⬜ Not started |
| 9 | Admin Panel | 5 | 5 | ✅ Complete |
| 10 | Mobile Apps | 6 | 1 | 🔄 In progress |
| **Total** | | **55** | **38** | **38 done / 17 remaining** |

---

## Recommended Next Steps (by effort)

| Priority | Task | Effort | Value |
|----------|------|--------|-------|
| 1 | Twilio SMS (#33) | 2 hrs | Real OTP — replace console.log mock |
| 2 | Razorpay (#29–31) | 1 day | Core revenue flow |
| 3 | CDN (#40) | 1 hr | CloudFront/Cloudflare in front of S3 |
| 4 | WhatsApp (#36) | 2 hrs | Ride alerts via WhatsApp |
| 5 | Provider onboarding portal (#44) | 1–2 days | Ops tooling — KYC + doc upload |
| 6 | React Native user app (#51) | 2–3 weeks | Full mobile product |
| 7 | React Native driver app (#52) | 2–3 weeks | Driver-side experience |
