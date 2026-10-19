import { useEffect, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { RoadmapTable } from '@/components/RoadmapTable';
import {
  DEFAULT_ROADMAP, MAX_ROADMAP_ROWS, STATUS_LABELS, blankRow, fetchRoadmap, saveRoadmap,
  type RoadmapConfig, type RoadmapRow, type RoadmapStatus,
} from '@/lib/roadmap';
import { getErrorMessage } from '@/lib/format';

const inputCls = 'w-full rounded-lg px-3 py-2 text-sm outline-none';
const inputStyle = { background: 'var(--color-paper)', border: '1px solid var(--color-border)', color: 'var(--color-text)' } as const;

/** Admin → Roadmap: edit the "what's live, what's next" table shown on About. */
export function AdminRoadmapPanel() {
  const [cfg, setCfg] = useState<RoadmapConfig>(DEFAULT_ROADMAP);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchRoadmap().then((c) => { if (alive) setCfg(c); })
      .catch((e) => { if (alive) setMsg({ kind: 'err', text: getErrorMessage(e, 'Could not load the saved roadmap.') }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const edit = (next: RoadmapConfig) => { setCfg(next); setDirty(true); setMsg(null); };
  const setRow = (id: string, patch: Partial<RoadmapRow>) => edit({ ...cfg, rows: cfg.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= cfg.rows.length) return;
    const rows = [...cfg.rows]; [rows[i], rows[j]] = [rows[j], rows[i]];
    edit({ ...cfg, rows });
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const clean = await saveRoadmap(cfg);
      setCfg(clean); setDirty(false);
      setMsg({ kind: 'ok', text: 'Saved. The About page now shows this table.' });
    } catch (e) {
      setMsg({ kind: 'err', text: getErrorMessage(e, 'Could not save the roadmap.') });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}><Loader2 className="w-4 h-4 animate-spin" /> Loading roadmap…</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          This is the "what's live, what's next" table on the About page. Up to {MAX_ROADMAP_ROWS} rows. Rows with an empty feature name are dropped when saving.
        </p>

        <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => edit({ ...cfg, enabled: e.target.checked })} />
          Show the roadmap on the About page
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>Heading
            <input className={`${inputCls} mt-1`} style={inputStyle} maxLength={80} value={cfg.heading} onChange={(e) => edit({ ...cfg, heading: e.target.value })} />
          </label>
          <label className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>Intro line
            <input className={`${inputCls} mt-1`} style={inputStyle} maxLength={240} value={cfg.intro} onChange={(e) => edit({ ...cfg, intro: e.target.value })} />
          </label>
        </div>

        <div className="space-y-3">
          {cfg.rows.map((row, i) => (
            <div key={row.id} className="rounded-xl p-3 grid gap-2 sm:grid-cols-[1.2fr_8rem_2fr_auto] items-start" style={{ border: '1px solid var(--color-border)' }}>
              <input aria-label="Feature" placeholder="Feature" className={inputCls} style={inputStyle} maxLength={90} value={row.feature} onChange={(e) => setRow(row.id, { feature: e.target.value })} />
              <select aria-label="Status" className={inputCls} style={inputStyle} value={row.status} onChange={(e) => setRow(row.id, { status: e.target.value as RoadmapStatus })}>
                {(Object.keys(STATUS_LABELS) as RoadmapStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
              </select>
              <input aria-label="What it means" placeholder="What it means for readers" className={inputCls} style={inputStyle} maxLength={220} value={row.note} onChange={(e) => setRow(row.id, { note: e.target.value })} />
              <div className="flex gap-1">
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="p-2 rounded-lg disabled:opacity-30" style={inputStyle}><ArrowUp className="w-4 h-4" /></button>
                <button type="button" aria-label="Move down" disabled={i === cfg.rows.length - 1} onClick={() => move(i, 1)} className="p-2 rounded-lg disabled:opacity-30" style={inputStyle}><ArrowDown className="w-4 h-4" /></button>
                <button type="button" aria-label="Remove row" onClick={() => edit({ ...cfg, rows: cfg.rows.filter((r) => r.id !== row.id) })} className="p-2 rounded-lg" style={{ ...inputStyle, color: '#dc2626' }}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={cfg.rows.length >= MAX_ROADMAP_ROWS} onClick={() => edit({ ...cfg, rows: [...cfg.rows, blankRow()] })} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-40" style={inputStyle}>
            <Plus className="w-4 h-4" /> Add row
          </button>
          <button type="button" onClick={() => edit({ ...DEFAULT_ROADMAP, rows: DEFAULT_ROADMAP.rows.map((r) => ({ ...r })) })} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold" style={inputStyle}>
            <RotateCcw className="w-4 h-4" /> Reset to defaults
          </button>
          <button type="button" disabled={!dirty || saving} onClick={save} className="ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#013a46,#0097b2)' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save roadmap
          </button>
        </div>

        {msg && (
          <p role="status" className="flex items-center gap-2 text-sm font-semibold" style={{ color: msg.kind === 'ok' ? '#059669' : '#dc2626' }}>
            {msg.kind === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {msg.text}
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Preview</p>
        <RoadmapTable config={cfg} />
      </div>
    </div>
  );
}
