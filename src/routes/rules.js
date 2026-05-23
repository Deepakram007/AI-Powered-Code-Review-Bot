const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET all rules
router.get('/', async (req, res) => {
  try {
    const rules = await db.rule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve rules', details: error.message });
  }
});

// POST create a new rule
router.post('/', async (req, res) => {
  const { repoPattern, ruleType, description, enabled } = req.body;

  if (!repoPattern || !ruleType || !description) {
    return res.status(400).json({ error: 'repoPattern, ruleType, and description are required.' });
  }

  const validTypes = ['BUG', 'PERFORMANCE', 'SECURITY', 'STYLE', 'GENERAL'];
  if (!validTypes.includes(ruleType)) {
    return res.status(400).json({ error: `ruleType must be one of: ${validTypes.join(', ')}` });
  }

  try {
    const rule = await db.rule.create({
      data: {
        repoPattern,
        ruleType,
        description,
        enabled: enabled !== undefined ? enabled : true
      }
    });
    res.status(201).json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create rule', details: error.message });
  }
});

// PUT update an existing rule
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { repoPattern, ruleType, description, enabled } = req.body;

  try {
    // Check existence first
    const existing = await db.rule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const rule = await db.rule.update({
      where: { id },
      data: {
        repoPattern: repoPattern !== undefined ? repoPattern : existing.repoPattern,
        ruleType: ruleType !== undefined ? ruleType : existing.ruleType,
        description: description !== undefined ? description : existing.description,
        enabled: enabled !== undefined ? enabled : existing.enabled
      }
    });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update rule', details: error.message });
  }
});

// DELETE a rule
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await db.rule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    await db.rule.delete({ where: { id } });
    res.json({ message: 'Rule successfully deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete rule', details: error.message });
  }
});

module.exports = router;
