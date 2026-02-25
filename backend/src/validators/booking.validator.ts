import { z } from 'zod';

export const createBookingSchema = z.object({
    pickup: z.string().min(3, 'Pickup location is required').max(200),
    dropoff: z.string().min(3, 'Dropoff location is required').max(200),
    pickupLat: z.number().min(-90).max(90).optional(),
    pickupLng: z.number().min(-180).max(180).optional(),
    dropoffLat: z.number().min(-90).max(90).optional(),
    dropoffLng: z.number().min(-180).max(180).optional(),
    tripType: z.enum(['HIGH_RELIABILITY', 'STANDARD']).optional(),
    transportMode: z.enum(['CAB', 'BIKE', 'AUTO', 'METRO']).optional(),
    fareEstimate: z.number().int().min(0).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
