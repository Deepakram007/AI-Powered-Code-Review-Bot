const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET feedback stats & accuracy rates
router.get('/stats', async (req, res) => {
  try {
    const totalCount = await db.reviewComment.count();
    const approvedCount = await db.reviewComment.count({ where: { status: 'APPROVED' } });
    const rejectedCount = await db.reviewComment.count({ where: { status: 'REJECTED' } });
    const pendingCount = await db.reviewComment.count({ where: { status: 'PENDING' } });

    // Compute accuracy rate
    const reviewedCount = approvedCount + rejectedCount;
    const accuracyRate = reviewedCount > 0 ? (approvedCount / reviewedCount) * 100 : 0;

    // Get distribution of status across repositories
    const repoGroup = await db.reviewComment.groupBy({
      by: ['repo'],
      _count: {
        id: true
      }
    });

    res.json({
      summary: {
        totalReviewsGenerated: totalCount,
        approved: approvedCount,
        rejected: rejectedCount,
        pending: pendingCount,
        accuracyRatePercentage: parseFloat(accuracyRate.toFixed(2))
      },
      repositories: repoGroup.map(g => ({
        repo: g.repo,
        reviewCount: g._count.id
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve stats', details: error.message });
  }
});

// GET list of review feedback items (with optional filters: status, repo)
router.get('/history', async (req, res) => {
  const { status, repo, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const whereClause = {};
  if (status) whereClause.status = status;
  if (repo) whereClause.repo = repo;

  try {
    const history = await db.reviewComment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit, 10)
    });

    const total = await db.reviewComment.count({ where: whereClause });

    res.json({
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      history
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve review history', details: error.message });
  }
});

module.exports = router;
