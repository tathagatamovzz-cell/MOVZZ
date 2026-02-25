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

        // 2. Get Fare Estimates (Handles surge, distance, base rates)
        const fareEstimate = estimateFares(
            data.transportMode,
            data.pickupLat,
            data.pickupLng,
            data.dropoffLat,
            data.dropoffLng
        );

        // 3. Handle METRO Mode (Bypasses provider scoring)
        if (data.transportMode === 'METRO') {
            if (fareEstimate.metroFares) {
                fareEstimate.metroFares.forEach((mFare, index) => {
                    quotes.push({
                        id: crypto.randomUUID(),
                        type: 'Metro',
                        line: mFare.line,
                        stations: mFare.stationCount,
                        price: mFare.totalFareRupees,
                        eta: 2 + index, // Mock initial wait time
                        duration: `${mFare.estimatedDurationMin} min`,
                        farePaise: mFare.totalFare
                    });
                });
            }
        }
        // 4. Handle CAB, BIKE, AUTO (Requires Provider Scoring)
        else {
            // Get top providers to fulfill the request
            const providers = await findTopProviders(5, [], 'STANDARD');

            if (providers.length === 0) {
                res.status(404).json({
                    success: false,
                    error: 'No available providers in your area at the moment. Please try again later.'
                });
                return;
            }

            // Map the calculated fare tiers to the available providers
            fareEstimate.fares.forEach((fareTier, index) => {
                // Assign a provider to this tier (cycling through available ones)
                const provider = providers[index % providers.length];

                // Assign UI Tags based on the tier
                let tag = null;
                if (index === 0) tag = "Cheapest";
                if (index === fareEstimate.fares.length - 1 && fareEstimate.fares.length > 1) tag = "Premium";
                if (index === 0 && provider.score >= 90) tag = "Best Match"; // Override if it's highly reliable

                quotes.push({
                    id: crypto.randomUUID(),
                    providerId: provider.providerId,
                    provider: provider.name,
                    type: fareTier.tierName,
                    logo: data.transportMode === 'CAB' ? 'uber' : data.transportMode === 'AUTO' ? 'ola' : 'rapido', // Mock logo for frontend mapping
                    price: fareTier.totalFareRupees,
                    eta: 4 + index * 2, // Mock ETA based on proximity
                    score: Math.round(provider.score),
                    reliability: Math.round(provider.reliability * 100),
                    tag: tag,
                    surge: fareTier.surgeMultiplier > 1.0,
                    farePaise: fareTier.totalFare
                });
            });
        }

        // 5. Structure the Response
        const responseData = {
            quoteId,
            quotes,
            metadata: {
                distanceKm: fareEstimate.distanceKm,
                estimatedDurationMin: fareEstimate.estimatedDurationMin,
                quotesValidFor: 300 // Valid for 5 minutes
            }
        };

        // 6. Cache the quotes in Redis
        await redis.set(`quote:${quoteId}`, JSON.stringify(responseData), 300);

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error('Quotes error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate ride quotes',
        });
    }
}