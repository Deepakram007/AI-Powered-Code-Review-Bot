import { Router } from 'express';
import prisma from '../config/db';
import { redisConnection } from '../config/redis';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    // Quick test database
    await prisma.$queryRaw`SELECT 1`;

    // Test Redis connectivity
    const redisStatus = redisConnection.status;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: redisStatus,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

export default router;
