// frontend/src/stores/authStore.ts
import { create } from 'zustand';
import apiClient from '../api/client';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  otpSent: boolean;
  phone: string;
  isLoading: boolean;
  error: string | null;
  sendOTP: (phone: string) => Promise<boolean>;
  verifyOTP: (otp: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('movzz_token') || null,
  isAuthenticated: !!localStorage.getItem('movzz_token'),
  otpSent: false,
  phone: '',
  isLoading: false,
  error: null,

  sendOTP: async (phone: string) => {
    // ADD THIS LINE: Instantly reject if a request is already in flight
    if (get().isLoading) return false; 

    set({ isLoading: true, error: null });
    try {
      // Assuming your backend expects format: +919876543210
      const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
      const response = await apiClient.post('/auth/send-otp', { phone: formattedPhone });
      
      if (response.data.success) {
        set({ otpSent: true, phone: formattedPhone, isLoading: false });
        return true;
      }
      return false;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to send OTP', isLoading: false });
      return false;
    }
  },

  verifyOTP: async (otp: string) => {
    // ADD THIS LINE: Instantly reject if a request is already in flight
    if (get().isLoading || get().isAuthenticated) return false; 

    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/verify-otp', { 
        phone: get().phone, 
        otp 
      });
      
      if (response.data.success && response.data.data.token) {
        const token = response.data.data.token;
        localStorage.setItem('movzz_token', token);
        set({ 
          token, 
          isAuthenticated: true, 
          isLoading: false,
          otpSent: false // Reset for future
        });
        return true;
      }
      return false;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Invalid OTP', isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('movzz_token');
    set({ token: null, isAuthenticated: false, otpSent: false, phone: '' });
  }
}));