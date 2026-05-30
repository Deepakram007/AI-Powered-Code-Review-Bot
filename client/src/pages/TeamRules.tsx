import { useEffect, useState, useCallback } from 'react';
import { fetchRules, createRule, updateRule, deleteRule } from '../api/client';
import type { TeamRule } from '../api/client';
import RuleCard from '../components/RuleCard';
import RuleModal from '../components/RuleModal';
import { useToast } from '../components/ToastContext';
import { Plus } from 'lucide-react';

export default function TeamRules() {
  const [rules, setRules]       = useState<TeamRule[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModal]   = useState(false);
  const [editing, setEditing]   = useState<TeamRule | null>(null);
  const [orgFilter, setOrgFilter] = useState('');
  const { show } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRules(orgFilter || undefined);
      setRules(data);
    } catch (err: any) {
      show(err.message || 'Failed to load rules', 'error');
    } finally { setLoading(false); }
  }, [orgFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form: { ruleType: string; repoPattern: string; description: string; enabled: boolean }) => {
    try {
      if (editing) {
        const updated = await updateRule(editing.id, form);
        setRules(r => r.map(x => x.id === updated.id ? updated : x));
        show('Rule updated successfully', 'success');
      } else {
        const created = await createRule(form);
        setRules(r => [created, ...r]);
        show('Rule created successfully', 'success');
      }
      setModal(false); setEditing(null);
    } catch (err: any) { show(err.message || 'Failed to save rule', 'error'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      await deleteRule(id);
      setRules(r => r.filter(x => x.id !== id));
      show('Rule deleted', 'info');
    } catch (err: any) { show(err.message || 'Failed to delete rule', 'error'); }
  };

  const handleToggle = async (rule: TeamRule) => {
    try {
      const updated = await updateRule(rule.id, { enabled: !rule.enabled });
      setRules(r => r.map(x => x.id === updated.id ? updated : x));
      show(`Rule ${updated.enabled ? 'enabled' : 'disabled'}`, 'info');
    } catch (err: any) { show(err.message, 'error'); }
  };

  return (
    <div className="page-body">
      {/* Controls */}
      <div className="page-controls">
        <button
          className="btn btn-primary"
          onClick={() => { setEditing(null); setModal(true); }}
        >
          <Plus size={14} /> Add Rule
        </button>

        <div className="filter-group">
          <label className="filter-label">Filter by Org ID</label>
          <input
            className="filter-input"
            placeholder="Optional org UUID…"
            value={orgFilter}
            onChange={e => setOrgFilter(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
          />
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
          {rules.length} rule{rules.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Rules grid */}
      {loading && (
        <div className="rules-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {!loading && rules.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <span className="empty-icon">🛡️</span>
          No team rules configured yet.
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setModal(true)}>
            <Plus size={14} /> Add your first rule
          </button>
        </div>
      )}

      {!loading && rules.length > 0 && (
        <div className="rules-grid">
          {rules.map(r => (
            <RuleCard
              key={r.id}
              rule={r}
              onEdit={rule => { setEditing(rule); setModal(true); }}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <RuleModal
        open={modalOpen}
        editing={editing}
        onClose={() => { setModal(false); setEditing(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
