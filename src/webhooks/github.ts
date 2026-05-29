import { createNodeMiddleware } from 'octokit';
import { RequestHandler } from 'express';
import { env } from '../config/env';
import { webhookQueue } from '../queues/queueSetup';

/**
 * Builds and returns the GitHub webhook middleware.
 * Returns null when GitHub credentials are not yet configured (local dev without keys).
 */
export function buildWebhookMiddleware(): RequestHandler | null {
  if (!env.GITHUB_APP_ID || !env.GITHUB_PRIVATE_KEY || !env.GITHUB_WEBHOOK_SECRET) {
    console.warn(
      '[WebhookMiddleware] GitHub App credentials not configured. ' +
      'Webhook endpoint /api/github/webhooks is DISABLED. ' +
      'Set GITHUB_APP_ID, GITHUB_PRIVATE_KEY, and GITHUB_WEBHOOK_SECRET in .env to enable it.'
    );
    return null;
  }

  // Only import github config when credentials are present
  const { githubApp } = require('../config/github');

  // Register a global event handler to queue incoming webhooks immediately
  githubApp.webhooks.onAny(async ({ id, name, payload }: any) => {
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
          { event: name, action, payload },
          { jobId: id } // Enforces idempotency per event delivery
        );
        console.log(`[WebhookMiddleware] Enqueued ${name}.${action} (ID: ${id}).`);
      } catch (err: any) {
        console.error(`[WebhookMiddleware] Failed to queue event (ID: ${id}):`, err.message);
      }
    }
  });

  // Middleware exposes route /api/github/webhooks and verifies SHA256 signatures automatically
  return createNodeMiddleware(githubApp, {
    path: '/api/github/webhooks',
  } as any);
}
