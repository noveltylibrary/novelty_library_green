import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Lock, LockOpen, Save } from 'lucide-react';
import { DEFAULT_FREEZE, FREEZE_NOTE_MAX, FREEZE_REASONS, fetchSubmitFreeze, saveSubmitFreeze, type SubmitFreeze } from '@/lib/submitFreeze';
import { SubmitFrozenNotice } from '@/components/SubmitFrozenNotice';
import { getErrorMessage } from '@/lib/format';

/** Admin → Pages Moderation → Submit Freeze: lock the Submit form and tell readers why. */
export function AdminSubmitFreezePanel() {
  const [cfg, setCfg] = useState<SubmitFreeze>(DEFAULT_FREEZE);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [previewing, setPreviewing] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchSubmitFreeze(true).then((c) => { if (alive) setCfg(c); }).catch((e) => { if (alive) setMsg({ kind: 'err', text: getErrorMessage(e, 'Could not load the current setting.') }); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const edit = (patch: Partial<SubmitFreeze>) => { setCfg((c) => ({ ...c, ...patch })); setDirty(true); setMsg(null); };

  const save = async () => {
    if (cfg.frozen && !cfg.note.trim() && !cfg.reason.trim()) { setMsg({ kind: 'err', text: 'Add a reason or a note so readers know why the Submit page is frozen.' }); return; }
    setSaving(true); setMsg(null);
    try { setCfg(await saveSubmitFreeze(cfg)); setDirty(false); setMsg({ kind: 'ok', text: cfg.frozen ? 'Saved. The Submit page is now frozen for readers.' : 'Saved. The Submit page is open.' }); }
    catch (e) { setMsg({ kind: 'err', text: getErrorMessage(e, 'Could not save.') }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="surface-card p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Loading…</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">{cfg.frozen ? <Lock className="w-5 h-5" style={{ color: '#b45309' }} /> : <LockOpen className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} />}<h2 className="font-serif text-xl font-semibold">Submit page: {cfg.frozen ? 'frozen' : 'open'}</h2></div>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>When frozen, readers can still read every question on the Submit page but cannot fill in or send anything, and a popup shows your note. Admins can still use the form.</p>
          </div>
          <button type="button" className="btn-primary !w-auto" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
        {msg && <p className="mt-3 text-sm flex items-start gap-2" role="status" style={{ color: msg.kind === 'ok' ? 'var(--color-cyan-dark)' : '#b91c1c' }}>{msg.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}{msg.text}</p>}

        <label className="nl-freeze-switch mt-5">
          <input type="checkbox" checked={cfg.frozen} onChange={(e) => edit({ frozen: e.target.checked })} />
          <span><strong>Freeze the Submit page</strong><small>{cfg.frozen ? 'Readers see it read-only.' : 'Readers can submit as usual.'}</small></span>
        </label>

        <div className="mt-5 space-y-4">
          <div>
            <label className="label">Reason (shown as the popup title)</label>
            <input className="input-field" maxLength={80} value={cfg.reason} onChange={(e) => edit({ reason: e.target.value })} placeholder="e.g. Too many submissions right now" />
            <div className="flex flex-wrap gap-2 mt-2">
              {FREEZE_REASONS.map((r) => <button key={r} type="button" className="nl-genre-chips-btn" onClick={() => edit({ reason: r })}>{r}</button>)}
            </div>
          </div>
          <div>
            <label className="label">Note for readers</label>
            <textarea className="input-field min-h-[130px] resize-y" maxLength={FREEZE_NOTE_MAX} value={cfg.note} onChange={(e) => edit({ note: e.target.value })} placeholder="Explain what is happening and when readers can try again. For example: We have received more reviews than we can publish this month. Submissions reopen on 1 December." />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{cfg.note.length}/{FREEZE_NOTE_MAX}</p>
          </div>
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h3 className="font-serif text-lg font-semibold mb-1">What readers will see</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>A banner above the form, a popup with your note the first time they open the page, and a read-only form.</p>
        <SubmitFrozenNotice key={previewing} reason={cfg.reason} note={cfg.note} adminBypass={false} forceOpen={previewing} onClosed={() => undefined} />
        <button type="button" className="btn-ghost !w-auto text-sm" onClick={() => setPreviewing((n) => n + 1)}>Preview the popup</button>
      </section>
    </div>
  );
}
