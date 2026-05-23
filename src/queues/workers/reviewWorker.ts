import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../config/redis';
import { slackQueue } from '../queueSetup';
import { getInstallationClient } from '../../config/github';
import prisma from '../../config/db';
import { reviewPullRequest } from '../../services/aiService';
import { checkAndIncrementUsage } from '../../services/usageService';

export const reviewWorker = new Worker(
  'review-queue',
  async (job: Job) => {
    const {
      installationId,
      repoOwner,
      repoName,
      repoId,
      orgId,
      prNumber,
      commitSha,
      prTitle,
      prUrl,
      author,
    } = job.data;

    console.log(`[ReviewWorker] Processing PR review for ${repoOwner}/${repoName} #${prNumber}`);

    // 1. Resolve Organization / Tenant
    let org = await prisma.organization.findUnique({
      where: { githubOrgId: orgId },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          githubOrgId: orgId,
          name: repoOwner,
          billingPlan: 'FREE',
        },
      });
    }

    // 2. Resolve Repository
    let repo = await prisma.repository.findUnique({
      where: { githubRepoId: repoId },
    });

    if (!repo) {
      repo = await prisma.repository.create({
        data: {
          githubRepoId: repoId,
          name: repoName,
          fullName: `${repoOwner}/${repoName}`,
          owner: repoOwner,
          organizationId: org.id,
        },
      });
    }

    // 3. Quota check (SaaS Billing-Ready Quota Safeguard)
    const canReview = await checkAndIncrementUsage(org.id);
    if (!canReview) {
      console.warn(`[ReviewWorker] Quota limit exceeded for Org ${repoOwner}. Skipping review.`);
      await prisma.auditLog.create({
        data: {
          organizationId: org.id,
          action: 'REVIEW_SKIPPED_LIMIT_EXCEEDED',
          details: { repo: repo.fullName, prNumber },
        },
      });
      return;
    }

    // 4. Resolve Pull Request
    const pr = await prisma.pullRequest.upsert({
      where: {
        repositoryId_prNumber: {
          repositoryId: repo.id,
          prNumber,
        },
      },
      update: {
        title: prTitle,
        headSha: commitSha,
        state: 'OPEN',
      },
      create: {
        repositoryId: repo.id,
        prNumber,
        title: prTitle,
        htmlUrl: prUrl,
        author,
        headSha: commitSha,
        state: 'OPEN',
      },
    });

    // 5. Initialize Review Run
    const review = await prisma.review.create({
      data: {
        pullRequestId: pr.id,
        status: 'PENDING',
        stats: { bug: 0, security: 0, performance: 0, style: 0 },
        cost: 0.0,
      },
    });

    const octokit = await getInstallationClient(installationId);

    try {
      // 6. Fetch changed files in the Pull Request
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner: repoOwner,
        repo: repoName,
        pull_number: prNumber,
      });

      if (files.length === 0) {
        console.log(`[ReviewWorker] No files found in PR #${prNumber}. Completing review.`);
        await prisma.review.update({
          where: { id: review.id },
          data: { status: 'COMPLETED' },
        });
        return;
      }

      // 7. Perform AI review based on changed diff patches and rules
      const { comments, stats, cost, promptTokens, completionTokens } = await reviewPullRequest(
        org.id,
        repo.fullName,
        files
      );

      // Save token usage log to org tracking
      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      await prisma.usageTracking.upsert({
        where: {
          organizationId_currentMonth: {
            organizationId: org.id,
            currentMonth,
          },
        },
        update: {
          tokensUsed: { increment: promptTokens + completionTokens },
        },
        create: {
          organizationId: org.id,
          currentMonth,
          tokensUsed: promptTokens + completionTokens,
          prReviewedCount: 1,
        },
      });

      // 8. Handle review comments posting to GitHub
      if (comments.length > 0) {
        const reviewPayload = {
          owner: repoOwner,
          repo: repoName,
          pull_number: prNumber,
          commit_id: commitSha,
          event: 'COMMENT' as const,
          comments: comments.map((c) => ({
            path: c.path,
            line: c.line,
            side: c.side,
            body: c.body,
          })),
        };

        const { data: ghReview } = await octokit.rest.pulls.createReview(reviewPayload);
        console.log(`[ReviewWorker] Successfully created PR review ID: ${ghReview.id} with ${comments.length} comments.`);

        // Fetch comments with their unique GitHub Comment IDs to register in database for learning feedback loops
        const { data: postedComments } = await octokit.rest.pulls.listCommentsForReview({
          owner: repoOwner,
          repo: repoName,
          pull_number: prNumber,
          review_id: ghReview.id,
        });

        // Save review comments in local database
        for (const pc of postedComments) {
          const matchingAiComment = comments.find(
            (c) => c.path === pc.path && c.line === pc.line
          );

          if (matchingAiComment) {
            await prisma.reviewComment.create({
              data: {
                reviewId: review.id,
                githubCommentId: String(pc.id),
                repo: repo.fullName,
                prNumber,
                filePath: pc.path,
                line: matchingAiComment.line,
                codeSnippet: pc.diff_hunk,
                explanation: matchingAiComment.meta.explanation,
                suggestion: matchingAiComment.meta.suggestion,
                severity: matchingAiComment.meta.severity,
                commentType: matchingAiComment.meta.commentType,
                status: 'PENDING',
              },
            });
          }
        }
      } else {
        // Encourage the developer when no issues are found
        await octokit.rest.pulls.createReview({
          owner: repoOwner,
          repo: repoName,
          pull_number: prNumber,
          commit_id: commitSha,
          event: 'APPROVE' as const,
          body: '✨ **AI Review Complete:** Antigravity checked your changes and found no issues. Everything looks clean and solid! Great work! 🚀',
        });
        console.log('[ReviewWorker] PR approved with encouraging feedback.');
      }

      // 9. Update the Review Run status
      await prisma.review.update({
        where: { id: review.id },
        data: {
          status: 'COMPLETED',
          stats,
          cost,
        },
      });

      // 10. Queue Slack notification delivery job
      await slackQueue.add(`slack-notification-${repoOwner}-${repoName}-${prNumber}`, {
        repo: repo.fullName,
        prNumber,
        prTitle,
        prUrl,
        author,
        stats,
      });

      // Audit Log log entry
      await prisma.auditLog.create({
        data: {
          organizationId: org.id,
          action: 'REVIEW_COMPLETED',
          details: { repo: repo.fullName, prNumber, commentsCount: comments.length, cost },
        },
      });

    } catch (error: any) {
      console.error(`[ReviewWorker] Fail PR review for ${repoOwner}/${repoName} #${prNumber}:`, error.message);

      await prisma.review.update({
        where: { id: review.id },
        data: {
          status: 'FAILED',
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: org.id,
          action: 'REVIEW_FAILED',
          details: { repo: repo.fullName, prNumber, error: error.message },
        },
      });

      throw error; // Propagate for retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Limit concurrent reviews to protect LLM/DB resources
  }
);

reviewWorker.on('failed', (job, err) => {
  console.error(`[ReviewWorker] Review job ${job?.id} failed with error:`, err);
});
