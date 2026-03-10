import { create } from 'zustand';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
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
  currentBooking: any | null;
  isLoading: boolean;
  error: string | null;
  socket: Socket | null;
  fetchQuotes: (
    pickup: string, dropoff: string, transportMode: string,
    pickupLat?: number, pickupLng?: number,
    dropoffLat?: number, dropoffLng?: number,
  ) => Promise<void>;
  createBooking: (
    pickup: string, dropoff: string, quoteId: string,
    pickupLat?: number, pickupLng?: number,
    dropoffLat?: number, dropoffLng?: number,
  ) => Promise<boolean>;
  pollStatus: (bookingId: string) => Promise<void>;
  connectSocket: (token: string) => void;
  disconnectSocket: () => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  quotes: [],
  quoteId: null,
  currentBooking: null,
  isLoading: false,
  error: null,
  socket: null,

  fetchQuotes: async (pickup, dropoff, transportMode, pickupLat, pickupLng, dropoffLat, dropoffLng) => {
    set({ isLoading: true, error: null, quotes: [] });
    try {
      const response = await apiClient.post('/quotes', {
        pickup,
        dropoff,
        transportMode: transportMode.toUpperCase(),
        ...(pickupLat && pickupLng && dropoffLat && dropoffLng
          ? { pickupLat, pickupLng, dropoffLat, dropoffLng }
          : {}),
      });

      if (response.data.success) {
        set({ quotes: response.data.data.quotes, quoteId: response.data.data.quoteId, isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to fetch rides', isLoading: false });
    }
  },

  createBooking: async (pickup, dropoff, quoteId, pickupLat, pickupLng, dropoffLat, dropoffLng) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/bookings', {
        pickup,
        dropoff,
        quoteId,
        tripType: 'HIGH_RELIABILITY',
        ...(pickupLat && pickupLng && dropoffLat && dropoffLng
          ? { pickupLat, pickupLng, dropoffLat, dropoffLng }
          : {}),
      });

      if (response.data.success) {
        set({ isLoading: false, currentBooking: response.data.data });
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
        set({ currentBooking: response.data.data });
      }
    } catch (err: any) {
      console.error("Failed to fetch booking status", err);
    }
  },

  connectSocket: (token) => {
    const existing = get().socket;
    if (existing) {
      existing.off('booking:state_changed');
      existing.off('connect_error');
      existing.disconnect();
    }

    const backendUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace('/api/v1', '');
    const socket = io(backendUrl, { auth: { token } });

    socket.on('booking:state_changed', (data: any) => {
      set({ currentBooking: data });
    });

    socket.on('connect_error', (err: any) => {
      console.error('[Socket] Connection error:', err.message);
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.off('booking:state_changed');
      socket.off('connect_error');
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
