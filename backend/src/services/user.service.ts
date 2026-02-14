import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export class UserService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        profileImage: true,
        preferredLanguage: true,
        preferredPayment: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      email?: string;
      preferredLanguage?: string;
      preferredPayment?: string;
    }
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        profileImage: true,
        preferredLanguage: true,
        preferredPayment: true,
      },
    });

    return user;
  }

  async getSavedLocations(userId: string) {
    const locations = await prisma.savedLocation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return locations;
  }

  async addSavedLocation(
    userId: string,
    data: {
      label: string;
      address: string;
      latitude: number;
      longitude: number;
    }
  ) {
    const location = await prisma.savedLocation.create({
      data: {
        userId,
        ...data,
      },
    });

    return location;
  }

  async deleteSavedLocation(userId: string, locationId: string) {
    // Verify ownership
    const location = await prisma.savedLocation.findFirst({
      where: {
        id: locationId,
        userId,
      },
    });

    if (!location) {
      throw new AppError(404, 'Location not found');
    }

    await prisma.savedLocation.delete({
      where: { id: locationId },
    });
  }
}
