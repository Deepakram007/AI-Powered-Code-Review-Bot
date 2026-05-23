import prisma from '../config/db';
import { createChatCompletion } from '../config/ai';
import { parsePatch } from './diffParser';

const IGNORED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.pdf', '.zip', '.tar', '.gz', '.mp3', '.mp4', '.woff', '.woff2', '.ttf'
];

const IGNORED_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'go.sum',
  'cargo.lock',
  '.env.example'
];

export interface AiReviewIssue {
  type: 'bug' | 'security' | 'performance' | 'style' | 'code smell';
  file: string;
  line: number;
  title: string;
  explanation: string;
  impact: string;
  suggested_fix: string;
  severity: 'critical' | 'warning' | 'suggestion';
}

export interface AiReviewResponse {
  summary: string;
  severity: 'critical' | 'warning' | 'suggestion';
  issues: AiReviewIssue[];
}

export interface FormattedReviewComment {
  path: string;
  line: number;
  side: 'RIGHT';
  body: string;
  meta: {
    filePath: string;
    line: number;
    commentType: string;
    severity: string;
    explanation: string;
    suggestion: string;
  };
}

/**
 * Calculates estimated model usage cost in USD.
 */
function calculateCost(promptTokens: number, completionTokens: number): number {
  // Pricing for gpt-4o-mini: Input: $0.15 / 1M tokens, Output: $0.60 / 1M tokens
  const inputCost = (promptTokens / 1_000_000) * 0.15;
  const outputCost = (completionTokens / 1_000_000) * 0.60;
  return Number((inputCost + outputCost).toFixed(6));
}

/**
 * Orchestrates AI reviews for a list of modified files in a PR.
 */
