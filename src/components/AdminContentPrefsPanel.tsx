import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { fetchContentTraits, saveContentTraits, type ContentTrait } from '@/lib/userPrefs';

/** Admin → Pages moderation → Content preferences: the list of traits readers can pick in Accounts & Settings. */
export function AdminContentPrefsPanel() {
  const [traits, setTraits] = useState<ContentTrait[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => { let alive = true; void fetchContentTraits().then((t) => { if (alive) { setTraits(t); setLoading(false); } }); return () => { alive = false; }; }, []);

  const change = (next: ContentTrait[]) => { setTraits(next); setDirty(true); setMsg(null); };
  const add = () => {
    const label = draft.trim();
    if (!label) return;
    if (traits.some((t) => t.label.toLowerCase() === label.toLowerCase())) { setMsg({ ok: false, text: 'That trait is already in the list.' }); return; }
    change([...traits, { id: `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, label: label.slice(0, 80) }]);
    setDraft('');
  };
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= traits.length) return; const n = [...traits]; [n[i], n[j]] = [n[j], n[i]]; change(n); };
  const save = async () => {
    setSaving(true); setMsg(null);
    try { await saveContentTraits(traits); setDirty(false); setMsg({ ok: true, text: 'Saved. Readers see this list under Accounts & Settings → Content preferences.' }); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="surface-card p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Loading…</div>;
  return <section className="surface-card p-5 sm:p-6 mt-8 max-w-3xl space-y-4">
    <div><p className="text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Content preferences</p><h2 className="font-serif text-2xl font-semibold mt-1">Traits readers can choose from</h2><p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Add the content traits (themes, tones, topics) readers may mark as ones they are comfortable dealing with. Each reader&apos;s picks are private to them.</p></div>
    <div className="flex gap-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} maxLength={80} placeholder="e.g. Dark themes" className="input-field flex-1" aria-label="New trait" /><button type="button" onClick={add} className="btn-ghost !w-auto"><Plus className="w-4 h-4" /> Add</button></div>
    {traits.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No traits yet. Readers will see an empty tab until you add some.</p> :
      <ul className="space-y-2">{traits.map((t, i) => <li key={t.id} className="flex items-center gap-2 rounded-xl p-2" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
        <input value={t.label} maxLength={80} onChange={(e) => change(traits.map((x) => x.id === t.id ? { ...x, label: e.target.value } : x))} className="input-field flex-1 min-w-0" aria-label={`Trait ${i + 1}`} />
        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-2 rounded-lg disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
        <button type="button" onClick={() => move(i, 1)} disabled={i === traits.length - 1} className="p-2 rounded-lg disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
        <button type="button" onClick={() => change(traits.filter((x) => x.id !== t.id))} className="p-2 rounded-lg" style={{ color: '#dc2626' }} aria-label="Remove trait"><Trash2 className="w-4 h-4" /></button>
      </li>)}</ul>}
    {msg && <p className="text-sm" style={{ color: msg.ok ? 'var(--color-teal-dark)' : '#dc2626' }}>{msg.text}</p>}
    <button type="button" onClick={() => void save()} disabled={saving || !dirty} className="btn-primary !w-auto disabled:opacity-50"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save traits'}</button>
  </section>;
}
