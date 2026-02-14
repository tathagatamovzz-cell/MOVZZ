import { config } from '../config/config';
import { logger } from '../config/logger';
import { prisma } from '../config/database';

interface EstimateParams {
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  provider: string;
  vehicleType: string;
}

export class ProviderService {
  async getAvailableProviders() {
    return [
      {
        id: 'uber',
        name: 'Uber',
        enabled: config.providers.uber.enabled,
        vehicleTypes: ['cab'],
      },
      {
        id: 'ola',
        name: 'Ola',
        enabled: config.providers.ola.enabled,
        vehicleTypes: ['cab', 'auto'],
      },
      {
        id: 'rapido',
        name: 'Rapido',
        enabled: config.providers.rapido.enabled,
        vehicleTypes: ['bike', 'cab', 'auto'],
      },
    ];
  }

  async getEstimate(params: EstimateParams) {
    const { provider, vehicleType } = params;

    // Check cache first
    if (config.features.caching) {
      const cached = await this.getCachedEstimate(params);
      if (cached) {
        logger.info(`💾 Cache hit for ${provider} ${vehicleType}`);
        return cached;
      }
    }

    // Get estimate from provider
    let estimate;
    switch (provider.toLowerCase()) {
      case 'uber':
        estimate = await this.getUberEstimate(params);
        break;
      case 'ola':
        estimate = await this.getOlaEstimate(params);
        break;
      case 'rapido':
        estimate = await this.getRapidoEstimate(params);
        break;
      default:
        logger.warn(`Unknown provider: ${provider}`);
        return null;
    }

    // Cache the result
    if (config.features.caching && estimate) {
      await this.cacheEstimate(params, estimate);
    }

    return estimate;
  }

  async compareProviders(params: {
    pickupLat: number;
    pickupLng: number;
    dropLat: number;
    dropLng: number;
    vehicleType: string;
  }) {
    const providers = ['uber', 'ola', 'rapido'];

    const estimates = await Promise.allSettled(
      providers.map((provider) =>
        this.getEstimate({ ...params, provider })
      )
    );

    const results = estimates
      .filter((r) => r.status === 'fulfilled')
      .map((r: any) => r.value)
      .filter((r) => r !== null);

    // Sort by price
    results.sort((a, b) => a.estimatedPrice - b.estimatedPrice);

    return {
      cheapest: results[0],
      fastest: results.reduce((prev, curr) =>
        prev.estimatedETA < curr.estimatedETA ? prev : curr
      ),
      all: results,
    };
  }

  // ============================================
  // PROVIDER-SPECIFIC IMPLEMENTATIONS
  // ============================================

  private async getUberEstimate(params: EstimateParams) {
    try {
      // TODO: Implement actual Uber API call
      // For now, return mock data
      logger.info('🚗 Fetching Uber estimate (mock)');

      const distance = this.calculateDistance(
        params.pickupLat,
        params.pickupLng,
        params.dropLat,
        params.dropLng
      );

      const basePrice = 50;
      const pricePerKm = 12;
      const estimatedPrice = basePrice + distance * pricePerKm;

      return {
        provider: 'uber',
        vehicleType: params.vehicleType,
        rideType: 'UberGo',
        estimatedPrice: Math.round(estimatedPrice),
        estimatedETA: Math.ceil(distance / 30 * 60), // Assuming 30 km/h
        currency: 'INR',
        distance,
        availability: true,
        surgeMultiplier: 1.0,
      };
    } catch (error) {
      logger.error('Uber API error:', error);
      await this.logProviderError('uber', error);
      return null;
    }
  }

