import { PrismaClient } from '../generated/prisma/client';
import { logger } from './logger';

const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS) || 500;

export const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'query', emit: 'event' },
  ],
});

prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
  if (e.duration > SLOW_QUERY_MS) {
    logger.warn('Slow query detected', {
      query: e.query,
      duration: e.duration,
      params: e.params,
    });
  }
});

prisma.$on('warn', (e: { message: string }) => {
  logger.warn('Prisma warning', { message: e.message });
});

prisma.$on('error', (e: { message: string }) => {
  logger.error('Prisma error', { message: e.message });
});
