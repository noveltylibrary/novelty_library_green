import { useEffect, useState, type ReactNode } from 'react';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { AlertTriangle, ArrowLeft, Archive, AtSign, Bell, Bookmark, ChevronRight, Cookie, FileText, KeyRound, LogOut, Lock, Mail, MessageSquareWarning, Moon, Save, ShieldCheck, SlidersHorizontal, Sun, Trash2 } from 'lucide-react';
import { ArchivesModal } from '@/components/ArchivesModal';
import { useAuth } from '@/lib/auth';
import { updateProfile } from '@/lib/reviews';
import { deleteCurrentAccount } from '@/lib/account';
import { supabase } from '@/lib/supabase';
import { getCaptchaToken } from '@/lib/captcha';
import { createGrievance, fetchMyGrievances, type GrievanceRecord } from '@/lib/moderation';
import { useTheme } from '@/lib/theme';
import { useCookieConsent } from '@/lib/cookieConsent';
import { NOTIF_CATEGORIES, fetchContentTraits, useUserPrefs, type ContentTrait } from '@/lib/userPrefs';

type View = 'root' | 'username' | 'appearance' | 'notifications' | 'content' | 'cookies' | 'password' | 'grievances' | 'delete';
const VIEW_KEY = 'nl_account_view';

/** A glassy shelf of rows. Rows are split by a hairline that fades out towards both edges. */
function Shelf({ label, children }: { label: string; children: ReactNode }) {
  return <section className="nl-acc-section" aria-label={label}><h3 className="nl-acc-label">{label}</h3><div className="nl-acc-shelf">{children}</div></section>;
}
function Row({ icon, label, value, danger, onClick, busy }: { icon: ReactNode; label: string; value?: string; danger?: boolean; onClick: () => void; busy?: boolean }) {
  return <button type="button" className={`nl-acc-row ${danger ? 'is-danger' : ''}`} onClick={onClick} disabled={busy}>
    <span className="nl-acc-ico" aria-hidden="true">{icon}</span>
    <span className="nl-acc-name">{label}</span>
    {value && <span className="nl-acc-val">{value}</span>}
    <ChevronRight className="nl-acc-arrow" aria-hidden="true" />
  </button>;
}

/**
 * Accounts & Settings, shown inside the profile page. The root view lists the sections; tapping a row opens
 * that tab in the same place, with a Back row to return.
 */
