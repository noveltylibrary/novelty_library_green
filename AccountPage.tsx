import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle, KeyRound, Lock, Save, Settings, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { updateProfile } from '@/lib/reviews';
import { deleteCurrentAccount } from '@/lib/account';
import { supabase } from '@/lib/supabase';

interface AccountPageProps { navigate: (path: string) => void; }

export function AccountPage({ navigate }: AccountPageProps) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [username, setUsername] = useState(profile?.novelty_username || '');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => { if (profile?.novelty_username) setUsername(profile.novelty_username); }, [profile?.novelty_username]);

  if (loading) return <div className="pt-32 container-prose text-center"><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading account…</p></div>;
  if (!user) return <div className="pt-32 container-prose text-center"><button onClick={() => navigate('/auth')} className="btn-primary">Sign In</button></div>;

  const saveUsername = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = username.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(clean)) { setUsernameMessage('Username must be 3–30 characters: lowercase letters, numbers and underscores.'); return; }
    setUsernameSaving(true); setUsernameMessage(null);
    try { await updateProfile(user.id, { novelty_username: clean }); await refreshProfile(); setUsername(clean); setUsernameMessage('Username saved.'); }
    catch (e) { setUsernameMessage(e instanceof Error && /duplicate|unique/i.test(e.message) ? 'That username is already taken. Choose another one.' : e instanceof Error ? e.message : 'Could not save username.'); }
    finally { setUsernameSaving(false); }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setPasswordMessage(null);
    if (newPassword.length < 8) return setPasswordMessage('Use at least 8 characters for a stronger password.');
    if (newPassword !== confirmPassword) return setPasswordMessage('New password and confirmation do not match.');
    setPasswordSaving(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email || '', password: currentPassword });
      if (reauthError) throw new Error('Current password is incorrect.');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordMessage('Password changed successfully.');
    } catch (e) { setPasswordMessage(e instanceof Error ? e.message : 'Could not change password.'); }
    finally { setPasswordSaving(false); }
  };

  const deleteAccount = async (event: React.FormEvent) => {
    event.preventDefault(); setDeleteError(null);
    if (deleteConfirm !== 'DELETE') return setDeleteError('Type DELETE exactly to confirm permanent account deletion.');
    setDeleting(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email || '', password: deletePassword });
      if (reauthError) throw new Error('Password verification failed.');
      await deleteCurrentAccount();
      navigate('/');
    } catch (e) { setDeleteError(e instanceof Error ? e.message : 'Account deletion failed.'); setDeleting(false); }
  };

  return <div className="pt-24 pb-20 container-prose animate-fade-in">
    <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-sm mb-7" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft className="w-4 h-4" /> Home</button>
    <div className="max-w-3xl mx-auto space-y-7">
      <header><div className="inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}><Settings className="w-3.5 h-3.5" /> Account</div><h1 className="font-serif text-4xl font-semibold mt-2" style={{ color: 'var(--color-text)' }}>Account & Security</h1><p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Manage your unique Novelty username, sign-in security and account lifecycle.</p></header>

      <form onSubmit={saveUsername} className="surface-card p-6 space-y-4">
        <div><h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Novelty username</h2><p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>New accounts are assigned one automatically from email. You can change it later if the new ID is available.</p></div>
        <div className="flex gap-2"><div className="flex-1 relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold" style={{ color: 'var(--color-cyan-dark)' }}>@</span><input value={username} onChange={(e) => setUsername(e.target.value)} className="input-field pl-8" maxLength={30} /></div><button disabled={usernameSaving} className="btn-primary"><Save className="w-4 h-4" /> Save</button></div>
        {usernameMessage && <p className="text-sm" style={{ color: /saved/i.test(usernameMessage) ? 'var(--color-teal-dark)' : '#ef4444' }}>{usernameMessage}</p>}
      </form>

      <form onSubmit={changePassword} className="surface-card p-6 space-y-4">
        <div className="flex items-center gap-2"><KeyRound className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }} /><h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Change password</h2></div>
        <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} auto="current-password" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><PasswordField label="New password" value={newPassword} onChange={setNewPassword} auto="new-password" /><PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} auto="new-password" /></div>
        {passwordMessage && <p className="text-sm" style={{ color: /successfully/i.test(passwordMessage) ? 'var(--color-teal-dark)' : '#ef4444' }}>{passwordMessage}</p>}
        <button disabled={passwordSaving} className="btn-primary">{passwordSaving ? 'Changing…' : <><Lock className="w-4 h-4" /> Change Password</>}</button>
      </form>

      <form onSubmit={deleteAccount} className="rounded-3xl p-6 space-y-4" style={{ background: 'rgba(239,68,68,.045)', border: '1px solid rgba(239,68,68,.2)' }}>
        <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,.1)', color: '#dc2626' }}><AlertTriangle className="w-5 h-5" /></div><div><h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Delete account</h2><p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>This permanently removes your authentication account and associated profile data. This action cannot be undone.</p></div></div>
        <PasswordField label="Confirm with your current password" value={deletePassword} onChange={setDeletePassword} auto="current-password" />
        <div><label className="label">Type DELETE to confirm</label><input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="input-field" autoComplete="off" /></div>
        {deleteError && <p className="text-sm" style={{ color: '#dc2626' }}>{deleteError}</p>}
        <button disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: '#dc2626', color: 'white', opacity: deleting ? .6 : 1 }}><Trash2 className="w-4 h-4" /> {deleting ? 'Deleting account…' : 'Delete my account'}</button>
      </form>

      <div className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}><CheckCircle className="w-4 h-4 inline mr-1" style={{ color: 'var(--color-teal-dark)' }} /> Security-sensitive changes require fresh password verification. · <button onClick={() => navigate('/privacy')} className="underline underline-offset-2">Privacy</button> · <button onClick={() => navigate('/terms')} className="underline underline-offset-2">Terms</button></div>
    </div>
  </div>;
}

function PasswordField({ label, value, onChange, auto }: { label: string; value: string; onChange: (v: string) => void; auto: string }) {
  return <div><label className="label">{label}</label><div className="relative"><Lock className="field-icon" /><input type="password" required value={value} onChange={(e) => onChange(e.target.value)} className="input-field pl-10" autoComplete={auto} /></div></div>;
}
