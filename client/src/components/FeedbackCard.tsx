import type { ReviewComment } from '../api/client';
import { FileCode, GitPullRequest, Clock } from 'lucide-react';

interface Props { comment: ReviewComment; }

const SEV_LABELS: Record<string, string> = {
  CRITICAL: 'sev-CRITICAL', WARNING: 'sev-WARNING', SUGGESTION: 'sev-SUGGESTION',
};

const TYPE_ICONS: Record<string, string> = {
  BUG: '🐛', SECURITY: '🛡️', PERFORMANCE: '⚡', STYLE: '🎨',
  CODE_SMELL: '🔍', GENERAL: '💬',
};

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function FeedbackCard({ comment }: Props) {
  const typeIcon = TYPE_ICONS[comment.commentType] ?? '💬';
  const sevClass = SEV_LABELS[comment.severity] ?? 'sev-SUGGESTION';

  return (
    <div className="feedback-card">
      {/* Header */}
      <div className="feedback-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="feedback-file">
            <FileCode size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {comment.filePath}:{comment.line}
          </span>
          <span className={`severity-badge ${sevClass}`}>{comment.severity}</span>
          <span className="type-badge" style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            {typeIcon} {comment.commentType.replace('_', ' ')}
          </span>
        </div>
        <span className={`status-badge status-${comment.status}`}>
          {comment.status === 'APPROVED' ? '✓' : comment.status === 'REJECTED' ? '✕' : '⏳'} {comment.status}
        </span>
      </div>

      {/* Explanation */}
      <p className="feedback-explanation">{comment.explanation}</p>

      {/* Code snippet */}
      {comment.codeSnippet && (
        <pre className="code-block">{comment.codeSnippet.slice(0, 400)}{comment.codeSnippet.length > 400 ? '\n…' : ''}</pre>
      )}

      {/* Developer reply */}
      {comment.feedbackText && (
        <div className="feedback-reply">
          💬 <strong>Developer:</strong> "{comment.feedbackText}"
        </div>
      )}

      {/* Footer */}
      <div className="feedback-footer">
        <span className="feedback-repo">
          <GitPullRequest size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {comment.repo} #{comment.prNumber}
        </span>
        <span className="feedback-date">
          <Clock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {formatDate(comment.createdAt)}
        </span>
      </div>
    </div>
  );
}