export function AccountPanel({ navigate }: { navigate: (path: string) => void }) {
  const { user, profile, refreshProfile, signOut, resetPassword } = useAuth();
  const identities = user?.identities ?? [];
  const providers: string[] = identities.length ? identities.map((i) => i.provider) : ((user?.app_metadata?.providers as string[] | undefined) ?? []);
  const usesGoogle = providers.includes('google');
  const [view, setView] = useState<View>(() => { try { const v = sessionStorage.getItem(VIEW_KEY); if (v === 'delete') { sessionStorage.removeItem(VIEW_KEY); return 'delete'; } } catch { /* ignore */ } return 'root'; });
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
  const [archivesOpen, setArchivesOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const consent = useCookieConsent();
  const userPrefs = useUserPrefs();
  const [traits, setTraits] = useState<ContentTrait[] | null>(null);
  useEffect(() => { if (view === 'content' && traits === null) void fetchContentTraits().then(setTraits); }, [view, traits]);

  useEffect(() => { if (profile?.novelty_username) setUsername(profile.novelty_username); }, [profile?.novelty_username]);
  useEffect(() => { if (user) void fetchMyGrievances().then(setGrievances).catch(() => undefined); }, [user?.id]);

  if (!user) return null;

  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
  const recentSignIn = Date.now() - lastSignIn < 10 * 60 * 1000;

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
        const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email || '', password: currentPassword, options: { captchaToken: await getCaptchaToken() } });
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
        const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email || '', password: deletePassword, options: { captchaToken: await getCaptchaToken() } });
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

  const submitGrievance = async () => {
    setGrievanceMessage(null);
    if (!grievanceSubject.trim() || grievanceDetails.trim().length < 5) { setGrievanceMessage('Please enter a subject and at least a few details.'); return; }
    setGrievanceSaving(true);
    try {
      const row = await createGrievance(grievanceCategory, grievanceSubject, grievanceDetails);
      setGrievances((v) => [row, ...v]); setGrievanceSubject(''); setGrievanceDetails('');
      setGrievanceMessage(`Grievance submitted. Reference ${row.reference_no}.`);
    } catch (e) { setGrievanceMessage(e instanceof Error ? e.message : 'Could not submit grievance.'); }
    finally { setGrievanceSaving(false); }
  };

  const Back = ({ title }: { title: string }) => <div className="nl-acc-back"><button type="button" onClick={() => setView('root')}><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Accounts &amp; Settings</button><h3>{title}</h3></div>;

  if (view === 'username') return <div className="nl-acc-pane">
    <Back title="Username" />
    <form onSubmit={saveUsername} className="space-y-3">
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>New accounts get one automatically from their email. You can change it if the new one is available.</p>
      <div className="flex gap-2"><div className="flex-1 relative min-w-0"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold" style={{ color: 'var(--color-cyan-dark)' }}>@</span><input value={username} onChange={(e) => setUsername(e.target.value)} className="input-field pl-8" maxLength={30} aria-label="Novelty username" /></div><button disabled={usernameSaving} className="btn-primary !w-auto"><Save className="w-4 h-4" /> Save</button></div>
      {usernameMessage && <p className="text-sm" style={{ color: /saved/i.test(usernameMessage) ? 'var(--color-teal-dark)' : '#ef4444' }}>{usernameMessage}</p>}
    </form>
  </div>;

  if (view === 'appearance') return <div className="nl-acc-pane">
    <Back title="Appearance" />
    <div className="nl-acc-seg" role="radiogroup" aria-label="Colour mode">
      {([['light', 'Light', Sun], ['dark', 'Dark', Moon]] as const).map(([k, label, Icon]) => <button key={k} type="button" role="radio" aria-checked={theme === k} className={theme === k ? 'is-on' : ''} onClick={() => { if (theme !== k) toggleTheme(); }}><Icon className="w-4 h-4" aria-hidden="true" /> {label}</button>)}
    </div>
    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Saved on this device.</p>
  </div>;

  if (view === 'notifications') return <div className="nl-acc-pane">
    <Back title="Notification settings" />
    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Choose which notifications you see. Account and security messages are always shown.</p>
    <div className="nl-acc-shelf">{NOTIF_CATEGORIES.map((c) => <label key={c.key} className="nl-acc-row nl-acc-toggle">
      <span className="nl-acc-name"><span className="block">{c.label}</span><small className="block text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>{c.hint}</small></span>
      <input type="checkbox" role="switch" className="nl-switch" checked={userPrefs.notifOn(c.key)} onChange={(e) => void userPrefs.setNotif(c.key, e.target.checked)} aria-label={c.label} />
    </label>)}</div>
    {userPrefs.error && <p className="text-sm" style={{ color: '#dc2626' }}>{userPrefs.error}</p>}
  </div>;

  if (view === 'content') return <div className="nl-acc-pane">
    <Back title="Content preferences" />
    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Pick the traits you are comfortable dealing with in the books you read. Only you can see your choices.</p>
    {traits === null ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p> : traits.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No traits are available yet. Check back soon.</p> :
      <div className="nl-acc-chips">{traits.map((t) => { const on = userPrefs.prefs.content.includes(t.id); return <button key={t.id} type="button" aria-pressed={on} className={on ? 'is-on' : ''} onClick={() => void userPrefs.setContent(on ? userPrefs.prefs.content.filter((x) => x !== t.id) : [...userPrefs.prefs.content, t.id])}>{t.label}</button>; })}</div>}
    {userPrefs.error && <p className="text-sm" style={{ color: '#dc2626' }}>{userPrefs.error}</p>}
  </div>;

  if (view === 'cookies') return <div className="nl-acc-pane">
    <Back title="Cookie settings" />
    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Current choice: <strong>{consent === 'all' ? 'All cookies accepted' : consent === 'essential' ? 'Essential cookies only' : 'Not chosen yet'}</strong></p>
    <button type="button" className="btn-primary" onClick={() => window.dispatchEvent(new Event('nl-open-cookie-settings'))}><Cookie className="w-4 h-4" /> Change cookie choice</button>
    <button type="button" className="btn-ghost text-sm" onClick={() => navigate('/cookies')}>Read the Cookie Policy</button>
  </div>;

  if (view === 'password') return <div className="nl-acc-pane">
    <Back title={hasPassword ? 'Change password' : 'Set a password'} />
    <form onSubmit={changePassword} className="space-y-3">
      {!hasPassword && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>You signed in with Google, so this account has no password yet. Add one if you also want to sign in with your email. Google sign-in keeps working either way.</p>}
      {hasPassword && <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} auto="current-password" />}
      <PasswordField label="New password" value={newPassword} onChange={setNewPassword} auto="new-password" />
      <PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} auto="new-password" />
      {passwordMessage && <p className="text-sm" style={{ color: /successfully|sent/i.test(passwordMessage) ? 'var(--color-teal-dark)' : '#ef4444' }}>{passwordMessage}</p>}
      <button disabled={passwordSaving} className="btn-primary">{passwordSaving ? 'Saving…' : <><KeyRound className="w-4 h-4" /> {hasPassword ? 'Change password' : 'Set password'}</>}</button>
      <div className="pt-3 nl-acc-sep-top">
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{hasPassword ? 'Forgot your current password?' : 'Prefer an email link?'} We can email a secure reset link to {user.email}.</p>
        <button type="button" onClick={() => void sendResetLink()} disabled={resetSending} className="btn-ghost text-sm"><Mail className="w-4 h-4" /> {resetSending ? 'Sending…' : 'Email me a reset link'}</button>
      </div>
    </form>
  </div>;

  if (view === 'grievances') return <div className="nl-acc-pane">
    <Back title="Grievances" />
    <div className="space-y-3">
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Send a grievance to the Novelty Library team. You get a reference number and can track its status here.</p>
      <div><label className="label">Category</label><select value={grievanceCategory} onChange={(e) => setGrievanceCategory(e.target.value)} className="input-field"><option>Account or profile issue</option><option>Review or submission issue</option><option>Moderation decision</option><option>Report / blacklist concern</option><option>Privacy concern</option><option>Technical problem</option><option>Other</option></select></div>
      <div><label className="label">Subject</label><input value={grievanceSubject} onChange={(e) => setGrievanceSubject(e.target.value)} className="input-field" maxLength={160} placeholder="Briefly describe the issue" /></div>
      <div><label className="label">Details</label><textarea value={grievanceDetails} onChange={(e) => setGrievanceDetails(e.target.value)} className="input-field min-h-32 resize-y" maxLength={5000} placeholder="Explain what happened, what you need reviewed, and any relevant context." /></div>
      {grievanceMessage && <p className="text-sm" style={{ color: /submitted|GRV-/i.test(grievanceMessage) ? 'var(--color-teal-dark)' : '#dc2626' }}>{grievanceMessage}</p>}
      <button type="button" disabled={grievanceSaving} onClick={() => void submitGrievance()} className="btn-primary">{grievanceSaving ? 'Submitting…' : 'Submit grievance'}</button>
      {grievances.length > 0 && <div className="pt-3 nl-acc-sep-top space-y-2"><p className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-text-muted)' }}>Your grievance records</p>{grievances.map((g) => <div key={g.id} className="rounded-xl p-3" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{g.reference_no} · {g.subject}</strong><span className="text-[11px] px-2 py-1 rounded-full" style={{ background: 'rgba(8,145,178,.10)', color: 'var(--color-teal-dark)' }}>{g.status}</span></div><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{g.category} · {new Date(g.created_at).toLocaleString()}</p></div>)}</div>}
    </div>
  </div>;

  if (view === 'delete') return <div className="nl-acc-pane">
    <Back title="Delete account" />
    <form onSubmit={deleteAccount} className="space-y-3 rounded-2xl p-4" style={{ background: 'rgba(239,68,68,.045)', border: '1px solid rgba(239,68,68,.2)' }}>
      <div className="flex items-start gap-3"><div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,.1)', color: '#dc2626' }}><AlertTriangle className="w-5 h-5" /></div><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>This permanently removes your authentication account and associated profile data. This action cannot be undone.</p></div>
      {hasPassword ? <PasswordField label="Confirm with your current password" value={deletePassword} onChange={setDeletePassword} auto="current-password" /> : <>
        <div><label className="label">Type your account email to confirm</label><input type="email" required value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} className="input-field" autoComplete="off" placeholder={user.email || ''} /></div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{recentSignIn ? 'Your Google sign-in is recent, so you can continue.' : 'Your Google sign-in is older than 10 minutes. Re-verify with Google before deleting.'}</p>
        {!recentSignIn && <GoogleSignInButton fallbackLabel="Re-verify with Google" onStart={() => { try { sessionStorage.setItem('nl_return_to', '/account'); sessionStorage.setItem(VIEW_KEY, 'delete'); } catch { /* ignore */ } }} onError={(message) => setDeleteError(message)} />}
      </>}
      <div><label className="label">Type DELETE to confirm</label><input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="input-field" autoComplete="off" /></div>
      {deleteError && <p className="text-sm" style={{ color: '#dc2626' }}>{deleteError}</p>}
      <button disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: '#dc2626', color: 'white', opacity: deleting ? .6 : 1 }}><Trash2 className="w-4 h-4" /> {deleting ? 'Deleting account…' : 'Delete my account'}</button>
    </form>
  </div>;

  return <div className="nl-acc-root">
    <p className="nl-acc-who">Signed in as <strong>{user.email}</strong>{usesGoogle ? ' · via Google' : ''}</p>
    <Shelf label="Account">
      <Row icon={<AtSign />} label="Username" value={profile?.novelty_username ? `@${profile.novelty_username}` : undefined} onClick={() => setView('username')} />
      <Row icon={<Bookmark />} label="My Reviews List" value="Saved" onClick={() => navigate('/saved')} />
      <Row icon={<Archive />} label="Archives" onClick={() => setArchivesOpen(true)} />
      <Row icon={theme === 'dark' ? <Moon /> : <Sun />} label="Appearance" value={theme === 'dark' ? 'Dark' : 'Light'} onClick={() => setView('appearance')} />
    </Shelf>
    <Shelf label="Settings">
      <Row icon={<Bell />} label="Notification settings" onClick={() => setView('notifications')} />
      <Row icon={<SlidersHorizontal />} label="Content preferences" value={userPrefs.prefs.content.length ? String(userPrefs.prefs.content.length) : undefined} onClick={() => setView('content')} />
      <Row icon={<Cookie />} label="Cookie settings" onClick={() => setView('cookies')} />
    </Shelf>
    <Shelf label="Documentation">
      <Row icon={<FileText />} label="Terms" onClick={() => navigate('/terms')} />
      <Row icon={<ShieldCheck />} label="Privacy" onClick={() => navigate('/privacy')} />
      <Row icon={<Cookie />} label="Cookie policy" onClick={() => navigate('/cookies')} />
    </Shelf>
    <Shelf label="Security">
      <Row icon={<KeyRound />} label="Change password" onClick={() => setView('password')} />
      <Row icon={<MessageSquareWarning />} label="Grievances" value={grievances.length ? String(grievances.length) : undefined} onClick={() => setView('grievances')} />
      <Row icon={<LogOut />} label={signingOut ? 'Signing out…' : 'Sign out'} danger busy={signingOut} onClick={() => void logOut()} />
      <Row icon={<Trash2 />} label="Delete account" danger onClick={() => setView('delete')} />
    </Shelf>
    {archivesOpen && <ArchivesModal userId={user.id} navigate={navigate} onClose={() => setArchivesOpen(false)} />}
  </div>;
}

function PasswordField({ label, value, onChange, auto }: { label: string; value: string; onChange: (v: string) => void; auto: string }) {
  return <div><label className="label">{label}</label><div className="relative"><Lock className="field-icon" /><input type="password" required value={value} onChange={(e) => onChange(e.target.value)} className="input-field pl-10" autoComplete={auto} /></div></div>;
}
