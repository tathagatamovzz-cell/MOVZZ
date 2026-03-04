# MOVZZ — Integration Roadmap

> External services, third-party APIs, and infrastructure integrations.
> Last updated: March 2026

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ LIVE | Code written, credentials set, actively working |
| 🔑 CODED | Code written, needs real credentials to activate |
| 🔄 PARTIAL | Partially integrated — some features missing |
| ⬜ TODO | Not yet started |

---

## Current Status: 7 / 16 integrations live

---

## 1 — Database & Cache

### PostgreSQL (via Prisma ORM)
**Status: ✅ LIVE**

| Detail | Value |
|--------|-------|
| Provider | Local Docker or Neon.tech (cloud) |
| ORM | Prisma v6.19.2 |
| Schema | 8 models: User, Booking, Provider, ProviderMetric, BookingAttempt, BookingLog, UserCredit, Payout |
| AI fields added | `orchestrationStrategy`, `aiReliabilityScore`, `contextSnapshot`, `timeToConfirm`, `currentActiveRides`, `maxCapacity` |
| Env var | `DATABASE_URL` in `backend/.env` |
| Key files | `backend/prisma/schema.prisma`, `backend/src/config/database.ts` |

**Pending:**
- [ ] Switch to Neon.tech URL for cloud deployment (connection string format already commented in `.env`)

---

### Redis (ioredis)
**Status: ✅ LIVE** (with in-memory fallback)

| Detail | Value |
|--------|-------|
| Usage | OTP storage (5 min TTL), quote caching, provider metrics cache (5 min TTL) |
| Fallback | In-memory `MemoryCache` when Redis unavailable |
| Env var | `REDIS_URL=redis://localhost:6379` |
| Key files | `backend/src/config/redis.ts`, `backend/src/config/queues.ts` |

**Pending:**
- [ ] Upstash Redis for cloud deployment (drop-in replacement for `REDIS_URL`)

---

## 2 — Authentication

### OTP / JWT (phone-based)
**Status: ✅ LIVE** (OTP is `console.log` mock — SMS delivery pending Twilio)

| Detail | Value |
|--------|-------|
| OTP storage | Redis with 5-min TTL |
| Token | JWT signed with `JWT_SECRET`, 7-day expiry |
| SMS delivery | BullMQ job queued → `sms.worker.ts` → **currently `console.log`** |
| Key files | `backend/src/controllers/auth.controller.ts`, `backend/src/workers/sms.worker.ts` |

**To go live:** Add Twilio credentials (see SMS section below)

---

### Google OAuth 2.0
**Status: ✅ LIVE**

| Detail | Value |
|--------|-------|
| Flow | Direct REST (no Passport.js) — redirect to Google consent → callback → JWT |
| Credentials | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set in `.env` |
| Callback URL | `http://localhost:3000/api/v1/auth/google/callback` |
| Key files | `backend/src/controllers/oauth.controller.ts` |

**Pending:**
- [ ] Update `OAUTH_CALLBACK_URL` to production domain before launch

---

## 3 — Payments

### Razorpay Payment Links API
**Status: 🔑 CODED** — needs real API keys

| Detail | Value |
|--------|-------|
| Product used | Payment Links (`razorpay.paymentLink.create()`) — hosted page at `rzp.io/l/...` |
| Signature | HMAC-SHA256: `linkId\|refId\|status\|paymentId` |
| Flow | Book → backend creates link → frontend redirects → Razorpay hosted page → return with params → backend verifies → `paidAt` set |
| Payout | T+2 payout record created in `Payout` table after verification |
| Env vars needed | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` in `backend/.env` |
| Frontend env | `VITE_RAZORPAY_KEY_ID` in `frontend/.env` |
| Key files | `backend/src/services/payment.service.ts`, `backend/src/controllers/payment.controller.ts` |
| Test card | 4111 1111 1111 1111 (Razorpay test mode) |

**To activate:**
1. razorpay.com → Settings → API Keys → Generate Test Key
2. Paste `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `backend/.env`
3. Paste `VITE_RAZORPAY_KEY_ID` in `frontend/.env`

---

## 4 — Notifications

### Resend (Transactional Email)
**Status: ✅ LIVE**

| Detail | Value |
|--------|-------|
| Usage | Booking confirmation, cancellation, compensation credit emails |
| Trigger | Fire-and-forget on booking state transitions |
| Env vars | `RESEND_API_KEY=re_X1GfdRaC_...` and `RESEND_FROM_EMAIL=noreply@movzz.in` both set |
| Key files | `backend/src/services/email.service.ts` |

