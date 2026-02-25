/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ REDIS CLIENT
 * ═══════════════════════════════════════════════════════════
 *  Replaces the in-memory MemoryCache with a real Redis
 *  connection via ioredis. The interface (set/get/del) is
 *  identical to the previous MemoryCache class, so no other
 *  files need to change.
 *
 *  Install: npm install ioredis
 *  Install: npm install --save-dev @types/ioredis (if needed,
 *           ioredis ships its own types so usually not required)
 *
 *  Required env var:
 *    REDIS_URL=redis://localhost:6379
 *
 *  The client degrades gracefully: if Redis is unreachable it
 *  logs a warning and falls back to the in-memory store so
 *  development without Docker still works. In production,
 *  set REDIS_FALLBACK_ALLOWED=false to make connection failures
 *  throw instead of silently falling back.
 * ═══════════════════════════════════════════════════════════
 */

import Redis from 'ioredis';

// ─── Fallback: in-memory store ───────────────────────────
// Used when Redis is unreachable and REDIS_FALLBACK_ALLOWED
// is not explicitly set to false. Identical to the previous
// MemoryCache implementation so behaviour is unchanged in dev.

interface CacheItem {
    value: string;
    expiresAt: number;
}

class MemoryFallback {
    private store: Map<string, CacheItem> = new Map();

    async set(key: string, value: string, expirySeconds: number): Promise<void> {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + expirySeconds * 1000,
        });
    }

    async get(key: string): Promise<string | null> {
        const item = this.store.get(key);
        if (!item) return null;
        if (Date.now() > item.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }

    async del(key: string): Promise<void> {
        this.store.delete(key);
    }
}

// ─── Redis client wrapper ────────────────────────────────
// Wraps ioredis to expose the same set/get/del interface.
// ioredis set() with expiry uses EX flag, not a separate call.

class RedisCache {
    private client: Redis;
    private fallback = new MemoryFallback();
    private connected = false;

    constructor(url: string) {
        this.client = new Redis(url, {
            // Don't keep retrying forever — fail fast and fall back
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 3) return null; // Stop retrying
                return Math.min(times * 200, 1000);
            },
            lazyConnect: true, // Don't connect until first command
        });

        this.client.on('connect', () => {
            this.connected = true;
            console.log('[Redis] Connected');
        });

        this.client.on('error', (err) => {
            if (this.connected) {
                // Was connected, now lost — log but don't crash
                console.error('[Redis] Connection lost:', err.message);
            }
            this.connected = false;
        });

        this.client.on('reconnecting', () => {
            console.log('[Redis] Reconnecting...');
        });

        // Attempt connection on startup
        this.client.connect().catch((err) => {
            const fallbackAllowed = process.env.REDIS_FALLBACK_ALLOWED !== 'false';
            if (fallbackAllowed) {
                console.warn(
                    '[Redis] Could not connect — falling back to in-memory cache.',
                    'OTPs will be lost on server restart.',
                    err.message,
                );
            } else {
                console.error('[Redis] Could not connect and fallback is disabled:', err.message);
                process.exit(1);
            }
        });
    }

    async set(key: string, value: string, expirySeconds: number): Promise<void> {
        if (!this.connected) {
            return this.fallback.set(key, value, expirySeconds);
        }
        // ioredis: SET key value EX seconds
        await this.client.set(key, value, 'EX', expirySeconds);
    }

    async get(key: string): Promise<string | null> {
        if (!this.connected) {
            return this.fallback.get(key);
        }
        return this.client.get(key);
    }

    async del(key: string): Promise<void> {
        if (!this.connected) {
            return this.fallback.del(key);
        }
        await this.client.del(key);
    }
}

// ─── Singleton export ────────────────────────────────────
// Drop-in replacement for the previous `const redis = new MemoryCache()`.
// All existing callers (auth.service.ts, quotes.controller.ts) import this
// the same way: `import redis from '../config/redis'`

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new RedisCache(redisUrl);

export default redis;