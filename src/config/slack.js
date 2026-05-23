const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

/**
 * Sends a notification to Slack channel via incoming webhooks.
 * @param {Object} details Review statistics and metadata
 * @param {string} details.repo Repository path (owner/name)
 * @param {number} details.prNumber Pull Request number
 * @param {string} details.prTitle Pull Request title
 * @param {string} details.prUrl Pull Request link
 * @param {string} details.author Author of the PR
 * @param {Object} details.stats Counts of each review category
 */
async function sendSlackNotification(details) {
  if (!slackWebhookUrl) {
    console.log('Slack integration not configured. Skipping Slack notification.');
    return;
  }

  const { repo, prNumber, prTitle, prUrl, author, stats } = details;
  const totalComments = stats.bug + stats.security + stats.performance + stats.style;

  // Modern Slack Block Kit formatting
  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🔍 AI PR Review Completed",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Repository:* \`${repo}\`\n*Pull Request:* <${prUrl}|#${prNumber} - ${prTitle}>\n*Author:* \`${author}\``
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*🐛 Bugs:* ${stats.bug}`
          },
          {
            type: "mrkdwn",
            text: `*🛡️ Security:* ${stats.security}`
          },
          {
            type: "mrkdwn",
            text: `*⚡ Performance:* ${stats.performance}`
          },
          {
            type: "mrkdwn",
            text: `*🎨 Style:* ${stats.style}`
          }
        ]
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Total suggestions: *${totalComments}* | Self-Learning Feedback Loop Active 🚀`
          }
        ]
      }
    ]
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
  } catch (error) {
    console.error('Failed to send Slack notification:', error.message);
  }
}

module.exports = {
  sendSlackNotification
};
