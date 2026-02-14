import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { ProviderService } from './provider.service';
import { logger } from '../config/logger';

interface SearchRidesParams {
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  pickupAddress?: string;
  dropAddress?: string;
  vehicleTypes?: string[];
}

interface CreateBookingParams {
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  pickupAddress: string;
  dropAddress: string;
  provider: string;
  vehicleType: string;
  rideType?: string;
  estimatedPrice: number;
  paymentMethod: string;
}

export class BookingService {
  private providerService: ProviderService;

  constructor() {
    this.providerService = new ProviderService();
  }

  async searchRides(params: SearchRidesParams) {
    const { pickupLat, pickupLng, dropLat, dropLng, vehicleTypes } = params;

    // Calculate distance
    const distance = this.calculateDistance(
      pickupLat,
      pickupLng,
      dropLat,
      dropLng
    );

    // Get estimates from all providers
    const providers = ['uber', 'ola', 'rapido'];
    const types = vehicleTypes || ['cab', 'bike', 'auto'];

    const results = await Promise.allSettled(
      providers.flatMap((provider) =>
        types.map((vehicleType) =>
          this.providerService.getEstimate({
            pickupLat,
            pickupLng,
            dropLat,
            dropLng,
            provider,
            vehicleType,
          })
        )
      )
    );

    // Filter successful results
    const rides = results
      .filter((r) => r.status === 'fulfilled')
      .map((r: any) => r.value)
      .filter((r) => r !== null);

    // Sort by price
    rides.sort((a, b) => a.estimatedPrice - b.estimatedPrice);

    return {
      distance,
      rides,
      count: rides.length,
    };
  }

  async createBooking(userId: string, params: CreateBookingParams) {
    const distance = this.calculateDistance(
      params.pickupLat,
      params.pickupLng,
      params.dropLat,
      params.dropLng
    );

    // Create booking in database
    const booking = await prisma.booking.create({
      data: {
        userId,
        pickupAddress: params.pickupAddress,
        pickupLat: params.pickupLat,
        pickupLng: params.pickupLng,
        dropAddress: params.dropAddress,
        dropLat: params.dropLat,
        dropLng: params.dropLng,
        distance,
        provider: params.provider,
        vehicleType: params.vehicleType,
        rideType: params.rideType,
        estimatedPrice: params.estimatedPrice,
        paymentMethod: params.paymentMethod,
        status: 'PENDING',
      },
    });

    // TODO: Call provider API to actually book the ride
    // For now, we'll simulate it
    logger.info(`📦 Booking created: ${booking.id} for provider ${params.provider}`);

    // Update booking status to SEARCHING
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'SEARCHING' },
    });

    return booking;
  }

  async getUserBookings(
    userId: string,
    options: { status?: string; limit?: number; offset?: number }
  ) {
    const { status, limit = 10, offset = 0 } = options;

    const where: any = { userId };
    if (status) {
      where.status = status.toUpperCase();
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      bookings,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async getBookingById(bookingId: string, userId: string) {
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
      include: {
        legs: true,
      },
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found');
    }

    return booking;
  }

  async cancelBooking(bookingId: string, userId: string, reason?: string) {
    const booking = await this.getBookingById(bookingId, userId);

    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      throw new AppError(400, 'Cannot cancel this booking');
    }

    // TODO: Call provider API to cancel the ride

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    logger.info(`❌ Booking cancelled: ${bookingId}`);

    return updatedBooking;
  }

  async getBookingStatus(bookingId: string, userId: string) {
    const booking = await this.getBookingById(bookingId, userId);

    // TODO: Fetch real-time status from provider API

    return {
      bookingId: booking.id,
      status: booking.status,
      provider: booking.provider,
      driverName: booking.driverName,
      driverPhone: booking.driverPhone,
      vehicleNumber: booking.vehicleNumber,
      estimatedETA: booking.estimatedETA,
    };
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
