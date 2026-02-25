import { z } from 'zod';

export const getQuotesSchema = z.object({
    pickup: z.string().min(3, 'Pickup location is required').max(200),
    dropoff: z.string().min(3, 'Dropoff location is required').max(200),
    pickupLat: z.number().min(-90).max(90).optional(),
    pickupLng: z.number().min(-180).max(180).optional(),
    dropoffLat: z.number().min(-90).max(90).optional(),
    dropoffLng: z.number().min(-180).max(180).optional(),
    transportMode: z.enum(['CAB', 'BIKE', 'AUTO', 'METRO'])
});

export type GetQuotesInput = z.infer<typeof getQuotesSchema>;