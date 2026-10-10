import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookMarked, CheckCircle2, CirclePlus, Trash2, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { adminCreateBookReservation, deleteBookReservation, fetchBookReservationsForAdmin, updateBookReservationStatus, type BookReservation } from '@/lib/reviews';
import { getErrorMessage } from '@/lib/format';

interface Props { navigate: (path: string) => void; embedded?: boolean; }

export function AdminReservedBookReviewsPage({ navigate, embedded = false }: Props) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [items, setItems] = useState<BookReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [bookName, setBookName] = useState('');
  const [authorName, setAuthorName] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await fetchBookReservationsForAdmin()); } catch (err) { setError(getErrorMessage(err, 'Failed to load reservations.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (!authLoading && user && isAdmin) void load(); }, [authLoading, user, isAdmin, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => item.status === filter && (!q || item.book_name.toLowerCase().includes(q) || (item.author_name || '').toLowerCase().includes(q) || (item.requester_name || '').toLowerCase().includes(q) || (item.requester_email || '').toLowerCase().includes(q)));
  }, [items, filter, search]);

  const action = async (item: BookReservation, status: 'accepted' | 'rejected') => {
    setBusy(item.id); setError(null);
    try { await updateBookReservationStatus(item.id, status); setMessage(status === 'accepted' ? `“${item.book_name}” is now reserved.` : `Reservation for “${item.book_name}” rejected.`); await load(); }
    catch (err) { setError(getErrorMessage(err, 'Failed to update reservation.')); }
    finally { setBusy(null); }
  };

  const addDirect = async () => {
    if (!bookName.trim()) { setError('Book name is required.'); return; }
    try { await adminCreateBookReservation(bookName, authorName); setAddOpen(false); setBookName(''); setAuthorName(''); setMessage(`“${bookName.trim()}” added directly as reserved.`); await load(); }
    catch (err) { setError(getErrorMessage(err, 'Failed to add reserved book.')); }
  };

  const removeAccepted = async (item: BookReservation) => {
    const confirmed = window.confirm(`Delete the reservation for “${item.book_name}”? This will release the book so it can be reviewed/reserved again.`);
    if (!confirmed) return;

    setBusy(item.id); setError(null);
    try {
      await deleteBookReservation(item.id);
      setMessage(`“${item.book_name}” has been removed from the reserved books list.`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete reservation.'));
    } finally {
      setBusy(null);
    }
  };

  if (authLoading) return <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!user) return <div className="py-16 text-center"><p className="text-sm mb-4">Sign in required.</p><button onClick={() => navigate('/auth')} className="btn-primary">Sign In</button></div>;
  if (!isAdmin) return <div className="py-16 text-center"><p className="text-sm mb-4">Access denied.</p><button onClick={() => navigate('/')} className="btn-ghost">Back to Home</button></div>;

  return <div className={embedded ? '' : 'pt-24 pb-20 container-prose animate-fade-in'}>
    {!embedded && <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1.5 text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft className="w-4 h-4"/> Admin Dashboard</button>}
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5"><div><div className="flex items-center gap-2"><BookMarked className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }}/><h1 className="font-serif text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Reserved Book Reviews List</h1></div><p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Review requests that users want held before they write a review.</p></div><button type="button" onClick={() => setAddOpen(true)} className="btn-primary"><CirclePlus className="w-4 h-4"/> Add Reserved Book</button></div>
    <div className="flex flex-wrap gap-2 mb-4">{(['pending','accepted','rejected'] as const).map((tab)=><button key={tab} onClick={()=>setFilter(tab)} className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: filter===tab ? 'var(--color-teal-dark)' : 'var(--color-surface)', color: filter===tab ? 'white' : 'var(--color-text-muted)', border: filter===tab ? 'none' : '1px solid var(--color-border)' }}>{tab[0].toUpperCase()+tab.slice(1)}</button>)}<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search book, author or requester" className="input-field min-w-[240px] flex-1"/></div>
    {message && <div className="mb-4 rounded-xl p-3 text-sm" style={{ background:'rgba(0,151,178,.08)', color:'var(--color-teal-dark)' }}>{message}</div>}
    {error && <div className="mb-4 rounded-xl p-3 text-sm" style={{ background:'rgba(239,68,68,.08)', color:'#dc2626' }}>{error}</div>}
    {loading ? <div className="surface-card p-10 text-center text-sm">Loading reservations...</div> : !filtered.length ? <div className="surface-card p-10 text-center text-sm" style={{ color:'var(--color-text-muted)' }}>No {filter} reservations.</div> : <div className="space-y-3">{filtered.map(item=><div key={item.id} className="surface-card p-4 flex flex-wrap items-center gap-4"><div className="flex-1 min-w-[220px]"><h3 className="font-serif text-lg font-semibold" style={{color:'var(--color-text)'}}>{item.book_name}</h3><p className="text-sm" style={{color:'var(--color-text-muted)'}}>{item.author_name ? `by ${item.author_name}` : 'Author not supplied'}</p><p className="text-xs mt-2" style={{color:'var(--color-text-muted)'}}>{item.user_id ? `Requested by ${item.requester_name || item.requester_email || 'reader'}` : 'Added directly by admin'} · {new Date(item.created_at).toLocaleString()}</p></div>{filter==='pending' && <div className="flex gap-2"><button disabled={busy===item.id} onClick={()=>void action(item,'accepted')} className="btn-primary"><CheckCircle2 className="w-4 h-4"/> Accept</button><button disabled={busy===item.id} onClick={()=>void action(item,'rejected')} className="btn-ghost"><XCircle className="w-4 h-4"/> Reject</button></div>}{filter==='accepted' && <button disabled={busy===item.id} onClick={()=>void removeAccepted(item)} className="btn-ghost text-red-600 dark:text-red-300 border border-red-200/70 dark:border-red-900/50" title="Delete reservation"><Trash2 className="w-4 h-4"/> Delete</button>}</div>)}</div>}
    {addOpen && <div className="fixed inset-0 z-[120] grid place-items-center p-4 bg-black/45 backdrop-blur-sm" onClick={()=>setAddOpen(false)}><div className="w-full max-w-md rounded-3xl p-6" style={{background:'var(--color-paper)',border:'1px solid var(--color-border)'}} onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl font-semibold">Add Reserved Book</h2><button onClick={()=>setAddOpen(false)}>×</button></div><div className="space-y-3"><input value={bookName} onChange={e=>setBookName(e.target.value)} placeholder="Book name" className="input-field w-full" autoFocus/><input value={authorName} onChange={e=>setAuthorName(e.target.value)} placeholder="Author name (optional)" className="input-field w-full"/></div><div className="flex gap-2 mt-4"><button onClick={()=>setAddOpen(false)} className="btn-ghost flex-1">Cancel</button><button onClick={()=>void addDirect()} className="btn-primary flex-1">Add & Reserve</button></div></div></div>}
  </div>;
}
