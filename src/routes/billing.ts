import { Router, Request, Response } from 'express';
import prisma from '../config/db';
import { PLAN_LIMITS } from '../services/usageService';

const router = Router();

// GET organization usage limits and stats
router.get('/usage/:orgId', async (req: Request, res: Response) => {
  const { orgId } = req.params;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const usage = await prisma.usageTracking.findUnique({
      where: {
        organizationId_currentMonth: {
          organizationId: orgId,
          currentMonth,
        },
      },
    });

    const currentCount = usage ? usage.prReviewedCount : 0;
    const tokensUsed = usage ? usage.tokensUsed : 0;
    const limit = PLAN_LIMITS[org.billingPlan] || PLAN_LIMITS.FREE;

    return res.json({
      organization: {
        id: org.id,
        name: org.name,
        billingPlan: org.billingPlan,
      },
      currentMonth,
      usage: {
        prReviewedCount: currentCount,
        prReviewedLimit: limit,
        prReviewsRemaining: Math.max(0, limit - currentCount),
        tokensUsed,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve usage details', details: error.message });
  }
});

// POST update organization subscription plan tier
router.post('/tier/:orgId', async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { plan } = req.body;

  if (!plan) {
    return res.status(400).json({ error: 'Plan name is required.' });
  }

  const validPlans = ['FREE', 'PRO', 'ENTERPRISE'];
  if (!validPlans.includes(plan.toUpperCase())) {
    return res.status(400).json({ error: `Plan must be one of: ${validPlans.join(', ')}` });
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        billingPlan: plan.toUpperCase(),
      },
    });

    // Create an audit log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'SUBSCRIPTION_PLAN_UPDATED',
        details: { oldPlan: org.billingPlan, newPlan: plan.toUpperCase() },
      },
    });

    return res.json({
      message: `Organization subscription plan successfully updated to ${plan.toUpperCase()}`,
      organization: {
        id: updated.id,
        name: updated.name,
        billingPlan: updated.billingPlan,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update plan', details: error.message });
  }
});

export default router;
