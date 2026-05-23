const db = require('../config/db');
const ai = require('../config/ai');
const { parsePatch } = require('./diffParser');

/**
 * Orchestrates AI reviews for a list of modified files in a PR.
 * 
 * @param {string} repo Repository owner/name (e.g. "owner/repo")
 * @param {Array<Object>} files Files list from GitHub pulls listFiles
 * @returns {Promise<{ comments: Array<Object>, stats: Object }>}
 */
async function reviewPullRequest(repo, files) {
  // 1. Fetch rules matching this repository or global rules
  const allRules = await db.rule.findMany({
    where: { enabled: true }
  });

  const matchedRules = allRules.filter(rule => {
    if (rule.repoPattern === '*') return true;
    // Simple pattern matching, e.g. "owner/*" or exact "owner/repo"
    const regex = new RegExp('^' + rule.repoPattern.replace(/\*/g, '.*') + '$');
    return regex.test(repo);
  });

  // 2. Fetch past feedback to learn from team preferences
  const feedbackHistory = await db.reviewComment.findMany({
    where: {
      repo,
      status: { in: ['APPROVED', 'REJECTED'] }
    },
    orderBy: {
      updatedAt: 'desc'
    },
    take: 10
  });

  const approvedExamples = feedbackHistory
    .filter(f => f.status === 'APPROVED')
    .map(f => `- Path: ${f.filePath}\n  Code: ${f.codeSnippet}\n  Approved Suggestion: ${f.suggestion}`);

  const rejectedExamples = feedbackHistory
    .filter(f => f.status === 'REJECTED')
    .map(f => `- Path: ${f.filePath}\n  Avoid doing this (Developer Rejected): ${f.explanation}\n  Suggested Code was: ${f.suggestion}`);

  // 3. Prepare Prompt context
  const rulesContext = matchedRules.length > 0 
    ? matchedRules.map(r => `- [${r.ruleType}] ${r.description}`).join('\n')
    : 'No custom guidelines configured.';

  const feedbackContext = `
APPROVED SUGGESTIONS (Follow these patterns):
${approvedExamples.length > 0 ? approvedExamples.join('\n') : 'None yet.'}

REJECTED SUGGESTIONS (DO NOT repeat these mistakes/false positives):
${rejectedExamples.length > 0 ? rejectedExamples.join('\n') : 'None yet.'}
`;

  const reviewComments = [];
  const stats = { bug: 0, security: 0, performance: 0, style: 0 };

  // 4. Iterate and review files
  for (const file of files) {
    const { filename, patch, status } = file;
    if (status === 'removed' || !patch) continue;

    // Parse which lines are added/modified
    const addedLines = parsePatch(patch);
    if (addedLines.length === 0) continue;

    const systemPrompt = `You are Antigravity, a premium AI code reviewer and senior software engineer.
Analyze the provided code changes (diff patch) for the file '${filename}'.

Your job is to identify:
1. Critical Bugs (logic errors, null pointers, undefined references).
2. Security Vulnerabilities (injection vectors, hardcoded secrets, unsafe library usages).
3. Performance Improvements (wasteful loops, duplicate database calls, memory leaks).
4. Custom Rule Violations (enforce style and guidelines listed in rules context).

---
RULES CONTEXT:
${rulesContext}

LEARNED TEAM PREFERENCES:
${feedbackContext}
---

CRITICAL INSTRUCTIONS:
- You MUST only comment on line numbers that are in the "Valid Line Numbers" list. Comments on lines outside this list will fail to post.
- Avoid pedantic comments. Do not complain about spacing, formatting, or missing comments unless explicitly instructed in the rules.
- For each issue, provide a clear explanation of why it is an issue, and a drop-in replacement suggestion inside a markdown code block.
- Return output in JSON format matching the schema below. If there are no issues, return an empty array of reviews.

RESPONSE FORMAT:
{
  "reviews": [
    {
      "line": 42,
      "commentType": "BUG" | "SECURITY" | "PERFORMANCE" | "STYLE",
      "explanation": "Why this code is problematic...",
      "suggestion": "Suggest replacement code or null/empty if no code change is needed..."
    }
  ]
}
`;

    const userPrompt = `
File: ${filename}
Valid Line Numbers for review (only comment on these lines): [${addedLines.join(', ')}]

Diff Patch:
\`\`\`diff
${patch}
\`\`\`
`;

    try {
      const responseText = await ai.createChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { type: "json_object" });

      const result = JSON.parse(responseText);

      if (result && Array.isArray(result.reviews)) {
        for (const review of result.reviews) {
          // Double check line is in valid added lines
          if (!addedLines.includes(review.line)) {
            console.log(`AI suggested comment on line ${review.line} in ${filename} which is not a modified line. Dropping.`);
            continue;
          }

          // Format review body
          const categoryEmoji = {
            BUG: '🐛 *Bug*',
            SECURITY: '🛡️ *Security*',
            PERFORMANCE: '⚡ *Performance*',
            STYLE: '🎨 *Style*'
          };

          const emojiHeader = categoryEmoji[review.commentType] || '🔍 *Review*';
          let body = `${emojiHeader}\n\n${review.explanation}`;
          if (review.suggestion && review.suggestion !== 'null') {
            // Format suggestion nicely
            body += `\n\n\`\`\`suggestion\n${review.suggestion}\n\`\`\``;
          }

          reviewComments.push({
            path: filename,
            line: review.line,
            side: 'RIGHT',
            body,
            // Metadata fields for database insertion
            meta: {
              filePath: filename,
              line: review.line,
              commentType: review.commentType,
              explanation: review.explanation,
              suggestion: review.suggestion || ''
            }
          });

          // Update local stats
          const category = review.commentType.toLowerCase();
          if (stats[category] !== undefined) {
            stats[category]++;
          }
        }
      }
    } catch (error) {
      console.error(`Error reviewing file ${filename}:`, error.message);
    }
  }

  return {
    comments: reviewComments,
    stats
  };
}

module.exports = {
  reviewPullRequest
};
