import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import authRoutes from './routes/auth.routes';
import bookingRoutes from './routes/booking.routes';
import adminRoutes from './routes/admin.routes';
import prisma from './config/database';

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ────────────────────────────────

// Helmet - Security headers
app.use(helmet());

// CORS - Cross-origin requests
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting - 100 requests per minute
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
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

// ─── 404 Handler ────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
    });
});

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

// ─── Start Server ───────────────────────────────────────

app.listen(PORT, () => {
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
    console.log('║  Admin:                                  ║');
    console.log('║  GET  /api/v1/admin/dashboard            ║');
    console.log('║  GET  /api/v1/admin/providers             ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});

// ─── Graceful Shutdown ──────────────────────────────────

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

export default app;
