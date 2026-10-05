import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle, KeyRound, LogOut, Lock, Mail, Save, Settings, Trash2, MessageSquareWarning } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { updateProfile } from '@/lib/reviews';
import { deleteCurrentAccount } from '@/lib/account';
import { supabase } from '@/lib/supabase';
import { createGrievance, fetchMyGrievances, type GrievanceRecord } from '@/lib/moderation';

interface AccountPageProps { navigate: (path: string) => void; }

export function AccountPage({ navigate }: AccountPageProps) {
  const { user, profile, loading, refreshProfile, signOut, signInWithGoogle, resetPassword } = useAuth();
  const identities = user?.identities ?? [];
  const providers: string[] = identities.length ? identities.map((i) => i.provider) : ((user?.app_metadata?.providers as string[] | undefined) ?? []);
  const usesGoogle = providers.includes('google');
  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);
  const [grievanceCategory, setGrievanceCategory] = useState('Account or profile issue');
  const [grievanceSubject, setGrievanceSubject] = useState('');
  const [grievanceDetails, setGrievanceDetails] = useState('');
  const [grievanceSaving, setGrievanceSaving] = useState(false);
  const [grievanceMessage, setGrievanceMessage] = useState<string | null>(null);
  const [grievances, setGrievances] = useState<GrievanceRecord[]>([]);
  const hasPassword = passwordSet ?? (providers.includes('email') || !usesGoogle);
  const [signingOut, setSigningOut] = useState(false);
  const [resetSending, setResetSending] = useState(false);
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
  const [deleteEmail, setDeleteEmail] = useState('');

  useEffect(() => { if (profile?.novelty_username) setUsername(profile.novelty_username); }, [profile?.novelty_username]);
  useEffect(() => { if (user) void fetchMyGrievances().then(setGrievances).catch(() => undefined); }, [user?.id]);

  if (loading) return <div className="pt-32 container-prose text-center"><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading account…</p></div>;
  if (!user) return <div className="pt-32 container-prose text-center"><button onClick={() => navigate('/auth')} className="btn-primary">Sign In</button></div>;

  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
  const recentSignIn = Date.now() - lastSignIn < 10 * 60 * 1000;

  const reverifyWithGoogle = async () => {
    try { sessionStorage.setItem('nl_return_to', '/account'); } catch { /* ignore */ }
    try { await signInWithGoogle(); } catch (e) { setDeleteError(e instanceof Error ? e.message : 'Google sign-in failed.'); }
  };

  const saveUsername = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = username.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(clean)) { setUsernameMessage('Username must be 3–30 characters: lowercase letters, numbers and underscores.'); return; }
    setUsernameSaving(true); setUsernameMessage(null);
    try { await updateProfile(user.id, { novelty_username: clean }); await refreshProfile(); setUsername(clean); setUsernameMessage('Username saved.'); }
    catch (e) { setUsernameMessage(e instanceof Error && /duplicate|unique/i.test(e.message) ? 'That username is already taken. Choose another one.' : e instanceof Error ? e.message : 'Could not save username.'); }
    finally { setUsernameSaving(false); }
  };

  const logOut = async () => {
    setSigningOut(true);
    try { await signOut(); } finally { setSigningOut(false); navigate('/'); }
  };

  const sendResetLink = async () => {
    if (!user.email) return setPasswordMessage('No email address is linked to this account.');
    setResetSending(true); setPasswordMessage(null);
    try { await resetPassword(user.email); setPasswordMessage(`Password reset link sent to ${user.email}. Open it to choose a new password.`); }
    catch (e) { setPasswordMessage(e instanceof Error ? e.message : 'Could not send the reset email.'); }
    finally { setResetSending(false); }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setPasswordMessage(null);
    if (newPassword.length < 8) return setPasswordMessage('Use at least 8 characters for a stronger password.');
    if (newPassword !== confirmPassword) return setPasswordMessage('New password and confirmation do not match.');
    setPasswordSaving(true);
    try {
      // Google-only accounts have no password yet, so there is nothing to verify: they are adding one.
      if (hasPassword) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email || '', password: currentPassword });
        if (reauthError) throw new Error('Current password is incorrect.');
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const wasSet = hasPassword;
      setPasswordSet(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setPasswordMessage(wasSet ? 'Password changed successfully.' : 'Password set successfully. You can now sign in with your email and password or with Google.');
    } catch (e) { setPasswordMessage(e instanceof Error ? e.message : 'Could not change password.'); }
    finally { setPasswordSaving(false); }
  };

  const deleteAccount = async (event: React.FormEvent) => {
    event.preventDefault(); setDeleteError(null);
    if (deleteConfirm !== 'DELETE') return setDeleteError('Type DELETE exactly to confirm permanent account deletion.');
    setDeleting(true);
    try {
      if (hasPassword) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email || '', password: deletePassword });
        if (reauthError) throw new Error('Password verification failed.');
      } else {
        // Google-only: no password to check. Require the account email and a recent Google sign-in.
        if (deleteEmail.trim().toLowerCase() !== (user.email || '').toLowerCase()) throw new Error('Type your account email exactly to confirm.');
        if (!recentSignIn) throw new Error('For your security, please re-verify with Google first (button below), then try again.');
      }
      await deleteCurrentAccount();
      navigate('/');
    } catch (e) { setDeleteError(e instanceof Error ? e.message : 'Account deletion failed.'); setDeleting(false); }
  };

  return <div className="pt-24 pb-20 container-prose animate-fade-in">
    <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-sm mb-7" style={{ color: 'var(--color-text-muted)' }}><ArrowLeft className="w-4 h-4" /> Home</button>
    <div className="max-w-3xl mx-auto space-y-7">
      <header><div className="inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}><Settings className="w-3.5 h-3.5" /> Account</div><h1 className="font-serif text-4xl font-semibold mt-2" style={{ color: 'var(--color-text)' }}>Account & Security</h1><p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>Manage your unique Novelty username, sign-in security and account lifecycle.</p>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Signed in as <strong>{user.email}</strong>{usesGoogle ? ' · via Google' : ''}</p></header>

      <div className="surface-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3"><LogOut className="w-5 h-5 mt-0.5" style={{ color: 'var(--color-teal-dark)' }} /><div><h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Log out</h2><p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Sign out of this device. Your account, reviews and data are kept — just sign back in any time.</p></div></div>
        <button type="button" onClick={() => void logOut()} disabled={signingOut} className="btn-ghost shrink-0"><LogOut className="w-4 h-4" /> {signingOut ? 'Logging out…' : 'Log out'}</button>
      </div>

      <form onSubmit={saveUsername} className="surface-card p-6 space-y-4">
        <div><h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Novelty username</h2><p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>New accounts are assigned one automatically from email. You can change it later if the new ID is available.</p></div>
        <div className="flex gap-2"><div className="flex-1 relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold" style={{ color: 'var(--color-cyan-dark)' }}>@</span><input value={username} onChange={(e) => setUsername(e.target.value)} className="input-field pl-8" maxLength={30} /></div><button disabled={usernameSaving} className="btn-primary"><Save className="w-4 h-4" /> Save</button></div>
        {usernameMessage && <p className="text-sm" style={{ color: /saved/i.test(usernameMessage) ? 'var(--color-teal-dark)' : '#ef4444' }}>{usernameMessage}</p>}
      </form>

      <form onSubmit={changePassword} className="surface-card p-6 space-y-4">
        <div className="flex items-center gap-2"><KeyRound className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }} /><h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>{hasPassword ? 'Change password' : 'Set a password'}</h2></div>
        {!hasPassword && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>You signed in with Google, so this account has no password yet. Add one if you also want to sign in with your email. Google sign-in keeps working either way.</p>}
        {hasPassword && <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} auto="current-password" />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><PasswordField label="New password" value={newPassword} onChange={setNewPassword} auto="new-password" /><PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} auto="new-password" /></div>
        {passwordMessage && <p className="text-sm" style={{ color: /successfully/i.test(passwordMessage) ? 'var(--color-teal-dark)' : '#ef4444' }}>{passwordMessage}</p>}
        <button disabled={passwordSaving} className="btn-primary">{passwordSaving ? 'Changing…' : <><Lock className="w-4 h-4" /> {hasPassword ? 'Change Password' : 'Set Password'}</>}</button>
        <div className="pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{hasPassword ? 'Forgot your current password?' : 'Prefer an email link?'} We can email a secure reset link to {user.email}.</p>
          <button type="button" onClick={() => void sendResetLink()} disabled={resetSending} className="btn-ghost text-sm"><Mail className="w-4 h-4" /> {resetSending ? 'Sending…' : 'Email me a reset link'}</button>
        </div>
      </form>

      <section className="surface-card p-6 space-y-4">
        <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl grid place-items-center" style={{background:'rgba(8,145,178,.10)',color:'var(--color-teal-dark)'}}><MessageSquareWarning className="w-5 h-5" /></div><div><h2 className="font-serif text-xl font-semibold">Grievances & support</h2><p className="text-sm mt-1" style={{color:'var(--color-text-muted)'}}>Send a coordinated grievance to the Novelty Library administration team. You will receive a reference number and can track its status here.</p></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="label">Category</label><select value={grievanceCategory} onChange={e=>setGrievanceCategory(e.target.value)} className="input-field"><option>Account or profile issue</option><option>Review or submission issue</option><option>Moderation decision</option><option>Report / blacklist concern</option><option>Privacy concern</option><option>Technical problem</option><option>Other</option></select></div><div><label className="label">Subject</label><input value={grievanceSubject} onChange={e=>setGrievanceSubject(e.target.value)} className="input-field" maxLength={160} placeholder="Briefly describe the issue" /></div></div>
        <div><label className="label">Details</label><textarea value={grievanceDetails} onChange={e=>setGrievanceDetails(e.target.value)} className="input-field min-h-32 resize-y" maxLength={5000} placeholder="Explain what happened, what you need reviewed, and any relevant context." /></div>
        {grievanceMessage && <p className="text-sm" style={{color:/submitted|GRV-/i.test(grievanceMessage)?'var(--color-teal-dark)':'#dc2626'}}>{grievanceMessage}</p>}
        <button type="button" disabled={grievanceSaving} onClick={async()=>{setGrievanceMessage(null);if(!grievanceSubject.trim()||grievanceDetails.trim().length<5){setGrievanceMessage('Please enter a subject and at least a few details.');return;}setGrievanceSaving(true);try{const row=await createGrievance(grievanceCategory,grievanceSubject,grievanceDetails);setGrievances(v=>[row,...v]);setGrievanceSubject('');setGrievanceDetails('');setGrievanceMessage(`Grievance submitted. Reference ${row.reference_no}.`);}catch(e){setGrievanceMessage(e instanceof Error?e.message:'Could not submit grievance.');}finally{setGrievanceSaving(false);}}} className="btn-primary !w-auto">{grievanceSaving?'Submitting…':'Submit grievance'}</button>
        {grievances.length>0 && <div className="pt-3 border-t space-y-2" style={{borderColor:'var(--color-border)'}}><p className="text-xs uppercase tracking-wider font-bold" style={{color:'var(--color-text-muted)'}}>Your grievance records</p>{grievances.map(g=><div key={g.id} className="rounded-xl p-3" style={{background:'var(--color-paper)',border:'1px solid var(--color-border)'}}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{g.reference_no} · {g.subject}</strong><span className="text-[11px] px-2 py-1 rounded-full" style={{background:'rgba(8,145,178,.10)',color:'var(--color-teal-dark)'}}>{g.status}</span></div><p className="text-xs mt-1" style={{color:'var(--color-text-muted)'}}>{g.category} · {new Date(g.created_at).toLocaleString()}</p></div>)}</div>}
      </section>


      <form onSubmit={deleteAccount} className="rounded-3xl p-6 space-y-4" style={{ background: 'rgba(239,68,68,.045)', border: '1px solid rgba(239,68,68,.2)' }}>
        <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,.1)', color: '#dc2626' }}><AlertTriangle className="w-5 h-5" /></div><div><h2 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Delete account</h2><p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>This permanently removes your authentication account and associated profile data. This action cannot be undone.</p></div></div>
        {hasPassword ? <PasswordField label="Confirm with your current password" value={deletePassword} onChange={setDeletePassword} auto="current-password" /> : <>
          <div><label className="label">Type your account email to confirm</label><input type="email" required value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} className="input-field" autoComplete="off" placeholder={user.email || ''} /></div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{recentSignIn ? 'Your Google sign-in is recent, so you can continue.' : 'Your Google sign-in is older than 10 minutes. Re-verify with Google before deleting.'}</p>
          {!recentSignIn && <button type="button" onClick={() => void reverifyWithGoogle()} className="btn-ghost text-sm">Re-verify with Google</button>}
        </>}
        <div><label className="label">Type DELETE to confirm</label><input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="input-field" autoComplete="off" /></div>
        {deleteError && <p className="text-sm" style={{ color: '#dc2626' }}>{deleteError}</p>}
        <button disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: '#dc2626', color: 'white', opacity: deleting ? .6 : 1 }}><Trash2 className="w-4 h-4" /> {deleting ? 'Deleting account…' : 'Delete my account'}</button>
      </form>

      <div className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}><CheckCircle className="w-4 h-4 inline mr-1" style={{ color: 'var(--color-teal-dark)' }} /> Security-sensitive changes require fresh verification (password, or a recent Google sign-in). · <button onClick={() => navigate('/privacy')} className="underline underline-offset-2">Privacy</button> · <button onClick={() => navigate('/terms')} className="underline underline-offset-2">Terms</button> · <button onClick={() => navigate('/cookies')} className="underline underline-offset-2">Cookies</button></div>
    </div>
  </div>;
}

function PasswordField({ label, value, onChange, auto }: { label: string; value: string; onChange: (v: string) => void; auto: string }) {
  return <div><label className="label">{label}</label><div className="relative"><Lock className="field-icon" /><input type="password" required value={value} onChange={(e) => onChange(e.target.value)} className="input-field pl-10" autoComplete={auto} /></div></div>;
}
