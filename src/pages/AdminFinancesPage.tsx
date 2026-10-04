import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Plus, Save, Trash2, WalletCards, Building2, ShoppingBag, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchAllFinanceModules, saveFinanceModule, deleteFinanceModule, type FinanceCategory, type FinanceModule } from '@/lib/adminConfig';

export function AdminFinancesPage({ navigate }: { navigate: (path: string) => void }) {
  const { user, isAdmin, loading } = useAuth();
  const [modules, setModules] = useState<FinanceModule[]>([]);
  const [selected, setSelected] = useState<FinanceModule | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [dashboard, setDashboard] = useState<FinanceModule | null>(null);

  const load = () => fetchAllFinanceModules().then(setModules).catch(() => setModules([]));
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const b2b = useMemo(() => modules.filter((m) => m.category === 'b2b'), [modules]);
  const b2c = useMemo(() => modules.filter((m) => m.category === 'b2c'), [modules]);

  if (loading) return <div className="pt-32 container-prose text-center">Loading…</div>;
  if (!user || !isAdmin) return <div className="pt-32 container-prose text-center"><p className="mb-5">Admin access required.</p><button className="btn-ghost" onClick={() => navigate('/admin')}><ArrowLeft className="w-4 h-4" /> Admin</button></div>;

  const edit = (module?: FinanceModule, category: FinanceCategory = 'b2b') => setSelected(module ?? {
    id: '', category, name: '', description: '', dashboard_url: '', active: true, sort_order: modules.length + 1,
  });

  const save = async () => {
    if (!selected?.name.trim() || !selected.dashboard_url.trim()) return setMessage('Name and dashboard link are required.');
    try {
      setSaving(true); setMessage('');
      await saveFinanceModule(selected);
      await load();
      setSelected(null);
      setMessage('Module saved.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save module.'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this dashboard button?')) return;
    await deleteFinanceModule(id);
    await load();
  };

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1.5 text-sm mb-7" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft className="w-4 h-4" /> Admin Dashboard</button>
        <header className="mb-9">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}><WalletCards className="w-4 h-4" /> Admin module</div>
          <h1 className="font-serif text-4xl font-semibold mt-2" style={{ color: 'var(--color-text)' }}>Finances and Payments Module</h1>
          <p className="text-sm mt-2 max-w-3xl" style={{ color: 'var(--color-text-muted)' }}>Manage external finance, advertising, and future payment dashboards. Each saved link becomes a button inside the Novelty Library UI.</p>
        </header>

        {dashboard && <section className="mb-6 rounded-3xl overflow-hidden" style={{ border: '1px solid var(--color-border)', background: 'var(--color-paper)' }}>
          <div className="flex items-center justify-between gap-3 p-4"><div><p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--color-teal-dark)' }}>{dashboard.category.toUpperCase()}</p><h2 className="font-serif text-xl font-semibold">{dashboard.name} dashboard</h2></div><div className="flex gap-2"><a href={dashboard.dashboard_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs"><ExternalLink className="w-3.5 h-3.5" /> External</a><button className="btn-ghost text-xs" onClick={() => setDashboard(null)}><X className="w-3.5 h-3.5" /> Close</button></div></div>
          <div className="h-[65vh] min-h-[420px] bg-black/5"><iframe title={`${dashboard.name} dashboard`} src={dashboard.dashboard_url} className="w-full h-full border-0" /></div>
        </section>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FinanceColumn title="B2B" icon={Building2} items={b2b} onAdd={() => edit(undefined, 'b2b')} onEdit={edit} onDelete={remove} onOpen={setDashboard} />
          <FinanceColumn title="B2C" icon={ShoppingBag} items={b2c} onAdd={() => edit(undefined, 'b2c')} onEdit={edit} onDelete={remove} onOpen={setDashboard} />
        </div>

        {message && <p className="mt-5 text-sm" style={{ color: 'var(--color-teal-dark)' }}>{message}</p>}

        {selected && (
          <div className="fixed inset-0 z-[120] grid place-items-center p-4 bg-black/45 backdrop-blur-sm" onClick={() => setSelected(null)}>
            <div className="w-full max-w-xl rounded-3xl p-6 space-y-5" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--color-teal-dark)' }}>{selected.category.toUpperCase()}</p><h2 className="font-serif text-2xl font-semibold mt-1">{selected.id ? 'Update dashboard' : 'Add dashboard'}</h2></div><button onClick={() => setSelected(null)}><X className="w-5 h-5" /></button></div>
              <Field label="Button / dashboard name" value={selected.name} onChange={(v) => setSelected({ ...selected, name: v })} placeholder="Adsterra" />
              <Field label="Dashboard link" value={selected.dashboard_url} onChange={(v) => setSelected({ ...selected, dashboard_url: v })} placeholder="https://…" />
              <div><label className="label">Description</label><textarea value={selected.description || ''} onChange={(e) => setSelected({ ...selected, description: e.target.value })} className="input-field min-h-24 resize-y" placeholder="What this dashboard is for" /></div>
              <div className="flex items-center gap-3"><button type="button" onClick={() => setSelected({ ...selected, active: !selected.active })} className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: selected.active ? 'rgba(0,151,178,.12)' : 'rgba(0,0,0,.06)', color: selected.active ? 'var(--color-teal-dark)' : 'var(--color-text-muted)' }}>{selected.active ? 'Visible' : 'Hidden'}</button><span className="text-xs text-muted">Visible modules become buttons on the Finances dashboard.</span></div>
              <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setSelected(null)}>Cancel</button><button className="btn-primary" disabled={saving} onClick={save}><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}</button></div>
            </div>
          </div>
        )}

        <div className="mt-8 surface-card p-5">
          <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--color-teal-dark)' }}>Future payments</p>
          <p className="font-serif text-xl font-semibold mt-1">Add later</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>B2C payment providers can be added later with the same dashboard-link workflow. No payment gateway is activated by this module yet.</p>
        </div>
      </div>
    </div>
  );
}

