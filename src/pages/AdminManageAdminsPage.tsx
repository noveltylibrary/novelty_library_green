import { useState, useEffect } from 'react';
import { ArrowLeft, UserCog, Trash2, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchSupportEmail, updateSupportEmail } from '@/lib/siteSettings';

interface AdminManageAdminsPageProps {
  navigate: (path: string) => void;
}

export function AdminManageAdminsPage({ navigate }: AdminManageAdminsPageProps) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportSaving, setSupportSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    if (!isAdmin) return;
    loadAdmins();
    fetchSupportEmail().then(setSupportEmail).catch(() => setSupportEmail('support.noveltylibrary@gmail.com'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, authLoading]);

  const loadAdmins = async () => {
    const { data, error } = await supabase.rpc('admin_list_admins');
    if (error) throw error;
    setAdminEmails((data ?? []).map((r: { email: string }) => r.email));
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    try {
      setAdminMsg(null);
      const { error } = await supabase.rpc('admin_add_admin', { p_email: newAdminEmail.trim() });
      if (error) throw error;
      setNewAdminEmail('');
      await loadAdmins();
      setAdminMsg(`Added ${newAdminEmail.trim()} as admin`);
    } catch (err) {
      setAdminMsg(err instanceof Error ? err.message : 'Failed to add admin');
    }
  };

  const handleSaveSupportEmail = async () => {
    try {
      setSupportSaving(true);
      setAdminMsg(null);
      await updateSupportEmail(supportEmail);
      setAdminMsg(`Support email updated to ${supportEmail.trim().toLowerCase()}.`);
      setSupportEmail(supportEmail.trim().toLowerCase());
    } catch (err) {
      setAdminMsg(err instanceof Error ? err.message : 'Failed to update support email');
    } finally {
      setSupportSaving(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!confirm(`Remove ${email} from admins?`)) return;
    try {
      setAdminMsg(null);
      const { error } = await supabase.rpc('admin_remove_admin', { p_email: email });
      if (error) throw error;
      await loadAdmins();
      setAdminMsg(`Removed ${email} from admins`);
    } catch (err) {
      setAdminMsg(err instanceof Error ? err.message : 'Failed to remove admin');
    }
  };

  if (authLoading) {
    return (
      <div className="pt-32 container-prose text-center">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pt-32 container-prose text-center">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>You need to sign in to access the admin panel.</p>
        <button onClick={() => navigate('/auth')} className="btn-primary">Sign In</button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="pt-32 container-prose text-center max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(239, 68, 68, 0.3)' }} />
        <h1 className="font-serif text-2xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Access Denied</h1>
        <button onClick={() => navigate('/')} className="btn-ghost"><ArrowLeft className="w-4 h-4" /> Back to Home</button>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <div className="mb-6">
        <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1.5 text-sm mb-3 transition-colors" style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft className="w-4 h-4" /> Admin Dashboard
        </button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} />
          <h1 className="font-serif text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>Admins &amp; Contacts</h1>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Manage which email addresses have access to the admin panel.
        </p>
      </div>

      <div className="max-w-xl space-y-4">
        <div className="surface-card p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-serif text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Admin contact settings</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Update a site-wide contact address. The Support address is used automatically in the footer, About, Terms and Privacy pages.</p>
            </div>
            <Shield className="w-5 h-5 shrink-0" style={{ color: 'var(--color-teal-dark)' }} />
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <select value="support" disabled className="input-field" aria-label="Admin contact role">
              <option value="support">Support</option>
            </select>
            <input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support.noveltylibrary@gmail.com" className="input-field" aria-label="Support email" />
          </div>
          <button type="button" onClick={handleSaveSupportEmail} disabled={supportSaving} className="btn-primary mt-3">
            {supportSaving ? 'Saving…' : 'Update Support Email'}
          </button>
        </div>

        <div className="surface-card p-6">
          <h3 className="font-serif text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Admin Access</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Only these email addresses have access to the admin panel.
          </p>
          <div className="flex gap-2 mb-4">
            <input type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="newadmin@example.com" className="input-field" />
            <button onClick={handleAddAdmin} className="btn-primary text-sm whitespace-nowrap">
              <UserCog className="w-4 h-4" /> Add
            </button>
          </div>
          {adminMsg && <p className="text-sm mb-3" style={{ color: 'var(--color-cyan-dark)' }}>{adminMsg}</p>}
          <div className="space-y-2">
            {adminEmails.map((email) => (
              <div key={email} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2">
                  <UserCog className="w-4 h-4" style={{ color: 'var(--color-cyan-dark)' }} />
                  <span className="text-sm" style={{ color: 'var(--color-text)' }}>{email}</span>
                  {email === user.email && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(53, 211, 217, 0.15)', color: 'var(--color-cyan-dark)' }}>You</span>
                  )}
                </div>
                <button onClick={() => handleRemoveAdmin(email)} className="transition-colors" style={{ color: 'rgba(239, 68, 68, 0.6)' }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
