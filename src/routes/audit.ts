import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

// GET compliance audit log list for organization
router.get('/:orgId', async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { page = '1', limit = '20', action } = req.query;

  const parsedPage = parseInt(String(page), 10);
  const parsedLimit = parseInt(String(limit), 10);
  const skip = (parsedPage - 1) * parsedLimit;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const whereClause: any = { organizationId: orgId };
    if (action) {
      whereClause.action = String(action);
    }

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parsedLimit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    const total = await prisma.auditLog.count({ where: whereClause });

    return res.json({
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
      logs,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve compliance audit logs', details: error.message });
  }
});

export default router;
