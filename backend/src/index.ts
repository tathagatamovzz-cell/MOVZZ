import * as Sentry from '@sentry/node';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables first so SENTRY_DSN is available
dotenv.config();

// ─── Sentry ──────────────────────────────────────────────
// Initialised before any route/middleware so all errors are captured.
// No-op when SENTRY_DSN is not set (local dev without an account).
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    });
    console.log('[Sentry] Error monitoring enabled');
}

import authRoutes from './routes/auth.routes';
import bookingRoutes from './routes/booking.routes';
import adminRoutes from './routes/admin.routes';
import rideRoutes from './routes/ride.routes';
import quotesRoutes from './routes/quotes.routes';
import uploadRoutes from './routes/upload.routes';
import paymentRoutes from './routes/payment.routes';
import prisma from './config/database';
import { setIo } from './config/socket';
import { verifyToken } from './services/jwt.service';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ────────────────────────────────

// Helmet - Security headers
app.use(helmet());

// CORS - Cross-origin requests (allowlist, no wildcard)
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:5173'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting - 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes (was 1 minute)
    max: 100,
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// ─── Body Parsing ───────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ────────────────────────────────────────────

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Health Check ───────────────────────────────────────

app.get('/health', async (_req, res) => {
    try {
        // Test database connection
        await prisma.$queryRaw`SELECT 1`;

        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            database: 'connected',
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
        });
    }
});

// ─── API Routes ─────────────────────────────────────────

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/rides', rideRoutes);
app.use('/api/v1/quotes', quotesRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/payments', paymentRoutes);

// ─── 404 Handler ────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
    });
});

// ─── Sentry Error Handler ────────────────────────────────
// Must be registered before the generic error handler so Sentry
// captures the error before the response is sent.
if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
}

// ─── Global Error Handler ───────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
    });
});

// ─── Socket.IO ──────────────────────────────────────────

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
    },
});

// JWT auth middleware — reject connections with invalid tokens
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth.token as string;
        if (!token) return next(new Error('Authentication token required'));
        const payload = verifyToken(token);
        socket.data.userId = payload.userId;
        next();
    } catch {
        next(new Error('Invalid or expired token'));
    }
});

io.on('connection', (socket) => {
    const userId: string = socket.data.userId;
    socket.join(userId);
    // Admin panel joins the shared 'admin' room to receive all booking events
    socket.on('join:admin', () => socket.join('admin'));
    socket.on('disconnect', () => {
        socket.leave(userId);
    });
});

setIo(io);

// ─── Background Workers ──────────────────────────────────
// Workers call getIo() lazily at job-processing time, so they
// always see the initialised io instance regardless of import order.
import './workers/booking-timeout.worker';
import './workers/recovery.worker';
import './workers/sms.worker';
import './workers/nightly-aggregation.worker';
import './workers/ml-data.worker';

// ─── CRON: Nightly Aggregation ───────────────────────────
// Schedule midnight job. BullMQ CRON uses standard cron syntax.
import { nightlyAggregationQueue } from './config/queues';
nightlyAggregationQueue.add(
    'nightly-run',
    {},
    { repeat: { pattern: '0 0 * * *' }, jobId: 'nightly-aggregation-cron' }
).catch(() => {}); // silently ignore if already scheduled

// ─── Start Server ───────────────────────────────────────

httpServer.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║         🚗 MOVZZ API SERVER 🚗          ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  Status:  RUNNING                        ║`);
    console.log(`║  Port:    ${String(PORT).padEnd(30)}║`);
    console.log(`║  Env:     ${(process.env.NODE_ENV || 'development').padEnd(30)}║`);
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  Auth:                                   ║');
    console.log('║  POST /api/v1/auth/send-otp              ║');
    console.log('║  POST /api/v1/auth/verify-otp            ║');
    console.log('║  Bookings:                               ║');
    console.log('║  POST /api/v1/bookings                   ║');
    console.log('║  GET  /api/v1/bookings/:id               ║');
    console.log('║  POST /api/v1/bookings/:id/cancel        ║');
    console.log('║  Rides (Aggregated Search):              ║');
    console.log('║  POST /api/v1/rides/search               ║');
    console.log('║  POST /api/v1/rides/select               ║');
    console.log('║  Admin:                                  ║');
    console.log('║  GET  /api/v1/admin/dashboard            ║');
    console.log('║  GET  /api/v1/admin/providers             ║');
    console.log('║  Quotes:                                 ║');
    console.log('║  POST /api/v1/quotes                     ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});

// ─── Graceful Shutdown ──────────────────────────────────

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    io.close();
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    io.close();
    await prisma.$disconnect();
    process.exit(0);
});

export default app;
