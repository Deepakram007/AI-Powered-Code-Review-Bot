const { createNodeMiddleware } = require('octokit');
const { app: githubApp } = require('../config/github');
const db = require('../config/db');
const { reviewPullRequest } = require('../services/aiReviewer');
const { sendSlackNotification } = require('../config/slack');
const { handleThreadResolved, handleReviewCommentCreated } = require('../services/feedbackService');

// Listen to pull request opened or synchronized events
githubApp.webhooks.on(['pull_request.opened', 'pull_request.synchronize'], async ({ octokit, payload }) => {
  const repoOwner = payload.repository.owner.login;
  const repoName = payload.repository.name;
  const repoPath = `${repoOwner}/${repoName}`;
  const prNumber = payload.pull_request.number;
  const commitSha = payload.pull_request.head.sha;
  const prTitle = payload.pull_request.title;
  const prUrl = payload.pull_request.html_url;
  const author = payload.pull_request.user.login;

  console.log(`Received PR webhook: ${repoPath} #${prNumber} (${payload.action})`);

  try {
    // 1. Fetch files in the pull request
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: repoOwner,
      repo: repoName,
      pull_number: prNumber
    });

    if (files.length === 0) {
      console.log(`No files modified in PR #${prNumber}. Skipping review.`);
      return;
    }

    // 2. Perform AI review
    const { comments, stats } = await reviewPullRequest(repoPath, files);

    // 3. Post review to GitHub
    if (comments.length > 0) {
      const reviewPayload = {
        owner: repoOwner,
        repo: repoName,
        pull_number: prNumber,
        commit_id: commitSha,
        event: 'COMMENT',
        comments: comments.map(c => ({
          path: c.path,
          line: c.line,
          side: c.side,
          body: c.body
        }))
      };

      const { data: review } = await octokit.rest.pulls.createReview(reviewPayload);
      console.log(`Successfully created PR review review_id: ${review.id} with ${comments.length} comments.`);

      // 4. Retrieve comments with their GitHub Comment IDs to register in database
      const { data: postedComments } = await octokit.rest.pulls.listCommentsForReview({
        owner: repoOwner,
        repo: repoName,
        pull_number: prNumber,
        review_id: review.id
      });

      // Save references in database for feedback learning
      for (const pc of postedComments) {
        const matchingAiComment = comments.find(
          c => c.path === pc.path && c.line === pc.line
        );

        if (matchingAiComment) {
          await db.reviewComment.create({
            data: {
              githubCommentId: String(pc.id),
              repo: repoPath,
              prNumber,
              filePath: pc.path,
              line: pc.line,
              codeSnippet: pc.diff_hunk,
              explanation: matchingAiComment.meta.explanation,
              suggestion: matchingAiComment.meta.suggestion,
              status: 'PENDING'
            }
          });
        }
      }
    } else {
      // Post general encouraging comment if clean review
      await octokit.rest.pulls.createReview({
        owner: repoOwner,
        repo: repoName,
        pull_number: prNumber,
        commit_id: commitSha,
        event: 'APPROVE',
        body: '✨ **AI Review Complete:** Antigravity checked your changes and found no issues. Everything looks clean and solid! Great work! 🚀'
      });
      console.log(`No issues found. PR Approved with encouraging comment.`);
    }

    // 5. Send Slack notification summarizing the review
    await sendSlackNotification({
      repo: repoPath,
      prNumber,
      prTitle,
      prUrl,
      author,
      stats
    });

  } catch (error) {
    console.error(`Error processing review for ${repoPath} #${prNumber}:`, error.message);
  }
});

// Listen for resolved comment threads to update learning status
githubApp.webhooks.on('pull_request_review_thread.resolved', async ({ payload }) => {
  console.log(`Webhook thread resolved event on PR #${payload.pull_request.number}`);
  await handleThreadResolved(payload.thread);
});

// Listen for comment replies to analyze feedback sentiment
githubApp.webhooks.on('pull_request_review_comment.created', async ({ payload }) => {
  console.log(`Webhook review comment created event on PR #${payload.pull_request.number}`);
  await handleReviewCommentCreated(payload.comment);
});

// Export the webhook handler middleware
const webhookMiddleware = createNodeMiddleware(githubApp, {
  path: '/api/github/webhooks'
});

module.exports = {
  webhookMiddleware
};
