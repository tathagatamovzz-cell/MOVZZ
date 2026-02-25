import { z } from 'zod';

export const createBookingSchema = z.object({
    pickup: z.string().min(3, 'Pickup location is required').max(200),
    dropoff: z.string().min(3, 'Dropoff location is required').max(200),
    pickupLat: z.number().min(-90).max(90).optional(),
    pickupLng: z.number().min(-180).max(180).optional(),
    dropoffLat: z.number().min(-90).max(90).optional(),
    dropoffLng: z.number().min(-180).max(180).optional(),
    tripType: z.enum(['HIGH_RELIABILITY', 'STANDARD']).optional(),
    // NOTE: Correct enum value is BIKE — not BIKE_TAXI as the roadmap specifies.
    // The roadmap's Phase 1A enum definition is wrong. Do not follow it.
    transportMode: z.enum(['CAB', 'BIKE', 'AUTO', 'METRO']).optional(),
    fareEstimate: z.number().int().min(0).optional(),
    // FIX 1: Added quoteId so it survives Zod validation and reaches the service.
    // Previously this field was sent by the frontend but silently stripped here,
    // breaking the quote-to-booking linkage described in the roadmap.
    quoteId: z.string().uuid('quoteId must be a valid UUID').optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;