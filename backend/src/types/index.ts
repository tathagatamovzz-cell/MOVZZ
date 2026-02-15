export interface User {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  referralCode: string;
  referredBy?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface JWTPayload {
  userId: string;
  phone: string;
}

export interface AuthRequest {
  phone: string;
}

export interface VerifyOTPRequest {
  phone: string;
  otp: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
  expiresIn?: number;
}

export interface CreateBookingRequest {
  pickup: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoff: string;
  dropoffLat?: number;
  dropoffLng?: number;
  tripType?: 'HIGH_RELIABILITY' | 'STANDARD';
}

export interface BookingResponse {
  id: string;
  state: string;
  pickup: string;
  dropoff: string;
  fareEstimate: number;
  fareActual?: number;
  provider?: ProviderResponse;
  createdAt: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  timeoutAt?: Date;
}

export interface ProviderResponse {
  id: string;
  name: string;
  phone: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  rating: number;
  reliability: number;
  eta?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}