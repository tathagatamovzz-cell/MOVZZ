// frontend/src/stores/authStore.ts
import { create } from 'zustand';
import apiClient from '../api/client';

interface AuthState {
  token: string | null;
  tokenExpiry: number | null;
  isAuthenticated: boolean;
  otpSent: boolean;
  phone: string;
  isLoading: boolean;
  error: string | null;
  sendOTP: (phone: string) => Promise<boolean>;
  verifyOTP: (otp: string) => Promise<boolean>;
  loginWithOAuthToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const storedExpiry = parseInt(localStorage.getItem('movzz_token_expiry') || '0');
  const isExpired = storedExpiry > 0 && storedExpiry < Date.now();
  const storedToken = isExpired ? null : (localStorage.getItem('movzz_token') || null);

  if (isExpired) {
    localStorage.removeItem('movzz_token');
    localStorage.removeItem('movzz_token_expiry');
  }

  return {
    token: storedToken,
    tokenExpiry: isExpired ? null : (storedExpiry || null),
    isAuthenticated: !!storedToken,
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
      
      console.log('[AuthStore] OTP Response:', response.data);
      if (response.data.success && response.data.data.token) {
        const token = response.data.data.token;
        console.log('[AuthStore] Token received:', typeof token, token.substring(0, 20));
        const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
        localStorage.setItem('movzz_token', token);
        localStorage.setItem('movzz_token_expiry', String(expiry));
        set({
          token,
          tokenExpiry: expiry,
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

    loginWithOAuthToken: (token) => {
      const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
      localStorage.setItem('movzz_token', token);
      localStorage.setItem('movzz_token_expiry', String(expiry));
      set({ token, tokenExpiry: expiry, isAuthenticated: true });
    },

    logout: () => {
      localStorage.removeItem('movzz_token');
      localStorage.removeItem('movzz_token_expiry');
      set({ token: null, tokenExpiry: null, isAuthenticated: false, otpSent: false, phone: '' });
    }
  };
});