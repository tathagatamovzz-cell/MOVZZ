import { Response } from 'express';
import { BookingService } from '../services/booking.service';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const searchRidesSchema = z.object({
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropLat: z.number().min(-90).max(90),
  dropLng: z.number().min(-180).max(180),
  pickupAddress: z.string().optional(),
  dropAddress: z.string().optional(),
  vehicleTypes: z.array(z.enum(['cab', 'bike', 'auto', 'metro'])).optional(),
});

const createBookingSchema = z.object({
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropLat: z.number(),
  dropLng: z.number(),
  pickupAddress: z.string(),
  dropAddress: z.string(),
  provider: z.string(),
  vehicleType: z.string(),
  rideType: z.string().optional(),
  estimatedPrice: z.number(),
  paymentMethod: z.string().default('cash'),
});

export class BookingController {
  private bookingService: BookingService;

  constructor() {
    this.bookingService = new BookingService();
  }

  searchRides = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = searchRidesSchema.parse(req.body);

    const results = await this.bookingService.searchRides(data);

    res.json({
      success: true,
      data: results,
    });
  });

  createBooking = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    const data = createBookingSchema.parse(req.body);

    const booking = await this.bookingService.createBooking(req.user.id, data);

    // Emit real-time update via WebSocket
    const io = req.app.get('io');
    io.to(`user:${req.user.id}`).emit('booking:created', booking);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
    });
  });

  getUserBookings = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    const { status, limit = '10', offset = '0' } = req.query;

    const bookings = await this.bookingService.getUserBookings(req.user.id, {
      status: status as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      data: bookings,
    });
  });

  getBookingById = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    const { bookingId } = req.params;

    const booking = await this.bookingService.getBookingById(
      bookingId,
      req.user.id
    );

    res.json({
      success: true,
      data: booking,
    });
  });

  cancelBooking = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await this.bookingService.cancelBooking(
      bookingId,
      req.user.id,
      reason
    );

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`user:${req.user.id}`).emit('booking:cancelled', booking);

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking,
    });
  });

  getBookingStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    const { bookingId } = req.params;

    const status = await this.bookingService.getBookingStatus(
      bookingId,
      req.user.id
    );

    res.json({
      success: true,
      data: status,
    });
  });
}
