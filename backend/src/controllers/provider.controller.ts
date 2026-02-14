import { Request, Response } from 'express';
import { ProviderService } from '../services/provider.service';
import { asyncHandler } from '../middleware/errorHandler';
import { z } from 'zod';

const estimateSchema = z.object({
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropLat: z.number(),
  dropLng: z.number(),
  provider: z.string(),
  vehicleType: z.string(),
});

export class ProviderController {
  private providerService: ProviderService;

  constructor() {
    this.providerService = new ProviderService();
  }

  getAvailableProviders = asyncHandler(async (req: Request, res: Response) => {
    const providers = await this.providerService.getAvailableProviders();

    res.json({
      success: true,
      data: providers,
    });
  });

  getEstimate = asyncHandler(async (req: Request, res: Response) => {
    const data = estimateSchema.parse(req.body);

    const estimate = await this.providerService.getEstimate(data);

    res.json({
      success: true,
      data: estimate,
    });
  });

  compareProviders = asyncHandler(async (req: Request, res: Response) => {
    const { pickupLat, pickupLng, dropLat, dropLng, vehicleType } = req.query;

    const comparison = await this.providerService.compareProviders({
      pickupLat: parseFloat(pickupLat as string),
      pickupLng: parseFloat(pickupLng as string),
      dropLat: parseFloat(dropLat as string),
      dropLng: parseFloat(dropLng as string),
      vehicleType: vehicleType as string,
    });

    res.json({
      success: true,
      data: comparison,
    });
  });
}