export async function reviewPullRequest(
  organizationId: string,
  repoFullName: string,
  files: any[]
): Promise<{
  comments: FormattedReviewComment[];
  stats: { bug: number; security: number; performance: number; style: number };
  cost: number;
  promptTokens: number;
  completionTokens: number;
}> {
  // 1. Fetch active team guidelines for the organization
  const allRules = await prisma.teamRule.findMany({
    where: { organizationId, enabled: true },
  });

  const matchedRules = allRules.filter((rule) => {
    if (rule.repoPattern === '*') return true;
    const regex = new RegExp('^' + rule.repoPattern.replace(/\*/g, '.*') + '$');
    return regex.test(repoFullName);
  });

  // 2. Fetch feedback loop examples for few-shot learning
  const feedbackHistory = await prisma.reviewComment.findMany({
    where: {
      repo: repoFullName,
      status: { in: ['APPROVED', 'REJECTED'] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  const approvedExamples = feedbackHistory
    .filter((f) => f.status === 'APPROVED')
    .map((f) => `- File: ${f.filePath}, Line: ${f.line}\n  Original explanation: ${f.explanation}\n  Approved Code: ${f.suggestion}`);

  const rejectedExamples = feedbackHistory
    .filter((f) => f.status === 'REJECTED')
    .map((f) => `- File: ${f.filePath}, Line: ${f.line}\n  Rejected comment explanation: ${f.explanation}\n  Suggested Code was: ${f.suggestion}`);

  // 3. Setup context strings
  const rulesContext = matchedRules.length > 0
    ? matchedRules.map((r) => `- [${r.ruleType}] ${r.description}`).join('\n')
    : 'No custom rules configured.';

  const feedbackContext = `
APPROVED REVIEWS (Emulate these preferences):
${approvedExamples.length > 0 ? approvedExamples.join('\n') : 'None.'}

REJECTED REVIEWS (Avoid repeating these false-positives/unwanted comments):
${rejectedExamples.length > 0 ? rejectedExamples.join('\n') : 'None.'}
`;

  // 4. Filter and process files
  const fileDiffsToReview: { filename: string; patch: string; addedLines: number[] }[] = [];
  const validLineMaps: Record<string, number[]> = {};

  for (const file of files) {
    const { filename, patch, status } = file;

    // Rule-based filters (AI Cost Optimization)
    if (status === 'removed' || !patch) continue;

    const lowerName = filename.toLowerCase();
    const hasIgnoredExt = IGNORED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    const isIgnoredFile = IGNORED_FILES.some((f) => lowerName.includes(f));

    if (hasIgnoredExt || isIgnoredFile) {
      console.log(`[aiService] Skipping ignored file: ${filename}`);
      continue;
    }

    const addedLines = parsePatch(patch);
    if (addedLines.length === 0) continue;

    fileDiffsToReview.push({ filename, patch, addedLines });
    validLineMaps[filename] = addedLines;
  }

  const reviewComments: FormattedReviewComment[] = [];
  const stats = { bug: 0, security: 0, performance: 0, style: 0 };
  let totalCost = 0.0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  if (fileDiffsToReview.length === 0) {
    return { comments: [], stats, cost: 0.0, promptTokens: 0, completionTokens: 0 };
  }

  // 5. Batch reviews. If total diff payload fits within context limits, analyze in one go.
  // Group diffs until total character limit (e.g. 25k chars) is reached.
  let currentBatch: typeof fileDiffsToReview = [];
  let currentBatchLength = 0;
  const batches: (typeof fileDiffsToReview)[] = [];

  for (const fd of fileDiffsToReview) {
    if (currentBatchLength + fd.patch.length > 25000 && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchLength = 0;
    }
    currentBatch.push(fd);
    currentBatchLength += fd.patch.length;
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  // 6. Process each batch
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.log(`[aiService] Running review batch ${b + 1}/${batches.length} with ${batch.length} files.`);

    const systemPrompt = `You are Antigravity, a premium AI code reviewer, senior staff engineer, and product architect.
Your objective is to review code changes and identify bugs, security vulnerabilities, performance bottlenecks, code smells, or style violations.

Custom Team Guidelines:
${rulesContext}

Learned Preferences (Few-Shot Feedback):
${feedbackContext}

CRITICAL RULES:
1. ONLY comment on lines that are in the "Valid Line Numbers" array. Comments on other lines are physically impossible to post on GitHub and will fail.
2. Avoid generic, nitpicky, or styling complaints unless they explicitly violate Custom Team Guidelines.
3. Output MUST be formatted as a single JSON object matching the schema below.

JSON SCHEMA:
{
  "summary": "High-level summary of changes and review findings",
  "severity": "critical" | "warning" | "suggestion",
  "issues": [
    {
      "type": "bug" | "security" | "performance" | "style" | "code smell",
      "file": "path/to/file.js",
      "line": 42,
      "title": "Short descriptive title of the issue",
      "explanation": "Detailed explanation of the issue, why it is problematic, and how to fix it.",
      "impact": "Detailed impact of this code behavior on system behavior, performance, or security.",
      "suggested_fix": "The exact replacement code. Keep it focused. Do not wrap with additional markdown formatting. If no code replacement is suggested, return empty string."
    }
  ]
}
`;

    const userPrompt = batch
      .map((fd) => {
        return `### File: ${fd.filename}
Valid Line Numbers for review: [${fd.addedLines.join(', ')}]

Diff Patch:
\`\`\`diff
${fd.patch}
\`\`\`
`;
      })
      .join('\n\n');

    try {
      const responseText = await createChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { type: 'json_object' }
      );

      if (!responseText) continue;

      const result = JSON.parse(responseText) as AiReviewResponse;

      if (result && Array.isArray(result.issues)) {
        for (const issue of result.issues) {
          const validLines = validLineMaps[issue.file];

          // 7. Verify line exists in addedLines to avoid post failures
          if (!validLines || !validLines.includes(issue.line)) {
            console.log(`[aiService] Dropping comment on invalid line ${issue.line} for file ${issue.file}`);
            continue;
          }

          // Category mapping & stats
          const category = issue.type === 'code smell' ? 'style' : issue.type;
          if (stats[category] !== undefined) {
            stats[category]++;
          }

          const emojiMap: Record<string, string> = {
            bug: '🐛 *Bug*',
            security: '🛡️ *Security*',
            performance: '⚡ *Performance*',
            style: '🎨 *Style*',
            'code smell': '🔍 *Code Smell*',
          };

          const categoryHeader = emojiMap[issue.type] || '🔍 *Review Suggestion*';
          const severityBadge = `\`[Severity: ${issue.severity.toUpperCase()}]\``;

          // Format github comment markdown
          let body = `${categoryHeader} ${severityBadge} **${issue.title}**\n\n${issue.explanation}\n\n**Impact:** *${issue.impact}*`;
          if (issue.suggested_fix) {
            body += `\n\n\`\`\`suggestion\n${issue.suggested_fix}\n\`\`\``;
          }

          reviewComments.push({
            path: issue.file,
            line: issue.line,
            side: 'RIGHT',
            body,
            meta: {
              filePath: issue.file,
              line: issue.line,
              commentType: issue.type.toUpperCase().replace(' ', '_'),
              severity: issue.severity.toUpperCase(),
              explanation: issue.explanation,
              suggestion: issue.suggested_fix || '',
            },
          });
        }
      }

      // Track token counts to estimate cost
      // Estimate token count: 1 token ~= 4 characters in English
      const promptChars = systemPrompt.length + userPrompt.length;
      const completionChars = responseText.length;
      const batchPromptTokens = Math.ceil(promptChars / 4);
      const batchCompletionTokens = Math.ceil(completionChars / 4);

      totalPromptTokens += batchPromptTokens;
      totalCompletionTokens += batchCompletionTokens;
      totalCost += calculateCost(batchPromptTokens, batchCompletionTokens);

    } catch (error: any) {
      console.error(`[aiService] Error processing review batch:`, error.message);
    }
  }

  return {
    comments: reviewComments,
    stats,
    cost: Number(totalCost.toFixed(5)),
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
  };
}