function FinanceColumn({ title, icon: Icon, items, onAdd, onEdit, onDelete, onOpen }: { title: string; icon: typeof Building2; items: FinanceModule[]; onAdd: () => void; onEdit: (m: FinanceModule) => void; onDelete: (id: string) => void; onOpen: (m: FinanceModule) => void }) {
  return <section className="surface-card p-6">
    <div className="flex items-center justify-between gap-3 mb-5"><div className="flex items-center gap-3"><span className="w-11 h-11 rounded-xl gradient-teal grid place-items-center text-white"><Icon className="w-5 h-5" /></span><div><p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-teal-dark)' }}>Module</p><h2 className="font-serif text-2xl font-semibold">{title}</h2></div></div><button className="btn-ghost text-xs" onClick={onAdd}><Plus className="w-4 h-4" /> Add</button></div>
    <div className="space-y-3">{items.map((m) => <div key={m.id} className="rounded-2xl p-4" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{m.name}</h3><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{m.description || 'Dashboard'}</p></div><span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: m.active ? 'var(--color-teal-dark)' : 'var(--color-text-muted)' }}>{m.active ? 'Active' : 'Hidden'}</span></div><div className="flex flex-wrap gap-2 mt-3"><button className="btn-primary !w-auto text-xs" onClick={() => onOpen(m)}><ExternalLink className="w-3.5 h-3.5" /> Dashboard</button><button className="btn-ghost text-xs" onClick={() => onEdit(m)}><Save className="w-3.5 h-3.5" /> Update</button><a className="btn-ghost text-xs" href={m.dashboard_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /> Open</a><button className="btn-ghost text-xs" onClick={() => onDelete(m.id)}><Trash2 className="w-3.5 h-3.5" /> Remove</button></div></div>)}{items.length === 0 && <div className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Nothing added yet. Use Add to create the first dashboard button.</div>}</div>
  </section>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div><label className="label">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} className="input-field" placeholder={placeholder} /></div>;
}
