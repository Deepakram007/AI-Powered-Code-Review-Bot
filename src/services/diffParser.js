/**
 * Parses a Git diff patch to map line numbers in the new file.
 * Returns an array of line numbers that were added or modified in the PR.
 * 
 * @param {string} patch The patch string from GitHub file object
 * @returns {Array<number>} Array of 1-indexed line numbers in the new file that were added or modified.
 */
function parsePatch(patch) {
  if (!patch) return [];

  const addedLines = [];
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
 * 
 * @param {string} patch The patch string from GitHub file object
 * @returns {Array<{ startLine: number, endLine: number, content: string }>}
 */
function getDiffHunks(patch) {
  if (!patch) return [];

  const hunks = [];
  const lines = patch.split('\n');
  let currentNewLine = 0;
  let currentHunk = null;

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
          content: line + '\n'
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

module.exports = {
  parsePatch,
  getDiffHunks
};
