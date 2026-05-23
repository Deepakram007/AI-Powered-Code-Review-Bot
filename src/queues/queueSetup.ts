import { Queue, DefaultJobOptions } from 'bullmq';
import { redisConnection } from '../config/redis';

const defaultJobOptions: DefaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 5000, // starts at 5s backoff
  },
  removeOnComplete: {
    age: 3600 * 24, // keep for 24 hours
    count: 1000,   // or max 1000 items
  },
  removeOnFail: {
    age: 3600 * 24 * 7, // keep failures for 7 days
    count: 2000,
  },
};

export const webhookQueue = new Queue('webhook-queue', {
  connection: redisConnection,
  defaultJobOptions,
});

export const reviewQueue = new Queue('review-queue', {
  connection: redisConnection,
  defaultJobOptions,
});

export const slackQueue = new Queue('slack-queue', {
  connection: redisConnection,
  defaultJobOptions,
});