  private async getOlaEstimate(params: EstimateParams) {
    try {
      // TODO: Implement actual Ola API call
      logger.info('🚕 Fetching Ola estimate (mock)');

      const distance = this.calculateDistance(
        params.pickupLat,
        params.pickupLng,
        params.dropLat,
        params.dropLng
      );

      const basePrice = 45;
      const pricePerKm = 11;
      const estimatedPrice = basePrice + distance * pricePerKm;

      return {
        provider: 'ola',
        vehicleType: params.vehicleType,
        rideType: params.vehicleType === 'cab' ? 'Ola Mini' : 'Ola Auto',
        estimatedPrice: Math.round(estimatedPrice),
        estimatedETA: Math.ceil(distance / 28 * 60),
        currency: 'INR',
        distance,
        availability: true,
        surgeMultiplier: 1.0,
      };
    } catch (error) {
      logger.error('Ola API error:', error);
      await this.logProviderError('ola', error);
      return null;
    }
  }

  private async getRapidoEstimate(params: EstimateParams) {
    try {
      // TODO: Implement actual Rapido API call
      logger.info('🏍️ Fetching Rapido estimate (mock)');

      const distance = this.calculateDistance(
        params.pickupLat,
        params.pickupLng,
        params.dropLat,
        params.dropLng
      );

      let basePrice, pricePerKm;
      if (params.vehicleType === 'bike') {
        basePrice = 25;
        pricePerKm = 7;
      } else {
        basePrice = 40;
        pricePerKm = 10;
      }

      const estimatedPrice = basePrice + distance * pricePerKm;

      return {
        provider: 'rapido',
        vehicleType: params.vehicleType,
        rideType: params.vehicleType === 'bike' ? 'Rapido Bike' : 'Rapido Cab',
        estimatedPrice: Math.round(estimatedPrice),
        estimatedETA: Math.ceil(distance / 25 * 60),
        currency: 'INR',
        distance,
        availability: true,
        surgeMultiplier: 1.0,
      };
    } catch (error) {
      logger.error('Rapido API error:', error);
      await this.logProviderError('rapido', error);
      return null;
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async getCachedEstimate(params: EstimateParams) {
    const routeHash = this.generateRouteHash(params);

    const cached = await prisma.providerCache.findUnique({
      where: {
        provider_routeHash_vehicleType: {
          provider: params.provider,
          routeHash,
          vehicleType: params.vehicleType,
        },
      },
    });

    if (cached && cached.expiresAt > new Date()) {
      return {
        provider: cached.provider,
        vehicleType: cached.vehicleType,
        estimatedPrice: cached.estimatedPrice,
        estimatedETA: cached.estimatedETA,
        availability: cached.availability,
        surgeMultiplier: cached.surgeMultiplier,
        cached: true,
      };
    }

    return null;
  }

  private async cacheEstimate(params: EstimateParams, estimate: any) {
    const routeHash = this.generateRouteHash(params);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.providerCache.upsert({
      where: {
        provider_routeHash_vehicleType: {
          provider: params.provider,
          routeHash,
          vehicleType: params.vehicleType,
        },
      },
      create: {
        provider: params.provider,
        routeHash,
        vehicleType: params.vehicleType,
        estimatedPrice: estimate.estimatedPrice,
        estimatedETA: estimate.estimatedETA,
        availability: estimate.availability,
        surgeMultiplier: estimate.surgeMultiplier,
        rawResponse: estimate,
        expiresAt,
      },
      update: {
        estimatedPrice: estimate.estimatedPrice,
        estimatedETA: estimate.estimatedETA,
        availability: estimate.availability,
        surgeMultiplier: estimate.surgeMultiplier,
        rawResponse: estimate,
        expiresAt,
      },
    });
  }

  private async logProviderError(provider: string, error: any) {
    await prisma.providerLog.create({
      data: {
        provider,
        endpoint: 'estimate',
        method: 'POST',
        success: false,
        errorMessage: error.message,
      },
    });
  }

  private generateRouteHash(params: EstimateParams): string {
    // Round coordinates to 3 decimal places for caching
    const pickup = `${params.pickupLat.toFixed(3)},${params.pickupLng.toFixed(3)}`;
    const drop = `${params.dropLat.toFixed(3)},${params.dropLng.toFixed(3)}`;
    return `${pickup}-${drop}`;
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
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
