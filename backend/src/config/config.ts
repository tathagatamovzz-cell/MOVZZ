import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  // Database
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  },

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  // Provider APIs
  providers: {
    uber: {
      clientId: process.env.UBER_CLIENT_ID || '',
      clientSecret: process.env.UBER_CLIENT_SECRET || '',
      serverToken: process.env.UBER_SERVER_TOKEN || '',
      enabled: process.env.ENABLE_UBER === 'true',
    },
    ola: {
      apiKey: process.env.OLA_API_KEY || '',
      apiSecret: process.env.OLA_API_SECRET || '',
      enabled: process.env.ENABLE_OLA === 'true',
    },
    rapido: {
      apiKey: process.env.RAPIDO_API_KEY || '',
      enabled: process.env.ENABLE_RAPIDO === 'true',
    },
  },

  // Google Maps
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Feature Flags
  features: {
    caching: process.env.ENABLE_CACHING === 'true',
    metro: process.env.ENABLE_METRO === 'true',
  },
} as const;

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

const missingEnvVars = requiredEnvVars.filter(
  (envVar) => !process.env[envVar]
);

if (missingEnvVars.length > 0 && config.env === 'production') {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

export default config;
