import { env } from './env';

export interface SlackNotificationDetails {
  repo: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  author: string;
  stats: {
    bug: number;
    security: number;
    performance: number;
    style: number;
  };
}

/**
 * Sends a review completion report block to the Slack Webhook integration.
 */
export async function sendSlackNotification(details: SlackNotificationDetails): Promise<void> {
  const slackWebhookUrl = env.SLACK_WEBHOOK_URL;
  if (!slackWebhookUrl) {
    console.log('Slack integration not configured. Skipping Slack notification.');
    return;
  }

  const { repo, prNumber, prTitle, prUrl, author, stats } = details;
  const totalComments = stats.bug + stats.security + stats.performance + stats.style;

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔍 AI PR Review Completed',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Repository:* \`${repo}\`\n*Pull Request:* <${prUrl}|#${prNumber} - ${prTitle}>\n*Author:* \`${author}\``,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*🐛 Bugs:* ${stats.bug}`,
          },
          {
            type: 'mrkdwn',
            text: `*🛡️ Security:* ${stats.security}`,
          },
          {
            type: 'mrkdwn',
            text: `*⚡ Performance:* ${stats.performance}`,
          },
          {
            type: 'mrkdwn',
            text: `*🎨 Style:* ${stats.style}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Total suggestions: *${totalComments}* | Self-Learning Feedback Loop Active 🚀`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack API responded with status ${response.status}: ${text}`);
    }
    console.log(`Slack notification sent successfully for ${repo} #${prNumber}`);
  } catch (error: any) {
    console.error('Failed to send Slack notification:', error.message);
  }
}
