import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import authRouter from './routes/auth';
import companiesRouter from './routes/companies';
import servicesRouter from './routes/services';
import clientsRouter from './routes/clients';
import vehiclesRouter from './routes/vehicles';
import inventoryRouter from './routes/inventory';
import billsRouter from './routes/bills';
import appointmentsRouter from './routes/appointments';
import publicRouter from './routes/public';
import uploadRouter from './routes/upload';
import dashboardRouter from './routes/dashboard';
import { authMiddleware } from './middleware/auth';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers — allow cross-origin for uploaded images
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — allowed origins from env, default to Vite dev server
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Rate limiters — use skip function in test to avoid flaky tests
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
});

const publicAppointmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    logger.error('Health check failed', { error: String(err) });
    res.status(503).json({ status: 'unhealthy', db: 'disconnected' });
  }
});

// Auth routes with rate limiting
app.use('/auth', authLimiter, authRouter);

// Public routes — appointment POST gets stricter rate limiting
app.use('/public/*/appointments', publicAppointmentLimiter);
app.use('/public', publicRouter);

// Protected routes
app.use('/companies', authMiddleware, companiesRouter);
app.use('/services', authMiddleware, servicesRouter);
app.use('/clients', authMiddleware, clientsRouter);
app.use('/', authMiddleware, vehiclesRouter);
app.use('/inventory', authMiddleware, inventoryRouter);
app.use('/bills', authMiddleware, billsRouter);
app.use('/appointments', authMiddleware, appointmentsRouter);
app.use('/upload', authMiddleware, uploadRouter);
app.use('/dashboard', authMiddleware, dashboardRouter);

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  server.close(async () => {
    logger.info('HTTP server closed');
    await prisma.$disconnect();
    logger.info('Database disconnected');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { server };
export default app;
