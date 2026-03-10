/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ AI CACHE SERVICE — Week 2
 * ═══════════════════════════════════════════════════════════
 *  Redis-backed getOrCompute pattern for expensive AI results.
 *  TTLs are tuned per data type:
 *    - Provider scores:   5 min  (changes with each booking)
 *    - Hourly metrics:    1 hour (aggregated nightly)
 *    - Context snapshots: 2 min  (surge/weather change fast)
 * ═══════════════════════════════════════════════════════════
 */

import redis from '../../config/redis';

// ─── Key builders ────────────────────────────────────────

export const CacheKeys = {
    providerScore:   (id: string) => `ai:score:${id}`,
    providerMetrics: (id: string) => `ai:metrics:${id}`,
    hourlyDemand:    (zone: string, hour: number) => `ai:demand:${zone}:${hour}`,
    surgeMultiplier: (zone: string) => `ai:surge:${zone}`,
};

export const TTL = {
    PROVIDER_SCORE:   5 * 60,        // 5 min
    PROVIDER_METRICS: 60 * 60,       // 1 hour
    HOURLY_DEMAND:    60 * 60,       // 1 hour
    SURGE:            2 * 60,        // 2 min
};

// ─── Core utility ────────────────────────────────────────

/**
 * getOrCompute — Returns cached value if available, otherwise
 * calls fn(), stores the result, and returns it.
 */
export async function getOrCompute<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
): Promise<T> {
    const cached = await redis.get(key);
    if (cached) {
        try {
            return JSON.parse(cached) as T;
        } catch {
            // corrupt cache entry — recompute
        }
    }

    const value = await fn();
    await redis.set(key, JSON.stringify(value), ttlSeconds);
    return value;
}

/**
 * invalidate — Remove a cache key immediately (e.g. after a booking completes).
 */
export async function invalidate(key: string): Promise<void> {
    await redis.del(key);
}

/**
 * invalidateProviderScores — Remove all score cache keys for a provider
 * (called after a booking outcome updates their reliability).
 */
export async function invalidateProviderScores(providerId: string): Promise<void> {
    await redis.del(CacheKeys.providerScore(providerId));
    await redis.del(CacheKeys.providerMetrics(providerId));
}
