import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

// GET feedback stats & accuracy rates
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const totalCount = await prisma.reviewComment.count();
    const approvedCount = await prisma.reviewComment.count({ where: { status: 'APPROVED' } });
    const rejectedCount = await prisma.reviewComment.count({ where: { status: 'REJECTED' } });
    const pendingCount = await prisma.reviewComment.count({ where: { status: 'PENDING' } });

    // Compute accuracy rate
    const reviewedCount = approvedCount + rejectedCount;
    const accuracyRate = reviewedCount > 0 ? (approvedCount / reviewedCount) * 100 : 0;

    // Get distribution of status across repositories
    const repoGroup = await prisma.reviewComment.groupBy({
      by: ['repo'],
      _count: {
        id: true,
      },
    });

    res.json({
      summary: {
        totalReviewsGenerated: totalCount,
        approved: approvedCount,
        rejected: rejectedCount,
        pending: pendingCount,
        accuracyRatePercentage: parseFloat(accuracyRate.toFixed(2)),
      },
      repositories: repoGroup.map((g) => ({
        repo: g.repo,
        reviewCount: g._count.id,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve stats', details: error.message });
  }
});

// GET list of review feedback items (with optional filters: status, repo)
router.get('/history', async (req: Request, res: Response) => {
  const { status, repo, page = '1', limit = '20' } = req.query;
  const parsedPage = parseInt(String(page), 10);
  const parsedLimit = parseInt(String(limit), 10);
  const skip = (parsedPage - 1) * parsedLimit;

  const whereClause: any = {};
  if (status) whereClause.status = String(status);
  if (repo) whereClause.repo = String(repo);

  try {
    const history = await prisma.reviewComment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parsedLimit,
    });

    const total = await prisma.reviewComment.count({ where: whereClause });

    res.json({
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
      history,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve review history', details: error.message });
  }
});

export default router;
