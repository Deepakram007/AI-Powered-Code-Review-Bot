import { createNodeMiddleware } from 'octokit';
import { githubApp } from '../config/github';
import { webhookQueue } from '../queues/queueSetup';

// Register a global event handler to queue incoming webhooks immediately
githubApp.webhooks.onAny(async ({ id, name, payload }) => {
  const action = (payload as any).action || '';
  console.log(`[WebhookMiddleware] Intercepted event: ${name}.${action} (ID: ${id})`);

  const trackedEvents = [
    'pull_request',
    'pull_request_review_thread',
    'pull_request_review_comment',
  ];

  if (trackedEvents.includes(name)) {
    try {
      await webhookQueue.add(
        `${name}-${action}-${id}`,
        {
          event: name,
          action,
          payload,
        },
        {
          jobId: id, // Enforces idempotency per event delivery
        }
      );
      console.log(`[WebhookMiddleware] Enqueued event ${name}.${action} (ID: ${id}) successfully.`);
    } catch (err: any) {
      console.error(`[WebhookMiddleware] Failed to queue webhook event (ID: ${id}):`, err.message);
    }
  }
});

// Middleware exposes route /api/github/webhooks and verifies SHA256 signatures automatically
export const webhookMiddleware = createNodeMiddleware(githubApp, {
  path: '/api/github/webhooks',
} as any);
