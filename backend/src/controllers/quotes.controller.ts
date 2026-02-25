import { Request, Response } from 'express';
import crypto from 'crypto';
import { getQuotesSchema } from '../validators/quotes.validator';
import { estimateFares } from '../services/fare.service';
import { findTopProviders } from '../services/provider-scoring.service';
import redis from '../config/redis';

export async function getQuotesHandler(req: Request, res: Response): Promise<void> {
    try {
        // 1. Validate Input
        const result = getQuotesSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: 'Invalid quote request data',
                details: result.error.issues,
            });
            return;
        }

        const data = result.data;
        const quoteId = crypto.randomUUID();
        const quotes: any[] = [];

        // 2. Get Fare Estimates
        const fareEstimate = estimateFares(
            data.transportMode,
            data.pickupLat,
            data.pickupLng,
            data.dropoffLat,
            data.dropoffLng
        );

        // 3. Handle METRO Mode
        if (data.transportMode === 'METRO') {
            if (fareEstimate.metroFares) {
                fareEstimate.metroFares.forEach((mFare, index) => {
                    quotes.push({
                        id: crypto.randomUUID(),
                        type: 'Metro',
                        line: mFare.line,
                        stations: mFare.stationCount,
                        price: mFare.totalFareRupees,
                        eta: 2 + index,
                        duration: `${mFare.estimatedDurationMin} min`,
                        farePaise: mFare.totalFare,
                        // Metro has no provider — null here is intentional
                        providerId: null,
                    });
                });
            }
        }
        // 4. Handle CAB, BIKE, AUTO
        else {
            const providers = await findTopProviders(5, [], 'STANDARD');

            if (providers.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'No available providers in your area at the moment. Please try again later.'
                });
                return;
            }

            fareEstimate.fares.forEach((fareTier, index) => {
                const provider = providers[index % providers.length];

                let tag = null;
                if (index === 0) tag = 'CHEAPEST';
                if (index === fareEstimate.fares.length - 1 && fareEstimate.fares.length > 1) tag = 'PREMIUM';
                if (index === 0 && provider.score >= 90) tag = 'BEST';

                quotes.push({
                    id: crypto.randomUUID(),
                    providerId: provider.providerId,
                    provider: provider.name,
                    type: fareTier.tierName,
                    logo: data.transportMode === 'CAB' ? 'uber' : data.transportMode === 'AUTO' ? 'ola' : 'rapido',
                    price: fareTier.totalFareRupees,
                    eta: 4 + index * 2,
                    score: Math.round(provider.score),
                    reliability: Math.round(provider.reliability * 100),
                    tag,
                    surge: fareTier.surgeMultiplier > 1.0,
                    farePaise: fareTier.totalFare,
                });
            });
        }

        // 5. Structure Response
        const responseData = {
            quoteId,
            quotes,
            metadata: {
                distanceKm: fareEstimate.distanceKm,
                estimatedDurationMin: fareEstimate.estimatedDurationMin,
                quotesValidFor: 300,
            },
        };

        // 6. Cache the full session response under the session quoteId.
        //    Used for auditing and potential replay.
        await redis.set(`quote:${quoteId}`, JSON.stringify(responseData), 300);

        // FIX: Also cache each individual quote under its own ID.
        //
        // The frontend passes selectedRide.id (the individual quote UUID) as
        // the quoteId field when creating a booking — not the session quoteId.
        // Without this, booking.service.ts would look up `quote_item:<id>` and
        // get a cache miss on every booking, falling back to re-scoring every time
        // and never honouring the user's selection from the results screen.
        //
        // Each individual cache entry stores only what booking.service.ts needs:
        // the providerId and the agreed fare in paise. TTL matches the session (5min).
        await Promise.all(
            quotes.map(quote =>
                redis.set(
                    `quote_item:${quote.id}`,
                    JSON.stringify({
                        providerId: quote.providerId,
                        farePaise: quote.farePaise,
                        transportMode: data.transportMode,
                    }),
                    300
                )
            )
        );

        res.json({
            success: true,
            data: responseData,
        });

    } catch (error) {
        console.error('Quotes error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate ride quotes',
        });
    }
}