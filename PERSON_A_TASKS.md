# 🔧 Person A: Backend Engineer - Task List

Your complete 4-week roadmap with checkboxes and code examples.

---

## 📊 Overview

**Role:** Backend Engineer  
**Focus:** API, Database, Provider Integration, DevOps  
**Total Hours:** 80 hours (20 hours/week)  
**Timeline:** 4 weeks

---

# WEEK 1: Foundation & Provider Integration

## Day 1-2: Setup & Testing (8 hours)

### ✅ Task 1.1: Local Environment Setup (2 hours)

- [ ] Install PostgreSQL 14+
- [ ] Install Redis (optional)
- [ ] Clone repository
- [ ] Run setup script

```bash
# macOS/Linux
cd backend
chmod +x setup.sh
./setup.sh

# Windows
cd backend
setup.bat
```

- [ ] Verify server starts successfully
- [ ] Check health endpoint: `curl http://localhost:5000/health`

---

### ✅ Task 1.2: Test All Endpoints (3 hours)

**Authentication:**
- [ ] Test send OTP
```bash
curl -X POST http://localhost:5000/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

- [ ] Test verify OTP
```bash
curl -X POST http://localhost:5000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "code": "123456"}'
```

- [ ] Save access token for next tests

**Bookings:**
- [ ] Test search rides
- [ ] Test create booking
- [ ] Test get bookings
- [ ] Test cancel booking

**Providers:**
- [ ] Test get available providers
- [ ] Test compare providers

**Users:**
- [ ] Test get profile
- [ ] Test update profile
- [ ] Test saved locations

---

### ✅ Task 1.3: Create Postman Collection (2 hours)

- [ ] Create new Postman collection "MOVZZ API"
- [ ] Add all 18 endpoints
- [ ] Add environment variables (token, baseUrl)
- [ ] Add example requests/responses
- [ ] Export collection as JSON
- [ ] Share with Person B

**Collection Structure:**
```
MOVZZ API/
├── Auth/
│   ├── Send OTP
│   ├── Verify OTP
│   ├── Refresh Token
│   └── Get Current User
├── Bookings/
│   ├── Search Rides
│   ├── Create Booking
│   ├── Get Bookings
│   ├── Get Booking by ID
│   ├── Cancel Booking
│   └── Get Booking Status
├── Providers/
│   ├── Get Available
│   ├── Get Estimate
│   └── Compare Providers
└── Users/
    ├── Get Profile
    ├── Update Profile
    ├── Get Saved Locations
    ├── Add Saved Location
    └── Delete Saved Location
```

---

### ✅ Task 1.4: Documentation for Person B (1 hour)

- [ ] Document authentication flow
- [ ] Document error responses
- [ ] Document rate limits
- [ ] Share API base URL
- [ ] Share example tokens

Create `API_GUIDE_FOR_FRONTEND.md`:
```markdown
# MOVZZ API Guide for Frontend

## Base URL
Development: http://localhost:5000/api/v1
Production: https://api.movzz.com/api/v1

## Authentication
All protected endpoints require:
Header: Authorization: Bearer <token>

## Error Responses
{
  "success": false,
  "message": "Error description",
  "errors": [...]  // Optional validation errors
}

