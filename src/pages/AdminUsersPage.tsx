import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  RefreshCw,
  Search,
  Shield,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchBlacklistedUsers, type BlacklistedUser } from '@/lib/moderation';
import { supabase } from '@/lib/supabase';

interface AdminUsersPageProps {
  navigate: (path: string) => void;
}

interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  confirmed_at: string | null;
  banned_until: string | null;
  profile_name: string | null;
  profile_email: string | null;
  novelty_username: string | null;
  instagram_id: string | null;
  website: string | null;
  avatar_url: string | null;
  favorite_book: string | null;
  books_read_this_month: number | null;
  total_books_read: number | null;
  reading_since: number | null;
  favorite_author: string | null;
  favorite_genre: string | null;
  profile_created_at: string | null;
  profile_updated_at: string | null;
  review_count: number;
  pending_review_count: number;
  draft_count: number;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
}

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function initials(user: AdminUser) {
  const source = user.profile_name?.trim() || user.email?.split('@')[0] || 'U';
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'U';
}

function jsonEntries(value: Record<string, unknown>) {
  return Object.entries(value).filter(([key]) => !['password', 'access_token', 'refresh_token'].includes(key));
}

export function AdminUsersPage({ navigate }: AdminUsersPageProps) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [blacklist, setBlacklist] = useState<BlacklistedUser[]>([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);

  const loadUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('admin_list_users');
    if (rpcError) {
      setError(rpcError.message);
      setUsers([]);
    } else {
      setUsers((data ?? []) as AdminUser[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    if (!isAdmin) return;
    loadUsers();
    void loadBlacklist();
  }, [authLoading, user, isAdmin, navigate, loadUsers]);

  const loadBlacklist = async () => { setBlacklistLoading(true); try { setBlacklist(await fetchBlacklistedUsers()); } catch { setBlacklist([]); } finally { setBlacklistLoading(false); } };

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((item) => [
      item.email, item.profile_email, item.profile_name, item.novelty_username, item.instagram_id, item.phone, item.id,
    ].some((value) => value?.toLowerCase().includes(needle)));
  }, [users, search]);

  const stats = useMemo(() => ({
    total: users.length,
    confirmed: users.filter((item) => !!item.email_confirmed_at || !!item.confirmed_at).length,
    profiles: users.filter((item) => !!item.profile_name || !!item.instagram_id || !!item.website || !!item.avatar_url).length,
    reviews: users.reduce((sum, item) => sum + Number(item.review_count || 0), 0),
  }), [users]);

  if (authLoading) {
    return <div className="pt-32 container-prose text-center"><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p></div>;
  }

  if (!user) {
    return <div className="pt-32 container-prose text-center"><p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>You need to sign in to access the admin panel.</p><button onClick={() => navigate('/auth')} className="btn-primary">Sign In</button></div>;
  }

  if (!isAdmin) {
    return <div className="pt-32 container-prose text-center max-w-md mx-auto"><AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(239,68,68,.3)' }} /><h1 className="font-serif text-2xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Access Denied</h1><button onClick={() => navigate('/')} className="btn-ghost"><ArrowLeft className="w-4 h-4" /> Back to Home</button></div>;
  }

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1.5 text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft className="w-4 h-4" /> Admin Dashboard</button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} />
            <h1 className="font-serif text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>Users & Accounts</h1>
          </div>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--color-text-muted)' }}>
            Read-only view of the accounts and profile information stored in Supabase. Passwords, access tokens and refresh tokens are never shown.
          </p>
        </div>
        <button onClick={() => loadUsers(true)} disabled={refreshing} className="btn-ghost text-sm"><RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl p-4 flex gap-3" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.22)', color: 'var(--color-text)' }}>
          <AlertCircle className="w-5 h-5 shrink-0" style={{ color: '#ef4444' }} />
          <div><p className="font-semibold text-sm">Could not load users</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{error}</p><p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>This page reads Supabase Auth users through the protected <code>admin_list_users()</code> RPC. If Supabase says the function is missing from the schema cache, apply the included admin-users migration (the latest one ends in <code>_admin_users_directory_fix.sql</code>) and then click Refresh.</p></div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total accounts', value: stats.total, icon: Users },
          { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle2 },
          { label: 'Profiles', value: stats.profiles, icon: UserRound },
          { label: 'Reviews submitted', value: stats.reviews, icon: FileText },
        ].map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div key={stat.label} className="surface-card p-4 rounded-2xl">
              <StatIcon className="w-4 h-4 mb-2" style={{ color: 'var(--color-cyan-dark)' }} />
              <div className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{stat.value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</div>
            </div>
          );
        })}
      </div>

      <section className="surface-card rounded-2xl p-5 mb-6" style={{border:'1px solid rgba(239,68,68,.18)'}}><div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><div className="flex items-center gap-2"><Shield className="w-4 h-4" style={{color:'#dc2626'}}/><h2 className="font-serif text-xl font-semibold">Blacklist</h2></div><p className="text-xs mt-1" style={{color:'var(--color-text-muted)'}}>Profiles reaching 30 or more community reports are automatically listed here and admins are notified.</p></div><button onClick={()=>void loadBlacklist()} disabled={blacklistLoading} className="btn-ghost text-xs">{blacklistLoading?'Refreshing…':'Refresh blacklist'}</button></div>{blacklist.length===0?<p className="text-sm" style={{color:'var(--color-text-muted)'}}>No automatically blacklisted profiles.</p>:<div className="space-y-2">{blacklist.map(item=><div key={item.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl p-3" style={{background:'rgba(239,68,68,.045)',border:'1px solid rgba(239,68,68,.12)'}}>{item.avatar_url?<img src={item.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover"/>:<div className="w-10 h-10 rounded-full grid place-items-center font-bold" style={{background:'rgba(239,68,68,.10)',color:'#b91c1c'}}>{(item.name||item.novelty_username||'U').slice(0,1).toUpperCase()}</div>}<div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{item.name||'Unnamed user'} {item.novelty_username&&<span className="font-normal" style={{color:'var(--color-cyan-dark)'}}>@{item.novelty_username}</span>}</p><p className="text-xs mt-0.5" style={{color:'var(--color-text-muted)'}}>{item.report_count} reports · {item.blacklisted_at?formatDate(item.blacklisted_at):'Blacklisted automatically'}</p></div><span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full" style={{background:'rgba(239,68,68,.10)',color:'#b91c1c'}}>Blacklisted</span></div>)}</div>}</section>

      <div className="surface-card rounded-2xl overflow-hidden">
        <div className="p-4 flex flex-wrap gap-3 items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email, name, Instagram, phone or user ID..." className="input-field w-full pl-9" />
          </div>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{filteredUsers.length} of {users.length} accounts</span>
        </div>

        {loading ? (
          <div className="p-12 text-center"><RefreshCw className="w-7 h-7 mx-auto mb-3 animate-spin" style={{ color: 'var(--color-cyan-dark)' }} /><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading accounts...</p></div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center"><Users className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} /><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No accounts match your search.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr style={{ background: 'var(--color-paper)', borderBottom: '1px solid var(--color-border)' }}>
                  {['User', 'Account', 'Profile', 'Activity', 'Data', ''].map((heading) => <th key={heading} className="px-4 py-3 text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-muted)' }}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((item) => {
                  const confirmed = !!item.email_confirmed_at || !!item.confirmed_at;
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-[rgba(8,145,178,.04)]" style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {item.avatar_url ? <img src={item.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: 'rgba(8,145,178,.12)', color: 'var(--color-cyan-dark)' }}>{initials(item)}</div>}
                          <div><button onClick={() => setSelected(item)} className="font-semibold text-sm text-left hover:underline" style={{ color: 'var(--color-text)' }}>{item.profile_name || item.email || 'Unnamed user'}</button><div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.email || 'No email'}</div></div>
                        </div>
                      </td>
                      <td className="px-4 py-4"><div className="flex items-center gap-1.5 text-xs" style={{ color: confirmed ? 'var(--color-cyan-dark)' : 'var(--color-text-muted)' }}>{confirmed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}{confirmed ? 'Confirmed' : 'Unconfirmed'}</div><div className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Joined {formatDate(item.created_at)}</div></td>
                      <td className="px-4 py-4"><div className="text-xs font-semibold" style={{ color: 'var(--color-cyan-dark)' }}>{item.novelty_username ? `@${item.novelty_username.replace(/^@/, '')}` : 'No username'}</div><div className="text-xs mt-1" style={{ color: 'var(--color-text)' }}>{item.instagram_id ? `Instagram: @${item.instagram_id.replace(/^@/, '')}` : 'No Instagram'}</div><div className="text-[11px] mt-1 truncate max-w-[180px]" style={{ color: 'var(--color-text-muted)' }}>{item.website || 'No website'}</div></td>
                      <td className="px-4 py-4"><div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}><Clock3 className="w-3.5 h-3.5" />{formatDate(item.last_sign_in_at)}</div></td>
                      <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5 text-[11px]"><span className="px-2 py-1 rounded-full" style={{ background: 'rgba(8,145,178,.1)', color: 'var(--color-cyan-dark)' }}>{item.review_count} reviews</span><span className="px-2 py-1 rounded-full" style={{ background: item.pending_review_count ? 'rgba(245,158,11,.12)' : 'var(--color-paper)', color: 'var(--color-text-muted)' }}>{item.pending_review_count} pending</span><span className="px-2 py-1 rounded-full" style={{ background: 'var(--color-paper)', color: 'var(--color-text-muted)' }}>{item.draft_count} drafts</span></div></td>
                      <td className="px-4 py-4 text-right"><button onClick={() => setSelected(item)} className="btn-ghost text-xs">View</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.55)' }} onClick={() => setSelected(null)}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">{selected.avatar_url ? <img src={selected.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" /> : <div className="w-14 h-14 rounded-full flex items-center justify-center font-semibold" style={{ background: 'rgba(8,145,178,.12)', color: 'var(--color-cyan-dark)' }}>{initials(selected)}</div>}<div><h2 className="font-serif text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>{selected.profile_name || selected.email || 'Unnamed user'}</h2><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{selected.email || 'No email'} · {selected.id}</p></div></div>
              <button onClick={() => setSelected(null)} className="btn-ghost text-sm">Close</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="rounded-2xl p-4" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
                <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--color-text)' }}>Account</h3>
                <div className="space-y-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <p><b style={{ color: 'var(--color-text)' }}>Email:</b> {selected.email || '—'}</p><p><b style={{ color: 'var(--color-text)' }}>Phone:</b> {selected.phone || '—'}</p><p><b style={{ color: 'var(--color-text)' }}>Confirmed:</b> {formatDate(selected.email_confirmed_at || selected.confirmed_at)}</p><p><b style={{ color: 'var(--color-text)' }}>Joined:</b> {formatDate(selected.created_at)}</p><p><b style={{ color: 'var(--color-text)' }}>Last sign-in:</b> {formatDate(selected.last_sign_in_at)}</p><p><b style={{ color: 'var(--color-text)' }}>Account updated:</b> {formatDate(selected.updated_at)}</p></div>
              </section>
              <section className="rounded-2xl p-4" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
                <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--color-text)' }}>Profile</h3>
                <div className="space-y-2 text-xs" style={{ color: 'var(--color-text-muted)' }}><p><b style={{ color: 'var(--color-text)' }}>Name:</b> {selected.profile_name || '—'}</p><p><b style={{ color: 'var(--color-text)' }}>Novelty username:</b> {selected.novelty_username ? `@${selected.novelty_username.replace(/^@/, '')}` : '—'}</p><p><b style={{ color: 'var(--color-text)' }}>Instagram:</b> {selected.instagram_id || '—'}</p><p><b style={{ color: 'var(--color-text)' }}>Website:</b> {selected.website || '—'}</p><p><b style={{ color: 'var(--color-text)' }}>Profile email:</b> {selected.profile_email || '—'}</p><p><b style={{ color: 'var(--color-text)' }}>Favourite book:</b> {selected.favorite_book || '—'}</p><p><b style={{ color: 'var(--color-text)' }}>Favourite author:</b> {selected.favorite_author || '—'}</p><p><b style={{ color: 'var(--color-text)' }}>Favourite genre:</b> {selected.favorite_genre || '—'}</p><p><b style={{ color: 'var(--color-text)' }}>Reading:</b> {selected.total_books_read ?? '—'} total · {selected.books_read_this_month ?? '—'} this month · since {selected.reading_since ?? '—'}</p><p><b style={{ color: 'var(--color-text)' }}>Reviews:</b> {selected.review_count} ({selected.pending_review_count} pending)</p><p><b style={{ color: 'var(--color-text)' }}>Saved drafts:</b> {selected.draft_count}</p></div>
              </section>
            </div>

            <section className="mt-4 rounded-2xl p-4" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}><Mail className="w-4 h-4" style={{ color: 'var(--color-cyan-dark)' }} /> User metadata</h3>
              {jsonEntries(selected.user_metadata).length ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{jsonEntries(selected.user_metadata).map(([key, value]) => <div key={key} className="rounded-xl p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{key}</div><div className="text-xs mt-1 break-all" style={{ color: 'var(--color-text)' }}>{typeof value === 'string' ? value : JSON.stringify(value)}</div></div>)}</div> : <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No user metadata.</p>}
            </section>

            <details className="mt-4 rounded-2xl p-4" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
              <summary className="cursor-pointer text-sm font-semibold" style={{ color: 'var(--color-text)' }}>App metadata</summary>
              <pre className="mt-3 text-[11px] whitespace-pre-wrap break-all" style={{ color: 'var(--color-text-muted)' }}>{JSON.stringify(selected.app_metadata, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
