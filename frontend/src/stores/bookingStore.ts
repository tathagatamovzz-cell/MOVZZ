import { create } from 'zustand';
import apiClient from '../api/client';

interface Quote {
  id: string;
  providerId?: string;
  provider?: string;
  type: string;
  logo: string;
  price: number;
  eta: number;
  score?: number;
  reliability?: number;
  tag: string | null;
  surge?: boolean;
  farePaise: number;
  line?: string;
  stations?: number;
  duration?: string;
}

interface BookingState {
  quotes: Quote[];
  quoteId: string | null;
  currentBooking: any | null; // NEW: Store the active booking
  isLoading: boolean;
  error: string | null;
  fetchQuotes: (pickup: string, dropoff: string, transportMode: string) => Promise<void>;
  
  // MODIFIED: Added quoteId
  createBooking: (pickup: string, dropoff: string, quoteId: string) => Promise<boolean>; 
  
  // NEW: Polling action
  pollStatus: (bookingId: string) => Promise<void>; 
}

export const useBookingStore = create<BookingState>((set, get) => ({
  quotes: [],
  quoteId: null,
  currentBooking: null,
  isLoading: false,
  error: null,

  fetchQuotes: async (pickup, dropoff, transportMode) => {
    set({ isLoading: true, error: null, quotes: [] });
    try {
      const mockCoords = {
        pickupLat: 12.9941, pickupLng: 80.1709,
        dropoffLat: 13.0418, dropoffLng: 80.2341
      };

      const response = await apiClient.post('/quotes', {
        pickup,
        dropoff,
        transportMode: transportMode.toUpperCase(),
        ...mockCoords
      });

      if (response.data.success) {
        set({ quotes: response.data.data.quotes, quoteId: response.data.data.quoteId, isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to fetch rides', isLoading: false });
    }
  },

  // NEW METHOD: Actually create the booking in the database
  createBooking: async (pickup, dropoff, quoteId) => {
    set({ isLoading: true, error: null });
    try {
      const mockCoords = {
        pickupLat: 12.9941, pickupLng: 80.1709,
        dropoffLat: 13.0418, dropoffLng: 80.2341
      };

      const response = await apiClient.post('/bookings', {
        pickup,
        dropoff,
        quoteId,
        tripType: 'HIGH_RELIABILITY',
        ...mockCoords
      });

      if (response.data.success) {
        set({ isLoading: false, currentBooking: response.data.data});
        return true;
      }
      return false;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to book ride', isLoading: false });
      return false;
    }
  },
  pollStatus: async (bookingId) => {
    try {
      const response = await apiClient.get(`/bookings/${bookingId}`);
      if (response.data.success) {
        set({currentBooking: response.data.data });
      }
    } catch (err: any) {
      console.error("Failed to fetch booking status", err);
    }
  }
}));