**Pending:**
- [ ] Verify `movzz.in` sender domain at resend.com/domains (required for production delivery)

---

### Twilio SMS
**Status: ⬜ TODO** — code is ready, credentials not set

| Detail | Value |
|--------|-------|
| Usage | OTP delivery to user's phone |
| Current state | `sms.worker.ts` has `console.log` mock — OTP visible in server logs only |
| Code comment | Twilio call already written in file, just needs to replace mock block |
| Env vars needed | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |

**To activate:**
1. twilio.com → Console → Account SID + Auth Token
2. Get a phone number (Messaging → Phone Numbers)
3. Uncomment Twilio block in `backend/src/workers/sms.worker.ts`, remove `console.log` mock

---

### FCM Push Notifications
**Status: ⬜ TODO**

| Detail | Value |
|--------|-------|
| Usage | Booking state changes, driver ETA updates pushed to user device |
| Requires | Firebase project, service account key, `firebase-admin` npm package |
| Integration point | `booking.service.ts` state transitions → FCM `sendToDevice()` |
| Frontend | PWA service worker already registered (vite-plugin-pwa) — needs `onMessage` handler |

---

### WhatsApp (Twilio API)
**Status: ⬜ TODO**

| Detail | Value |
|--------|-------|
| Usage | Booking confirmations + OTP via WhatsApp |
| Requires | Twilio WhatsApp Sandbox or approved business number |
| Same credentials as SMS | Uses same `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` |
| Endpoint | `https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages` with `To: whatsapp:+91...` |

---

## 5 — Maps & Location

### Google Maps (Geocoding + Distance)
**Status: ✅ LIVE**

| Detail | Value |
|--------|-------|
| Usage | Geocoding API for address lookup + distance calculation |
| Key | `GOOGLE_MAPS_API_KEY=AIzaSyDN5WRPw6F...` set in `backend/.env` |
| Key files | `backend/src/services/fare.service.ts` (Haversine × 1.35 road factor) |

---

### Mapbox (Frontend Autocomplete + Map)
**Status: ✅ LIVE**

| Detail | Value |
|--------|-------|
| Usage | Geocoding autocomplete (300ms debounce, India filter), interactive map with pickup/dropoff markers |
| Key | `VITE_MAPBOX_TOKEN=pk.eyJ1IjoidGF0aGFndC...` set in `frontend/.env` |
| Key files | `frontend/src/App.jsx` (Mapbox Geocoding API + react-map-gl) |

---

## 6 — File Storage

### AWS S3
**Status: ✅ LIVE**

| Detail | Value |
|--------|-------|
| Usage | Profile photo upload (presigned URL pattern), provider KYC document storage |
| Bucket | `movzz_uploads-prod` in `ap-south-1` |
| Credentials | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` set in `backend/.env` |
| Key files | `backend/src/services/s3.service.ts`, `backend/src/controllers/upload.controller.ts` |
| URL pattern | `users/{userId}/profile.jpg` · `providers/{providerId}/docs/{docType}.pdf` |

**Pending:**
- [ ] CDN (CloudFront or Cloudflare R2) in front of S3 for faster asset delivery

---

## 7 — Monitoring & Error Tracking

### Sentry
**Status: ✅ LIVE**

| Detail | Value |
|--------|-------|
| Backend | `@sentry/node` — captures unhandled exceptions + Express errors |
| Frontend | `@sentry/react` — captures JS errors + React component errors |
| DSN | Backend: `https://994e32d3...@o4510966.ingest.us.sentry.io/...` |
| DSN | Frontend: `https://86a72fd3...@o4510966.ingest.us.sentry.io/...` |
| Key files | `backend/src/index.ts`, `frontend/src/main.jsx` |

---

## 8 — Background Jobs

### BullMQ (Queue Workers)
**Status: ✅ LIVE**

| Queue | Worker | Purpose |
|-------|--------|---------|
| `booking-timeout` | `booking-timeout.worker.ts` | Auto-cancel SEARCHING bookings after 5 min |
| `recovery-retry` | `recovery.worker.ts` | 3-level retry on provider failure |
| `sms-dispatch` | `sms.worker.ts` | OTP + booking SMS (mock in dev) |

**AI addition:** `monitorBooking()` in `failure-detector.service.ts` queues 30s risk-check jobs on `booking-timeout` queue.

---

## 9 — AI & Orchestration (Week 1 Complete)

**Status: ✅ LIVE** (operates on real bookings, no external API needed)

