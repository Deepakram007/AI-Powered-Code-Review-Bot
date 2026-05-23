import app from './app';
import { env } from './config/env';
import prisma from './config/db';
import { redisConnection } from './config/redis';

// Load BullMQ Workers to register listeners with Redis
import './queues/workers/webhookWorker';
import './queues/workers/reviewWorker';
import './queues/workers/slackWorker';

const PORT = env.PORT;

async function startServer() {
  try {
    // 1. Verify PostgreSQL Connection
    console.log('Testing connection to PostgreSQL database...');
    await prisma.$connect();
    console.log('Successfully connected to PostgreSQL database!');

    // 2. Verify Redis Connection
    console.log('Testing connection to Redis database...');
    await redisConnection.connect(); // Connect since lazyConnect is true

    // 3. Start Express Server
    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(` AI-Powered Code Review Bot Server Started`);
      console.log(` Port: ${PORT}`);
      console.log(` Environment: ${env.NODE_ENV}`);
      console.log(` Webhook URL path: /api/github/webhooks`);
      console.log(`===============================================`);
    });
  } catch (error) {
    console.error('Fatal: Failed to connect to database on startup. Exiting...', error);
    process.exit(1);
  }
}

// Graceful shutdown procedures
async function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down application...`);
  try {
    await prisma.$disconnect();
    console.log('Disconnected Prisma Client.');
    await redisConnection.quit();
    console.log('Disconnected Redis connection.');
    process.exit(0);
  } catch (err) {
    console.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
