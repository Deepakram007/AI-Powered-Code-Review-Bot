import Redis from 'ioredis';
import { env } from './env';

// BullMQ requires maxRetriesPerRequest to be null on Redis client options
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true, // Don't block event loop immediately during init
});

redisConnection.on('error', (err) => {
  console.error('Redis Connection Error:', err);
});

redisConnection.on('connect', () => {
  console.log('Successfully connected to Redis database.');
});
