import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

// GET all rules
router.get('/', async (req: Request, res: Response) => {
  const { organizationId } = req.query;

  try {
    const whereClause = organizationId ? { organizationId: String(organizationId) } : {};
    const rules = await prisma.teamRule.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve rules', details: error.message });
  }
});

// POST create a new rule
router.post('/', async (req: Request, res: Response) => {
  const { repoPattern, ruleType, description, enabled, organizationId } = req.body;

  if (!repoPattern || !ruleType || !description) {
    return res.status(400).json({ error: 'repoPattern, ruleType, and description are required.' });
  }

  const validTypes = ['BUG', 'PERFORMANCE', 'SECURITY', 'STYLE', 'GENERAL'];
  if (!validTypes.includes(ruleType)) {
    return res.status(400).json({ error: `ruleType must be one of: ${validTypes.join(', ')}` });
  }

  try {
    let finalOrgId = organizationId;

    // If no org specified, resolve or default to first organization in the system
    if (!finalOrgId) {
      let defaultOrg = await prisma.organization.findFirst();
      if (!defaultOrg) {
        defaultOrg = await prisma.organization.create({
          data: {
            name: 'Default Organization',
            githubOrgId: 'default-org-id',
          },
        });
      }
      finalOrgId = defaultOrg.id;
    }

    const rule = await prisma.teamRule.create({
      data: {
        repoPattern,
        ruleType,
        description,
        organizationId: finalOrgId,
        enabled: enabled !== undefined ? enabled : true,
      },
    });

    return res.status(201).json(rule);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create rule', details: error.message });
  }
});

// PUT update an existing rule
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { repoPattern, ruleType, description, enabled } = req.body;

  try {
    const existing = await prisma.teamRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const rule = await prisma.teamRule.update({
      where: { id },
      data: {
        repoPattern: repoPattern !== undefined ? repoPattern : existing.repoPattern,
        ruleType: ruleType !== undefined ? ruleType : existing.ruleType,
        description: description !== undefined ? description : existing.description,
        enabled: enabled !== undefined ? enabled : existing.enabled,
      },
    });
    return res.json(rule);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update rule', details: error.message });
  }
});

// DELETE a rule
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const existing = await prisma.teamRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    await prisma.teamRule.delete({ where: { id } });
    return res.json({ message: 'Rule successfully deleted' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete rule', details: error.message });
  }
});

export default router;
