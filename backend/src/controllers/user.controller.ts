import { Response } from 'express';
import { UserService } from '../services/user.service';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  preferredLanguage: z.string().optional(),
  preferredPayment: z.string().optional(),
});

const addLocationSchema = z.object({
  label: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    const profile = await this.userService.getProfile(req.user.id);

    res.json({
      success: true,
      data: profile,
    });
  });

  updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    const data = updateProfileSchema.parse(req.body);

    const profile = await this.userService.updateProfile(req.user.id, data);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profile,
    });
  });

  getSavedLocations = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    const locations = await this.userService.getSavedLocations(req.user.id);

    res.json({
      success: true,
      data: locations,
    });
  });

  addSavedLocation = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    const data = addLocationSchema.parse(req.body);

    const location = await this.userService.addSavedLocation(req.user.id, data);

    res.status(201).json({
      success: true,
      message: 'Location saved successfully',
      data: location,
    });
  });

  deleteSavedLocation = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    const { locationId } = req.params;

    await this.userService.deleteSavedLocation(req.user.id, locationId);

    res.json({
      success: true,
      message: 'Location deleted successfully',
    });
  });
}
