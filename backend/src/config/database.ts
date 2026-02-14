import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Singleton pattern for Prisma Client
class Database {
  private static instance: PrismaClient;

  private constructor() {}

  public static getInstance(): PrismaClient {
    if (!Database.instance) {
      Database.instance = new PrismaClient({
        log: [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'warn', emit: 'event' },
        ],
      });

      // Log queries in development
      if (process.env.NODE_ENV === 'development') {
        Database.instance.$on('query' as never, (e: any) => {
          logger.debug(`Query: ${e.query}`);
          logger.debug(`Duration: ${e.duration}ms`);
        });
      }

      // Log errors
      Database.instance.$on('error' as never, (e: any) => {
        logger.error(`Database error: ${e.message}`);
      });

      // Log warnings
      Database.instance.$on('warn' as never, (e: any) => {
        logger.warn(`Database warning: ${e.message}`);
      });

      logger.info('✅ Database connection established');
    }

    return Database.instance;
  }

  public static async disconnect(): Promise<void> {
    if (Database.instance) {
      await Database.instance.$disconnect();
      logger.info('✅ Database connection closed');
    }
  }
}

export const prisma = Database.getInstance();
export default prisma;
