import prisma from '../config/db';

export const PLAN_LIMITS: Record<string, number> = {
  FREE: 5,         // Max 5 PR reviews per month
  PRO: 100,        // Max 100 PR reviews per month
  ENTERPRISE: 10000, // Enterprise high-limit
};

/**
 * Verifies if an organization has monthly pull request review capacity remaining.
 * If capacity exists, increments the reviewed pull request count and returns true.
 */
export async function checkAndIncrementUsage(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!org) {
    throw new Error(`Organization with ID ${organizationId} not found.`);
  }

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Fetch current month tracking details
  const tracking = await prisma.usageTracking.findUnique({
    where: {
      organizationId_currentMonth: {
        organizationId,
        currentMonth,
      },
    },
  });

  const currentCount = tracking ? tracking.prReviewedCount : 0;
  const limit = PLAN_LIMITS[org.billingPlan] || PLAN_LIMITS.FREE;

  if (currentCount >= limit) {
    console.warn(`[usageService] Usage limit exceeded for Org ID: ${organizationId}. Plan: ${org.billingPlan}, Count: ${currentCount}/${limit}`);
    return false;
  }

  // Increment usage
  await prisma.usageTracking.upsert({
    where: {
      organizationId_currentMonth: {
        organizationId,
        currentMonth,
      },
    },
    update: {
      prReviewedCount: { increment: 1 },
    },
    create: {
      organizationId,
      currentMonth,
      prReviewedCount: 1,
      tokensUsed: 0,
    },
  });

  return true;
}
