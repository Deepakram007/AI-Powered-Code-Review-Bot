import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../config/redis';
import { reviewQueue } from '../queueSetup';
import { handleThreadResolved, handleReviewCommentCreated } from '../../services/feedbackService';

export const webhookWorker = new Worker(
  'webhook-queue',
  async (job: Job) => {
    const { event, action, payload } = job.data;
    console.log(`Processing queued webhook event: ${event}.${action} (Job ID: ${job.id})`);

    try {
      if (event === 'pull_request') {
        if (action === 'opened' || action === 'synchronize') {
          const repoOwner = payload.repository.owner.login;
          const repoName = payload.repository.name;
          const repoId = String(payload.repository.id);
          const orgId = String(payload.installation?.id);
          const prNumber = payload.pull_request.number;
          const commitSha = payload.pull_request.head.sha;
          const prTitle = payload.pull_request.title;
          const prUrl = payload.pull_request.html_url;
          const author = payload.pull_request.user.login;

          if (!orgId) {
            console.warn(`Skipping PR review for ${repoOwner}/${repoName} #${prNumber}: No installation ID provided.`);
            return;
          }

          // Queue the review job
          await reviewQueue.add(
            `review-${repoOwner}-${repoName}-${prNumber}`,
            {
              installationId: payload.installation.id,
              repoOwner,
              repoName,
              repoId,
              orgId,
              prNumber,
              commitSha,
              prTitle,
              prUrl,
              author,
            },
            {
              jobId: `review-${repoOwner}-${repoName}-${prNumber}-${commitSha}`, // Prevent duplicate reviews for the same commit
            }
          );
          console.log(`Queued review job for ${repoOwner}/${repoName} #${prNumber} (commit: ${commitSha})`);
        }
      } else if (event === 'pull_request_review_thread' && action === 'resolved') {
        await handleThreadResolved(payload.thread);
      } else if (event === 'pull_request_review_comment' && action === 'created') {
        await handleReviewCommentCreated(payload.comment);
      }
    } catch (error: any) {
      console.error(`Error processing webhook job ${job.id}:`, error.message);
      throw error; // Let BullMQ handle retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

webhookWorker.on('failed', (job, err) => {
  console.error(`Webhook job ${job?.id} failed with error:`, err);
});
