/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ ORCHESTRATION SERVICE — AI Week 1
 * ═══════════════════════════════════════════════════════════
 *  Decides HOW to dispatch providers based on the top
 *  reliability score — not just WHO to dispatch.
 *
 *  Strategies (by top provider score):
 *    > 95  SEQUENTIAL  — try #1, then #2 if fails
 *    > 85  PARALLEL_2  — race top 2, cancel loser
 *    > 70  PARALLEL_3  — race top 3
 *    > 50  CASCADE     — tiered: #1 → +15s both → +30s all 3
 *    ≤ 50  EMERGENCY   — all providers simultaneously
 * ═══════════════════════════════════════════════════════════
 */

import { OrchestrationStrategy, RideContext } from '../../types/ai.types';

// ─── Strategy decision ────────────────────────────────────

export function decideStrategy(topScore: number): OrchestrationStrategy {
    if (topScore > 95) return OrchestrationStrategy.SEQUENTIAL;
    if (topScore > 85) return OrchestrationStrategy.PARALLEL_2;
    if (topScore > 70) return OrchestrationStrategy.PARALLEL_3;
    if (topScore > 50) return OrchestrationStrategy.CASCADE;
    return OrchestrationStrategy.EMERGENCY;
}

// ─── Strategy execution ───────────────────────────────────

/**
 * executeStrategy — Dispatches providers using the chosen strategy.
 *
 * Each provider attempt calls `dispatchFn(providerId)` — an async function
 * that resolves to true (accepted) or throws/returns false (rejected).
 * Injected by the caller (booking.service.ts) to keep this service
 * free of direct Prisma/booking dependencies.
 *
 * Returns the winning providerId, or null if all fail.
 */
export async function executeStrategy(
    providerIds: string[],
    strategy: OrchestrationStrategy,
    dispatchFn: (providerId: string) => Promise<boolean>,
    context?: RideContext,
): Promise<string | null> {
    if (providerIds.length === 0) return null;

    console.log(`[Orchestration] Strategy: ${strategy}, providers: ${providerIds.length}`);

    switch (strategy) {
        case OrchestrationStrategy.SEQUENTIAL:
            return sequential(providerIds, dispatchFn);

        case OrchestrationStrategy.PARALLEL_2:
            return raceN(providerIds.slice(0, 2), dispatchFn);

        case OrchestrationStrategy.PARALLEL_3:
            return raceN(providerIds.slice(0, 3), dispatchFn);

        case OrchestrationStrategy.CASCADE:
            return cascade(providerIds.slice(0, 3), dispatchFn);

        case OrchestrationStrategy.EMERGENCY:
            return raceN(providerIds, dispatchFn);

        default:
            return sequential(providerIds, dispatchFn);
    }
}

// ─── Strategy implementations ────────────────────────────

/** Try providers one at a time, stop on first success */
async function sequential(
    ids: string[],
    dispatch: (id: string) => Promise<boolean>,
): Promise<string | null> {
    for (const id of ids) {
        try {
            const accepted = await dispatch(id);
            if (accepted) return id;
        } catch {
            // provider rejected — try next
        }
    }
    return null;
}

/** Race N providers — return whoever accepts first */
async function raceN(
    ids: string[],
    dispatch: (id: string) => Promise<boolean>,
): Promise<string | null> {
    if (ids.length === 0) return null;

    return new Promise<string | null>((resolve) => {
        let settled = false;
        let pending  = ids.length;

        for (const id of ids) {
            dispatch(id)
                .then(accepted => {
                    if (!settled && accepted) {
                        settled = true;
                        resolve(id);
                    }
                })
                .catch(() => { /* rejected */ })
                .finally(() => {
                    pending--;
                    if (pending === 0 && !settled) resolve(null);
                });
        }
    });
}

/**
 * CASCADE: escalating wave dispatch
 *   t=0s  → try p[0] only
 *   t=15s → also try p[1]
 *   t=30s → also try p[2]
 * First acceptance wins.
 */
async function cascade(
    ids: string[],
    dispatch: (id: string) => Promise<boolean>,
): Promise<string | null> {
    if (ids.length === 0) return null;

    return new Promise<string | null>((resolve) => {
        let settled = false;
        let activeCount = 0;

        function tryProvider(id: string) {
            activeCount++;
            dispatch(id)
                .then(accepted => {
                    if (!settled && accepted) {
                        settled = true;
                        resolve(id);
                    }
                })
                .catch(() => { /* rejected */ })
                .finally(() => {
                    activeCount--;
                });
        }

        // Wave 1: p[0] immediately
        tryProvider(ids[0]);

        // Wave 2: p[1] after 15s
        const t1 = setTimeout(() => {
            if (!settled && ids[1]) tryProvider(ids[1]);
        }, 15_000);

        // Wave 3: p[2] after 30s — also resolve null if no one accepted
        const t2 = setTimeout(() => {
            if (!settled) {
                if (ids[2]) {
                    tryProvider(ids[2]);
                }
                // Give up after another 15s if still no acceptance
                setTimeout(() => {
                    if (!settled) { settled = true; resolve(null); }
                }, 15_000);
            }
            clearTimeout(t1);
        }, 30_000);

        // Clean up timers if resolved early
        const origResolve = resolve;
        // eslint-disable-next-line no-param-reassign
        (resolve as any) = (val: string | null) => {
            clearTimeout(t1);
            clearTimeout(t2);
            origResolve(val);
        };
    });
}