| Component | File | Status |
|-----------|------|--------|
| Context Builder | `services/context-builder.service.ts` | ✅ Live — Chennai zone detection, peak hours, ride type |
| Provider Metrics | `services/provider-metrics.service.ts` | ✅ Live — Redis-cached, aggregates DB history |
| Reliability Predictor | `services/provider-scoring.service.ts` | ✅ Live — 8-factor context-aware score 0–100 |
| Orchestration Engine | `services/ai/orchestration.service.ts` | ✅ Live — 5 strategies (SEQUENTIAL → EMERGENCY) |
| Failure Detector | `services/ai/failure-detector.service.ts` | ✅ Live — risk scoring + tiered interventions |

**External APIs needed for future weeks:**
- [ ] **Week 3**: OpenWeatherMap API for real weather context (currently mocked CLEAR)
- [ ] **Week 3**: Google Maps Traffic API for real traffic level (currently mocked MODERATE)

---

## 10 — Provider Dispatch (Real APIs — Not Started)

### Fast Track Cabs API
**Status: ⬜ TODO**

Replace mock scoring with real dispatch calls to Fast Track Cabs' API endpoint. Store `apiEndpoint` on `Provider` model (field already exists in schema).

---

### Chennai Call Taxi API
**Status: ⬜ TODO**

Local fleet operator. Same integration pattern as Fast Track.

---

### Uber / Ola Aggregator Fallback
**Status: ⬜ TODO**

Last-resort layer when all MOVZZ providers fail. Uses Uber/Ola public partner APIs.

---

## 11 — CDN

### CloudFront / Cloudflare
**Status: ⬜ TODO**

| Detail | Value |
|--------|-------|
| Purpose | Serve frontend build + S3 assets via edge cache |
| Easiest path | Cloudflare Pages for frontend + Cloudflare R2 to replace S3 (no egress fees) |
| Alternatively | AWS CloudFront in front of existing S3 bucket (same region `ap-south-1`) |

---

## Summary Table

| Integration | Category | Status | Env Vars Set? |
|-------------|----------|--------|---------------|
| PostgreSQL (Prisma) | Database | ✅ LIVE | ✅ Yes |
| Redis (ioredis) | Cache | ✅ LIVE | ✅ Yes |
| OTP + JWT | Auth | ✅ LIVE (mock SMS) | ✅ Yes |
| Google OAuth | Auth | ✅ LIVE | ✅ Yes |
| Razorpay Payment Links | Payments | 🔑 CODED | ❌ Keys empty |
| Resend (Email) | Notifications | ✅ LIVE | ✅ Yes |
| Twilio SMS | Notifications | ⬜ TODO | ❌ Keys empty |
| FCM Push | Notifications | ⬜ TODO | ❌ Not set up |
| WhatsApp (Twilio) | Notifications | ⬜ TODO | ❌ Keys empty |
| Google Maps | Maps | ✅ LIVE | ✅ Yes |
| Mapbox | Maps | ✅ LIVE | ✅ Yes |
| AWS S3 | Storage | ✅ LIVE | ✅ Yes |
| Sentry | Monitoring | ✅ LIVE | ✅ Yes |
| BullMQ | Queue | ✅ LIVE | ✅ Yes |
| AI Orchestration Engine | AI | ✅ LIVE | N/A (internal) |
| Fast Track Cabs API | Provider | ⬜ TODO | ❌ No API yet |
| Chennai Call Taxi API | Provider | ⬜ TODO | ❌ No API yet |
| Uber/Ola Aggregator | Provider | ⬜ TODO | ❌ No API yet |
| CloudFront / Cloudflare | CDN | ⬜ TODO | ❌ Not set up |
| OpenWeatherMap | AI (Week 3) | ⬜ TODO | ❌ Not set up |

---

## Quick Activation Guide (Credentials Needed)

| Priority | Integration | Where to get credentials | Effort |
|----------|-------------|--------------------------|--------|
| 🔴 High | **Razorpay** | razorpay.com → Settings → API Keys | 5 min |
| 🔴 High | **Twilio SMS** | twilio.com → Console → Account SID + buy number | 15 min |
| 🟡 Medium | **FCM Push** | console.firebase.google.com → New Project → Cloud Messaging | 1 hr |
| 🟡 Medium | **WhatsApp** | Twilio Console → Messaging → WhatsApp Sandbox | 30 min |
| 🟢 Low | **CloudFront/Cloudflare** | AWS console or cloudflare.com → Pages + R2 | 2 hrs |
| 🟢 Low | **OpenWeatherMap** | openweathermap.org/api → Free tier (1000 calls/day) | 10 min |

---

*MOVZZ Integration Roadmap · March 2026 · 11/20 integrations live or coded*