## Rate Limits
- General: 100 requests per 15 minutes
- Auth: 5 requests per 15 minutes
```

---

## Day 3-5: Provider API Integration (12 hours)

### ✅ Task 1.5: Uber API Setup (4 hours)

- [ ] Sign up at https://developer.uber.com
- [ ] Create sandbox app
- [ ] Get server token
- [ ] Add credentials to `.env`

```env
UBER_CLIENT_ID=your_client_id
UBER_CLIENT_SECRET=your_client_secret
UBER_SERVER_TOKEN=your_server_token
ENABLE_UBER=true
```

- [ ] Implement real Uber API call

**File:** `backend/src/services/provider.service.ts`

```typescript
private async getUberEstimate(params: EstimateParams) {
  try {
    const response = await axios.get(
      'https://api.uber.com/v1.2/estimates/price',
      {
        params: {
          start_latitude: params.pickupLat,
          start_longitude: params.pickupLng,
          end_latitude: params.dropLat,
          end_longitude: params.dropLng,
        },
        headers: {
          Authorization: `Token ${config.providers.uber.serverToken}`,
          'Accept-Language': 'en_US',
          'Content-Type': 'application/json',
        },
      }
    );

    // Transform Uber response to our format
    const prices = response.data.prices;
    const uberGo = prices.find(p => p.display_name === 'UberGo');

    if (!uberGo) {
      logger.warn('UberGo not available');
      return null;
    }

    return {
      provider: 'uber',
      vehicleType: 'cab',
      rideType: 'UberGo',
      estimatedPrice: Math.round(uberGo.estimate),
      estimatedETA: Math.ceil(uberGo.duration / 60),
      currency: uberGo.currency_code,
      distance: uberGo.distance,
      availability: true,
      surgeMultiplier: uberGo.surge_multiplier || 1.0,
    };
  } catch (error) {
    logger.error('Uber API error:', error);
    await this.logProviderError('uber', error);
    return null;
  }
}
```

- [ ] Test with real coordinates
- [ ] Handle errors gracefully
- [ ] Log API calls

---

### ✅ Task 1.6: Ola API Setup (4 hours)

- [ ] Contact Ola for API access (https://www.olacabs.com/corporate)
- [ ] Get API credentials
- [ ] Add to `.env`

```env
OLA_API_KEY=your_api_key
OLA_API_SECRET=your_api_secret
ENABLE_OLA=true
```

- [ ] Implement Ola API integration

```typescript
private async getOlaEstimate(params: EstimateParams) {
  try {
    const response = await axios.post(
      'https://devapi.olacabs.com/v1/products',
      {
        pickup_lat: params.pickupLat,
        pickup_lng: params.pickupLng,
        drop_lat: params.dropLat,
        drop_lng: params.dropLng,
        category: params.vehicleType === 'cab' ? 'prime_sedan' : 'auto',
      },
      {
        headers: {
          'X-APP-TOKEN': config.providers.ola.apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const estimate = response.data;

    return {
      provider: 'ola',
      vehicleType: params.vehicleType,
      rideType: params.vehicleType === 'cab' ? 'Ola Mini' : 'Ola Auto',
      estimatedPrice: Math.round(estimate.fare.total_fare),
      estimatedETA: Math.ceil(estimate.eta / 60),
      currency: 'INR',
      distance: estimate.distance,
      availability: estimate.available,
      surgeMultiplier: estimate.surge_factor || 1.0,
    };
  } catch (error) {
    logger.error('Ola API error:', error);
    await this.logProviderError('ola', error);
    return null;
  }
}
```

- [ ] Test integration
- [ ] Handle rate limiting
- [ ] Add retry logic

---

### ✅ Task 1.7: Rapido API Setup (4 hours)

- [ ] Contact Rapido for API access
- [ ] Get API key
- [ ] Add to `.env`

```env
RAPIDO_API_KEY=your_api_key
ENABLE_RAPIDO=true
```

- [ ] Implement Rapido integration

```typescript
private async getRapidoEstimate(params: EstimateParams) {
  try {
    const response = await axios.post(
      'https://api.rapido.bike/api/v1/estimate',
      {
        pickup: {
          lat: params.pickupLat,
          lng: params.pickupLng,
        },
        drop: {
          lat: params.dropLat,
          lng: params.dropLng,
        },
        vehicle_type: params.vehicleType, // 'bike', 'auto', 'cab'
      },
      {
        headers: {
          'Authorization': `Bearer ${config.providers.rapido.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const estimate = response.data;

    return {
      provider: 'rapido',
      vehicleType: params.vehicleType,
      rideType: `Rapido ${params.vehicleType.charAt(0).toUpperCase() + params.vehicleType.slice(1)}`,
      estimatedPrice: Math.round(estimate.fare),
      estimatedETA: Math.ceil(estimate.eta_minutes),
      currency: 'INR',
      distance: estimate.distance_km,
      availability: estimate.available,
      surgeMultiplier: estimate.surge || 1.0,
    };
  } catch (error) {
    logger.error('Rapido API error:', error);
    await this.logProviderError('rapido', error);
    return null;
  }
}
```

- [ ] Test all vehicle types (bike, auto, cab)
- [ ] Verify pricing accuracy
- [ ] Test error scenarios

---

### ✅ Task 1.8: Testing & Validation (2 hours)

- [ ] Test all 3 providers together
- [ ] Verify price comparison works
- [ ] Test with different routes
- [ ] Test error handling
- [ ] Update Postman collection
- [ ] Notify Person B that APIs are ready

**Test Script:**
```bash
# Test search with all providers
curl -X POST http://localhost:5000/api/v1/bookings/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLat": 13.0827,
    "pickupLng": 80.2707,
    "dropLat": 12.9941,
    "dropLng": 80.1709,
    "vehicleTypes": ["cab", "bike", "auto"]
  }'

# Should return real estimates from Uber, Ola, Rapido
```

---

# WEEK 2: Payment & Real-time Features

## Day 1-2: Payment Integration (8 hours)

### ✅ Task 2.1: Razorpay Setup (2 hours)

- [ ] Sign up at https://razorpay.com
- [ ] Get test API keys
- [ ] Add to `.env`

```env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret_key
```

- [ ] Install Razorpay SDK
```bash
npm install razorpay
```

---

### ✅ Task 2.2: Payment Service (3 hours)

- [ ] Create payment service

**File:** `backend/src/services/payment.service.ts`

```typescript
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../config/config';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export class PaymentService {
  private razorpay: Razorpay;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }

  async createOrder(bookingId: string, amount: number) {
    // Verify booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found');
    }

    // Create Razorpay order
    const order = await this.razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: bookingId,
      notes: {
        bookingId,
        userId: booking.userId,
      },
    });

    // Save order to database
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: 'PROCESSING',
        transactionId: order.id,
      },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId,
    };
  }

  async verifyPayment(
    orderId: string,
    paymentId: string,
    signature: string
  ) {
    // Verify signature
    const generated = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generated !== signature) {
      throw new AppError(400, 'Invalid payment signature');
    }

    // Update booking
    const booking = await prisma.booking.findFirst({
      where: { transactionId: orderId },
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found');
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: 'COMPLETED',
        finalPrice: booking.estimatedPrice,
      },
    });

    return {
      success: true,
      bookingId: booking.id,
      paymentId,
    };
  }

  async handleWebhook(payload: any, signature: string) {
    // Verify webhook signature
    const generated = crypto
      .createHmac('sha256', config.razorpay.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (generated !== signature) {
      throw new AppError(400, 'Invalid webhook signature');
    }

    // Handle different events
    switch (payload.event) {
      case 'payment.captured':
        await this.handlePaymentCaptured(payload.payload.payment.entity);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(payload.payload.payment.entity);
        break;
    }
  }

  private async handlePaymentCaptured(payment: any) {
    const booking = await prisma.booking.findFirst({
      where: { transactionId: payment.order_id },
    });

    if (booking) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: 'COMPLETED' },
      });
    }
  }

  private async handlePaymentFailed(payment: any) {
    const booking = await prisma.booking.findFirst({
      where: { transactionId: payment.order_id },
    });

    if (booking) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: 'FAILED' },
      });
    }
  }
}
```

---

### ✅ Task 2.3: Payment Endpoints (2 hours)

- [ ] Create payment controller
- [ ] Add payment routes
- [ ] Test payment flow

**File:** `backend/src/controllers/payment.controller.ts`

```typescript
import { Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { bookingId, amount } = req.body;

    const order = await this.paymentService.createOrder(bookingId, amount);

    res.json({
      success: true,
      data: order,
    });
  });

  verifyPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { orderId, paymentId, signature } = req.body;

    const result = await this.paymentService.verifyPayment(
      orderId,
      paymentId,
      signature
    );

    res.json({
      success: true,
      data: result,
    });
  });

  webhook = asyncHandler(async (req: AuthRequest, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string;

    await this.paymentService.handleWebhook(req.body, signature);

    res.json({ success: true });
  });
}
```

**File:** `backend/src/routes/payment.routes.ts`

```typescript
import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const paymentController = new PaymentController();

router.post('/create-order', authenticate, paymentController.createOrder);
router.post('/verify', authenticate, paymentController.verifyPayment);
router.post('/webhook', paymentController.webhook); // No auth for webhooks

export default router;
```

- [ ] Add to main server
- [ ] Test with Razorpay test cards
- [ ] Update Postman collection

---

### ✅ Task 2.4: Testing (1 hour)

- [ ] Test order creation
- [ ] Test payment verification
- [ ] Test webhook handling
- [ ] Document for Person B

---

## Day 3-5: Real-time Features (12 hours)

### ✅ Task 2.5: WebSocket Events (4 hours)

- [ ] Enhance WebSocket setup in server.ts
- [ ] Add booking status events
- [ ] Add driver location events

**File:** `backend/src/server.ts` (update WebSocket section)

```typescript
private initializeWebSocket(): void {
  this.io.on('connection', (socket) => {
    logger.info(`🔌 Client connected: ${socket.id}`);

    // Join user-specific room
    socket.on('join', (userId: string) => {
      socket.join(`user:${userId}`);
      logger.info(`User ${userId} joined room`);
    });

    // Join booking-specific room
    socket.on('join-booking', (bookingId: string) => {
      socket.join(`booking:${bookingId}`);
      logger.info(`Joined booking room: ${bookingId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  this.app.set('io', this.io);
  logger.info('✅ WebSocket initialized');
}
```

---

### ✅ Task 2.6: Booking Status Updates (4 hours)

- [ ] Create real-time booking service

**File:** `backend/src/services/realtime.service.ts`

```typescript
import { Server as SocketServer } from 'socket.io';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class RealtimeService {
  private io: SocketServer;

  constructor(io: SocketServer) {
    this.io = io;
  }

  async updateBookingStatus(
    bookingId: string,
    status: string,
    data?: any
  ) {
    // Update database
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });

    // Emit to user
    this.io.to(`user:${booking.userId}`).emit('booking:updated', {
      bookingId,
      status,
      timestamp: new Date(),
      ...data,
    });

    // Emit to booking room
    this.io.to(`booking:${bookingId}`).emit('status:changed', {
      status,
      timestamp: new Date(),
      ...data,
    });

    logger.info(`Booking ${bookingId} status updated to ${status}`);
  }

  async assignDriver(bookingId: string, driver: any) {
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'DRIVER_ASSIGNED',
        driverName: driver.name,
        driverPhone: driver.phone,
        driverRating: driver.rating,
        vehicleNumber: driver.vehicleNumber,
        vehicleModel: driver.vehicleModel,
      },
    });

    this.io.to(`user:${booking.userId}`).emit('driver:assigned', {
      bookingId,
      driver: {
        name: driver.name,
        phone: driver.phone,
        rating: driver.rating,
        vehicle: {
          number: driver.vehicleNumber,
          model: driver.vehicleModel,
        },
        location: driver.location,
      },
    });
  }

  async updateDriverLocation(bookingId: string, location: any) {
    this.io.to(`booking:${bookingId}`).emit('driver:location', {
      bookingId,
      location: {
        lat: location.lat,
        lng: location.lng,
        heading: location.heading,
      },
      timestamp: new Date(),
    });
  }

  async updateETA(bookingId: string, eta: number) {
    this.io.to(`booking:${bookingId}`).emit('eta:updated', {
      bookingId,
      eta,
      timestamp: new Date(),
    });
  }
}
```

---

### ✅ Task 2.7: Driver Tracking Simulation (4 hours)

- [ ] Create driver simulation service

**File:** `backend/src/services/driver-simulator.service.ts`

```typescript
import { RealtimeService } from './realtime.service';
import { logger } from '../config/logger';

export class DriverSimulatorService {
  private realtimeService: RealtimeService;
  private activeSimulations: Map<string, NodeJS.Timer> = new Map();

  constructor(realtimeService: RealtimeService) {
    this.realtimeService = realtimeService;
  }

  startSimulation(bookingId: string, pickup: any, drop: any) {
    logger.info(`Starting driver simulation for booking ${bookingId}`);

    // Simulate driver assignment after 5 seconds
    setTimeout(() => {
      this.realtimeService.assignDriver(bookingId, {
        name: 'Rajesh Kumar',
        phone: '+919876543210',
        rating: 4.8,
        vehicleNumber: 'TN 01 AB 1234',
        vehicleModel: 'Honda City',
        location: pickup,
      });
    }, 5000);

    // Simulate driver movement every 5 seconds
    let currentLat = pickup.lat;
    let currentLng = pickup.lng;
    const latStep = (drop.lat - pickup.lat) / 20;
    const lngStep = (drop.lng - pickup.lng) / 20;
    let steps = 0;

    const interval = setInterval(() => {
      if (steps >= 20) {
        clearInterval(interval);
        this.activeSimulations.delete(bookingId);
        
        // Trip completed
        this.realtimeService.updateBookingStatus(
          bookingId,
          'COMPLETED'
        );
        return;
      }

      currentLat += latStep;
      currentLng += lngStep;
      steps++;

      // Update location
      this.realtimeService.updateDriverLocation(bookingId, {
        lat: currentLat,
        lng: currentLng,
        heading: this.calculateHeading(latStep, lngStep),
      });

      // Update ETA
      const remainingSteps = 20 - steps;
      const eta = remainingSteps * 30; // 30 seconds per step
      this.realtimeService.updateETA(bookingId, eta);
    }, 5000);

    this.activeSimulations.set(bookingId, interval);
  }

  stopSimulation(bookingId: string) {
    const interval = this.activeSimulations.get(bookingId);
    if (interval) {
      clearInterval(interval);
      this.activeSimulations.delete(bookingId);
      logger.info(`Stopped simulation for booking ${bookingId}`);
    }
  }

  private calculateHeading(latStep: number, lngStep: number): number {
    return Math.atan2(lngStep, latStep) * (180 / Math.PI);
  }
}
```

- [ ] Integrate with booking creation
- [ ] Test simulation
- [ ] Document WebSocket events for Person B

---

# WEEK 3: Analytics & Testing

## Day 1-3: Analytics & Monitoring (12 hours)

### ✅ Task 3.1: Analytics Endpoints (4 hours)

- [ ] Create analytics service
- [ ] Add analytics endpoints
- [ ] Test data aggregation

**File:** `backend/src/services/analytics.service.ts`

```typescript
import { prisma } from '../config/database';

export class AnalyticsService {
  async getUserStats(userId: string) {
    const [totalBookings, completedBookings, totalSpent] = await Promise.all([
      prisma.booking.count({ where: { userId } }),
      prisma.booking.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.booking.aggregate({
        where: { userId, status: 'COMPLETED' },
        _sum: { finalPrice: true },
      }),
    ]);

    return {
      totalBookings,
      completedBookings,
      cancelledBookings: totalBookings - completedBookings,
      totalSpent: totalSpent._sum.finalPrice || 0,
    };
  }

  async getProviderPerformance(startDate: Date, endDate: Date) {
    const bookings = await prisma.booking.groupBy({
      by: ['provider'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: true,
      _avg: { estimatedPrice: true, finalPrice: true },
    });

    return bookings.map(b => ({
      provider: b.provider,
      totalBookings: b._count,
      avgEstimatedPrice: b._avg.estimatedPrice,
      avgFinalPrice: b._avg.finalPrice,
    }));
  }

  async getPopularRoutes(limit: number = 10) {
    // This would require more complex aggregation
    // For now, return mock data
    return [];
  }
}
```

---

### ✅ Task 3.2: Error Tracking Setup (4 hours)

- [ ] Sign up for Sentry
- [ ] Install Sentry SDK
- [ ] Configure error tracking
- [ ] Test error reporting

```bash
npm install @sentry/node @sentry/tracing
```

**File:** `backend/src/config/sentry.ts`

```typescript
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { Application } from 'express';
import { config } from './config';

export const initSentry = (app: Application) => {
  if (config.env === 'production') {
    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.env,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Tracing.Integrations.Express({ app }),
      ],
      tracesSampleRate: 1.0,
    });

    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  }
};

export const sentryErrorHandler = Sentry.Handlers.errorHandler();
```

---

### ✅ Task 3.3: Performance Monitoring (4 hours)

- [ ] Add performance logging
- [ ] Monitor slow queries
- [ ] Set up alerts

---

## Day 4-5: Testing (8 hours)

### ✅ Task 3.4: Unit Tests (4 hours)

- [ ] Set up Jest
- [ ] Write service tests
- [ ] Write utility tests

**File:** `backend/tests/unit/services/auth.service.test.ts`

```typescript
import { AuthService } from '../../../src/services/auth.service';
import { prisma } from '../../../src/config/database';

describe('AuthService', () => {
  let authService: AuthService;

  beforeAll(() => {
    authService = new AuthService();
  });

  describe('sendOTP', () => {
    it('should generate 6-digit OTP', async () => {
      const phone = '+919876543210';
      await authService.sendOTP(phone);

      const otp = await prisma.oTPCode.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' },
      });

      expect(otp).toBeDefined();
      expect(otp?.code).toHaveLength(6);
    });
  });

  describe('verifyOTP', () => {
    it('should verify correct OTP', async () => {
      const phone = '+919876543210';
      await authService.sendOTP(phone);

      const otp = await prisma.oTPCode.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' },
      });

      const result = await authService.verifyOTP(phone, otp!.code);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject invalid OTP', async () => {
      const phone = '+919876543210';
      
      await expect(
        authService.verifyOTP(phone, '000000')
      ).rejects.toThrow('Invalid or expired OTP');
    });
  });
});
```

- [ ] Run tests: `npm test`
- [ ] Aim for >80% coverage

---

### ✅ Task 3.5: Integration Tests (4 hours)

- [ ] Test API endpoints
- [ ] Test database operations
- [ ] Test provider integrations

---

# WEEK 4: Deployment & Launch

## Day 1-2: Production Setup (8 hours)

### ✅ Task 4.1: Cloud Infrastructure (4 hours)

**Option A: Railway (Easiest)**

- [ ] Sign up at https://railway.app
- [ ] Create new project
- [ ] Add PostgreSQL database
- [ ] Add Redis (optional)
- [ ] Deploy backend from GitHub

**Option B: AWS**

- [ ] Set up RDS PostgreSQL
- [ ] Set up ElastiCache Redis
- [ ] Set up EC2 or ECS
- [ ] Configure security groups
- [ ] Set up load balancer

---

### ✅ Task 4.2: Environment Configuration (2 hours)

- [ ] Set production environment variables
- [ ] Configure database connection
- [ ] Add real API keys
- [ ] Set up SSL certificate

---

### ✅ Task 4.3: CI/CD Pipeline (2 hours)

- [ ] Create GitHub Actions workflow
- [ ] Set up auto-deploy
- [ ] Configure staging environment

---

## Day 3-5: Final Testing & Launch (12 hours)

### ✅ Task 4.4: End-to-End Testing (4 hours)

- [ ] Test complete user journey
- [ ] Test payment flow
- [ ] Test real-time features
- [ ] Load testing

---

### ✅ Task 4.5: Security Audit (4 hours)

- [ ] Check for vulnerabilities
- [ ] Update dependencies
- [ ] Configure rate limiting
- [ ] Set up monitoring

---

### ✅ Task 4.6: Documentation & Launch (4 hours)

- [ ] Update API documentation
- [ ] Create deployment guide
- [ ] Write runbook
- [ ] Launch! 🚀

---

# 📊 Progress Tracking

## Week 1
- [ ] Environment setup complete
- [ ] All endpoints tested
- [ ] Postman collection created
- [ ] Uber API integrated
- [ ] Ola API integrated
- [ ] Rapido API integrated

## Week 2
- [ ] Payment integration complete
- [ ] WebSocket events working
- [ ] Real-time tracking implemented
- [ ] Driver simulation working

## Week 3
- [ ] Analytics endpoints added
- [ ] Error tracking setup
- [ ] Unit tests written
- [ ] Integration tests complete

## Week 4
- [ ] Production infrastructure ready
- [ ] Backend deployed
- [ ] Security audit complete
- [ ] Ready to launch

---

**Total Tasks:** 50+  
**Estimated Hours:** 80 hours  
**Timeline:** 4 weeks  

**You got this! 💪**
