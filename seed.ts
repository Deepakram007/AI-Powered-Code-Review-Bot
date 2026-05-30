import prisma from './src/config/db';

async function seed() {
  console.log('Seeding mock data into local database...');

  // 1. Create Organization
  const org = await prisma.organization.upsert({
    where: { githubOrgId: '123456' },
    update: {},
    create: {
      id: 'a0f7e4c3-bdf5-4d7a-bcf8-5182a0b12e34',
      name: 'Antigravity Team',
      githubOrgId: '123456',
      billingPlan: 'PRO',
    },
  });
  console.log(`Created Organization: ${org.name} (ID: ${org.id})`);

  // 2. Create User
  const user = await prisma.user.upsert({
    where: { githubId: '987654' },
    update: {},
    create: {
      id: 'u1234567-89ab-cdef-0123-456789abcdef',
      email: 'admin@antigravity.dev',
      name: 'Deepak Ram',
      githubId: '987654',
    },
  });

  // 3. Create Org Member
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: {},
    create: {
      userId: user.id,
      organizationId: org.id,
      role: 'OWNER',
    },
  });

  // 4. Create Repository
  const repo = await prisma.repository.upsert({
    where: { githubRepoId: '556677' },
    update: {},
    create: {
      id: 'r8888888-8888-8888-8888-888888888888',
      githubRepoId: '556677',
      name: 'AI-Powered-Code-Review-Bot',
      fullName: 'Deepakram007/AI-Powered-Code-Review-Bot',
      owner: 'Deepakram007',
      organizationId: org.id,
    },
  });

  // 5. Create Usage Stats for Current & Past Month
  const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g. "2026-05"
  await prisma.usageTracking.upsert({
    where: { organizationId_currentMonth: { organizationId: org.id, currentMonth: currentMonthStr } },
    update: {},
    create: {
      organizationId: org.id,
      prReviewedCount: 14,
      tokensUsed: 620500,
      currentMonth: currentMonthStr,
    },
  });

  // 6. Create Prompt Rules
  const rules = [
    {
      repoPattern: '*',
      ruleType: 'BUG',
      description: 'Always catch and handle database exceptions inside async controller endpoints.',
    },
    {
      repoPattern: '*',
      ruleType: 'SECURITY',
      description: 'Never write raw database credentials, keys or authorization tokens inside files. Use env variables.',
    },
    {
      repoPattern: 'Deepakram007/*',
      ruleType: 'PERFORMANCE',
      description: 'Enforce connection pool sharing on database calls instead of opening raw connections inside loops.',
    },
    {
      repoPattern: '*',
      ruleType: 'STYLE',
      description: 'Align structure spacing using HSL variable tokens instead of absolute pixel codes in CSS files.',
    },
  ];

  for (const r of rules) {
    await prisma.teamRule.create({
      data: {
        organizationId: org.id,
        repoPattern: r.repoPattern,
        ruleType: r.ruleType,
        description: r.description,
        enabled: true,
      },
    });
  }

  // 7. Create Pull Request & Review
  const pr = await prisma.pullRequest.upsert({
    where: { repositoryId_prNumber: { repositoryId: repo.id, prNumber: 42 } },
    update: {},
    create: {
      id: 'p4444444-4444-4444-4444-444444444442',
      repositoryId: repo.id,
      prNumber: 42,
      title: 'Refactor prompter and fix UI alignment spacing',
      htmlUrl: 'https://github.com/Deepakram007/AI-Powered-Code-Review-Bot/pull/42',
      author: 'deepak',
      state: 'OPEN',
      headSha: 'abc123headsha',
    },
  });

  const review = await prisma.review.create({
    data: {
      pullRequestId: pr.id,
      status: 'COMPLETED',
      cost: 0.08,
      stats: { BUG: 1, SECURITY: 1, STYLE: 1 },
    },
  });

  // 8. Create Review Comments (sentiment triggers)
  await prisma.reviewComment.createMany({
    data: [
      {
        reviewId: review.id,
        githubCommentId: 'c_001',
        repo: repo.fullName,
        prNumber: pr.prNumber,
        filePath: 'src/services/aiService.ts',
        line: 45,
        codeSnippet: 'const response = await openai.chat.completions.create({\n  model: "gpt-4",\n  messages: msgs\n});',
        explanation: 'The LLM API call is vulnerable to temporary network issues. Consider wrapping this request inside a retry loop with exponential backoff.',
        suggestion: 'Wrap the call inside the retryHelper module function.',
        severity: 'WARNING',
        commentType: 'BUG',
        status: 'APPROVED',
        feedbackText: 'Added a helper retry logic wrapper and it works perfectly, thanks!',
      },
      {
        reviewId: review.id,
        githubCommentId: 'c_002',
        repo: repo.fullName,
        prNumber: pr.prNumber,
        filePath: 'src/routes/rules.ts',
        line: 12,
        codeSnippet: 'app.post("/rules", async (req, res) => {\n  const rule = await prisma.teamRule.create(req.body);',
        explanation: 'Creating rules endpoint has no auth middlewares. Anyone can mutate team rules.',
        suggestion: 'Add checkAuthHeader middleware before handler.',
        severity: 'CRITICAL',
        commentType: 'SECURITY',
        status: 'PENDING',
      },
      {
        reviewId: review.id,
        githubCommentId: 'c_003',
        repo: repo.fullName,
        prNumber: pr.prNumber,
        filePath: 'client/src/index.css',
        line: 88,
        codeSnippet: '#root {\n  display: grid;\n  grid-template-columns: var(--sidebar-w) 1fr;\n}',
        explanation: 'Applying grid displays directly on #root restricts layout flow sizes if children have flex widths.',
        suggestion: 'Remove display: grid and let outer App wrappers manage flexible alignment widths.',
        severity: 'SUGGESTION',
        commentType: 'STYLE',
        status: 'APPROVED',
        feedbackText: 'Fixed! Replaced it with block spacing and the squished card view expanded to full width.',
      },
    ],
  });

  // 9. Add Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: user.id,
        organizationId: org.id,
        action: 'SUBSCRIPTION_PLAN_UPDATED',
        details: { oldPlan: 'FREE', newPlan: 'PRO' },
      },
      {
        userId: user.id,
        organizationId: org.id,
        action: 'REVIEW_COMPLETED',
        details: { prNumber: pr.prNumber, repo: repo.fullName, commentsAdded: 3 },
      },
    ],
  });

  console.log('Successfully seeded database with rich mock metrics and rules!');
}

seed()
  .catch((err) => {
    console.error('Error seeding data:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
