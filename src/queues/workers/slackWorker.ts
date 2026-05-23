import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../config/redis';
import { sendSlackNotification } from '../../config/slack';

export const slackWorker = new Worker(
  'slack-queue',
  async (job: Job) => {
    const details = job.data;
    console.log(`[SlackWorker] Dispatched review stats to Slack for ${details.repo} #${details.prNumber}`);

    try {
      await sendSlackNotification(details);
    } catch (error: any) {
      console.error(`[SlackWorker] Failed to dispatch notification for job ${job.id}:`, error.message);
      throw error; // Let BullMQ retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

slackWorker.on('failed', (job, err) => {
  console.error(`[SlackWorker] Slack job ${job?.id} failed with error:`, err);
});
