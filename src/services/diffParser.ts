export interface DiffHunk {
  startLine: number;
  endLine: number;
  content: string;
}

/**
 * Parses a Git diff patch to map line numbers in the new file.
 * Returns an array of line numbers that were added or modified in the PR.
 */
export function parsePatch(patch: string | null | undefined): number[] {
  if (!patch) return [];

  const addedLines: number[] = [];
  const lines = patch.split('\n');
  let currentNewLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse header e.g. @@ -10,6 +10,7 @@
      const match = line.match(/@@\s+-\d+,?\d*\s+\+(\d+),?\d*\s+@@/);
      if (match) {
        currentNewLine = parseInt(match[1], 10);
      }
    } else if (line.startsWith('+')) {
      addedLines.push(currentNewLine);
      currentNewLine++;
    } else if (line.startsWith('-')) {
      // Line was deleted, it is not present in the new file
    } else {
      // Unchanged line
      currentNewLine++;
    }
  }

  return addedLines;
}

/**
 * Groups diff lines into hunks with line numbers for better AI context.
 */
export function getDiffHunks(patch: string | null | undefined): DiffHunk[] {
  if (!patch) return [];

  const hunks: DiffHunk[] = [];
  const lines = patch.split('\n');
  let currentNewLine = 0;
  let currentHunk: DiffHunk | null = null;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      const match = line.match(/@@\s+-\d+,?\d*\s+\+(\d+),?\d*\s+@@/);
      if (match) {
        currentNewLine = parseInt(match[1], 10);
        currentHunk = {
          startLine: currentNewLine,
          endLine: currentNewLine,
          content: line + '\n',
        };
      }
    } else {
      if (currentHunk) {
        currentHunk.content += line + '\n';
        if (line.startsWith('+')) {
          currentHunk.endLine = currentNewLine;
          currentNewLine++;
        } else if (line.startsWith('-')) {
          // No increment, not in new file
        } else {
          currentHunk.endLine = currentNewLine;
          currentNewLine++;
        }
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}
