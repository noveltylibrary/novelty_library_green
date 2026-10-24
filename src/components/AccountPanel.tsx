import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { soundFx, SOUND_CATEGORIES } from '@/lib/soundFx';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { AlertTriangle, ArrowLeft, Archive, AtSign, Bell, Bookmark, ChevronRight, Compass, Cookie, EyeOff, FileText, Fingerprint, KeyRound, LogOut, Lock, Mail, HelpCircle, MessageSquareWarning, Phone, Sparkles, Volume2, X, Moon, Save, ShieldCheck, SlidersHorizontal, Sun, Trash2 } from 'lucide-react';
import { ArchivesModal } from '@/components/ArchivesModal';
import { useAuth } from '@/lib/auth';
import { updateProfile } from '@/lib/reviews';
import { deleteCurrentAccount } from '@/lib/account';
import { supabase } from '@/lib/supabase';
import { getCaptchaToken } from '@/lib/captcha';
import { createGrievance, fetchMyGrievances, type GrievanceRecord } from '@/lib/moderation';
import { useTheme } from '@/lib/theme';
import { useCookieConsent } from '@/lib/cookieConsent';
import { fetchMyLoginDevices, removeMyLoginDevice, describeDevice, type LoginDevice } from '@/lib/loginDevices';
import { NOTIF_GROUPS, MAX_MUTED, TASTE_MATCH_NOTE, fetchContentTraits, useUserPrefs, type ContentTrait, type TasteMatchKey } from '@/lib/userPrefs';

export type AccountView = 'root' | 'account' | 'sounds' | 'appearance' | 'notifications' | 'content' | 'interests' | 'muted' | 'tastematch' | 'cookies' | 'password' | 'devices' | 'grievances' | 'delete';
type View = AccountView;
const VIEWS: View[] = ['root', 'account', 'sounds', 'appearance', 'notifications', 'content', 'interests', 'muted', 'tastematch', 'cookies', 'password', 'devices', 'grievances', 'delete'];
/** Turns the address (/account/<tab>) into a known tab; anything else is the list. */
export const asAccountView = (v?: string | null): View => (v === 'username' ? 'account' : VIEWS.includes(v as View) ? (v as View) : 'root');

/** Tabs that live inside Content preferences: their Back link returns there, and the list highlights Content preferences. */
const CONTENT_CHILDREN: View[] = ['interests', 'muted', 'tastematch'];

/** True on PC-sized screens, where the settings list and the open tab sit side by side. */
function useWideScreen(): boolean {
  const query = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

/** A glassy shelf of rows. Rows are split by a hairline that fades out towards both edges. */
function Shelf({ label, children }: { label: string; children: ReactNode }) {
  return <section className="nl-acc-section" aria-label={label}><h3 className="nl-acc-label">{label}</h3><div className="nl-acc-shelf">{children}</div></section>;
}
function Row({ icon, label, value, danger, onClick, busy, active }: { icon: ReactNode; label: string; value?: string; danger?: boolean; onClick: () => void; busy?: boolean; active?: boolean }) {
  return <button type="button" className={`nl-acc-row ${danger ? 'is-danger' : ''} ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick} disabled={busy}>
    <span className="nl-acc-ico" aria-hidden="true">{icon}</span>
    <span className="nl-acc-name">{label}</span>
    {value && <span className="nl-acc-val">{value}</span>}
    <ChevronRight className="nl-acc-arrow" aria-hidden="true" />
  </button>;
}

/**
 * Accounts & Settings, shown on its own page (/account). On a phone the page lists the sections and tapping a row
 * opens that tab (/account/<tab>) with a Back link; on a PC the list stays on the left and the open tab on the right.
 */
export function AccountPanel({ navigate, view: viewProp, onView }: { navigate: (path: string) => void; view?: string; onView: (v: View) => void }) {
  const { user, profile, refreshProfile, signOut, resetPassword } = useAuth();
  const identities = user?.identities ?? [];
  const providers: string[] = identities.length ? identities.map((i) => i.provider) : ((user?.app_metadata?.providers as string[] | undefined) ?? []);
  const usesGoogle = providers.includes('google');
  const wide = useWideScreen();
  const current = asAccountView(viewProp);
  // On a PC the right-hand side is never empty: the list opens on Account until another tab is chosen.
  const view: View = current === 'root' && wide ? 'account' : current;
  const setView = (v: View) => onView(v);
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
  const savedPhone = typeof user?.user_metadata?.nl_phone === 'string' ? (user?.user_metadata?.nl_phone as string) : '';
  const [phone, setPhone] = useState(savedPhone);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [mutedDraft, setMutedDraft] = useState('');
  const [tmInfoOpen, setTmInfoOpen] = useState(false);
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
  const [archivesTab, setArchivesTab] = useState<'stories' | 'saved'>('stories');
  const { theme, toggleTheme } = useTheme();
  const consent = useCookieConsent();
  const userPrefs = useUserPrefs();
  const [devices, setDevices] = useState<LoginDevice[] | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  useEffect(() => { if (view === 'devices' && devices === null) void fetchMyLoginDevices().then(setDevices).catch(() => { setDevices([]); setDevicesError('Device history is not available yet.'); }); }, [view, devices]);
  const thisDevice = describeDevice().label;
  const [traits, setTraits] = useState<ContentTrait[] | null>(null);
  useEffect(() => { if ((view === 'interests') && traits === null) void fetchContentTraits().then(setTraits); }, [view, traits]);

  useEffect(() => { setPhone(savedPhone); }, [savedPhone]);
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

  const savePhone = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = phone.trim();
    const digits = clean.replace(/\D/g, '');
    if (clean && (!/^\+?[\d\s().-]+$/.test(clean) || digits.length < 7 || digits.length > 15)) { setPhoneMessage('Enter a valid phone number (7–15 digits, optional + country code), or leave it empty.'); return; }
    setUsernameSaving(true); setPhoneMessage(null);
    const { error } = await supabase.auth.updateUser({ data: { nl_phone: clean || null } });
    setUsernameSaving(false);
    setPhoneMessage(error ? error.message : clean ? 'Phone number saved.' : 'Phone number removed.');
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

  const inContent = CONTENT_CHILDREN.includes(view);
  const Back = ({ title }: { title: string }) => <div className={`nl-acc-back${inContent ? ' is-child' : ''}`}><button type="button" onClick={() => setView(inContent ? 'content' : 'root')}><ArrowLeft className="w-4 h-4" aria-hidden="true" /> {inContent ? 'Content preferences' : 'Accounts & Settings'}</button><h3>{title}</h3></div>;

  const renderPane = (): ReactNode => {
  if (view === 'account') return <div className="nl-acc-pane">
    <Back title="Account" />
    <div className="nl-acc-whyrow">
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Your sign-in details and how readers find you.</p>
      <div className="nl-acc-why">
        <button type="button" className="nl-acc-why-btn" aria-label="Why we keep these details" aria-expanded={whyOpen} onClick={() => setWhyOpen((o) => !o)}><HelpCircle className="w-5 h-5" aria-hidden="true" /></button>
        {whyOpen && <div className="nl-acc-why-pop" role="dialog" aria-label="About your account details">
          <button type="button" className="nl-acc-why-x" aria-label="Close" onClick={() => setWhyOpen(false)}><X className="w-4 h-4" aria-hidden="true" /></button>
          <strong>Why we ask for these</strong>
          <p>Your email and phone number are <b>never shown on your profile or shared</b> with other readers, advertisers or third parties.</p>
          <p>They are stored only to confirm your account is genuine, to protect it from misuse, and to help you recover access. The same promise is written into our <button type="button" className="nl-acc-link" onClick={() => navigate('/privacy')}>Privacy Policy</button> and <button type="button" className="nl-acc-link" onClick={() => navigate('/terms')}>Terms</button>.</p>
        </div>}
      </div>
    </div>
    <form onSubmit={saveUsername} className="space-y-2">
      <label className="label" htmlFor="nl-acc-username">Username</label>
      <div className="flex gap-2"><div className="flex-1 relative min-w-0"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold" style={{ color: 'var(--color-cyan-dark)' }}>@</span><input id="nl-acc-username" value={username} onChange={(e) => setUsername(e.target.value)} className="input-field pl-8" maxLength={30} /></div><button disabled={usernameSaving} className="btn-primary !w-auto"><Save className="w-4 h-4" /> Save</button></div>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>New accounts get one automatically from their email. You can change it if the new one is available.</p>
      {usernameMessage && <p className="text-sm" style={{ color: /saved/i.test(usernameMessage) ? 'var(--color-teal-dark)' : '#ef4444' }}>{usernameMessage}</p>}
    </form>
    <div className="space-y-2">
      <label className="label" htmlFor="nl-acc-email">Email</label>
      <div className="relative"><Mail className="field-icon" aria-hidden="true" /><input id="nl-acc-email" type="email" value={user.email || ''} readOnly disabled className="input-field pl-10 nl-acc-locked" aria-describedby="nl-acc-email-note" /><Lock className="nl-acc-lock" aria-hidden="true" /></div>
      <p id="nl-acc-email-note" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{usesGoogle ? 'Filled in from your Google account.' : 'Filled in from the email you signed up with.'} It is locked and can't be edited here.</p>
    </div>
    <form onSubmit={savePhone} className="space-y-2">
      <label className="label" htmlFor="nl-acc-phone">Phone number <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>(optional)</span></label>
      <div className="flex gap-2"><div className="flex-1 relative min-w-0"><Phone className="field-icon" aria-hidden="true" /><input id="nl-acc-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field pl-10" maxLength={20} placeholder="+91 98765 43210" /></div><button disabled={usernameSaving || phone.trim() === savedPhone} className="btn-primary !w-auto"><Save className="w-4 h-4" /> Save</button></div>
      {phoneMessage && <p className="text-sm" style={{ color: /saved|removed/i.test(phoneMessage) ? 'var(--color-teal-dark)' : '#ef4444' }}>{phoneMessage}</p>}
    </form>
  </div>;

  if (view === 'sounds') return <SoundsPane Back={Back} />;

  if (view === 'appearance') return <div className="nl-acc-pane">
    <Back title="Appearance" />
    <div className="nl-acc-seg" role="radiogroup" aria-label="Colour mode">
      {([['light', 'Light', Sun], ['dark', 'Dark', Moon]] as const).map(([k, label, Icon]) => <button key={k} type="button" role="radio" aria-checked={theme === k} className={theme === k ? 'is-on' : ''} onClick={() => { if (theme !== k) toggleTheme(); }}><Icon className="w-4 h-4" aria-hidden="true" /> {label}</button>)}
    </div>
    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Saved on this device.</p>
  </div>;

  if (view === 'notifications') return <div className="nl-acc-pane">
    <Back title="Notifications" />
    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Choose which notifications you see. Account and security messages, including new-device sign-in alerts, are always shown. Saved to your account, so they apply on every device.</p>
    {NOTIF_GROUPS.map((g) => <section key={g.title} className="nl-acc-section" aria-label={g.title}>
      <h3 className="nl-acc-label">{g.title}</h3>
      <div className="nl-acc-shelf">{g.items.map((c) => <label key={c.key} className="nl-acc-row nl-acc-toggle">
        <span className="nl-acc-name"><span className="block">{c.label}</span><small className="block text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>{c.hint}</small></span>
        <input type="checkbox" role="switch" className="nl-switch" checked={userPrefs.notifOn(c.key)} onChange={(e) => void userPrefs.setNotif(c.key, e.target.checked)} aria-label={`${g.title}: ${c.label}`} />
      </label>)}</div>
    </section>)}
    {userPrefs.error && <p className="text-sm" style={{ color: '#dc2626' }}>{userPrefs.error}</p>}
  </div>;

  if (view === 'devices') return <div className="nl-acc-pane">
    <Back title="Login devices" />
    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Browsers and devices that have signed in to your account. You get a notification the first time a new device or a new country signs in. Remove any you don&apos;t recognise, then change your password.</p>
    {devices === null ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p> : devices.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{devicesError || 'No devices recorded yet. They appear after your next sign-in.'}</p> :
      <div className="nl-acc-shelf">{devices.map((d) => <div key={d.id} className="nl-acc-row" style={{ cursor: 'default' }}>
        <span className="nl-acc-name"><span className="block">{d.label || 'Unknown device'}{d.label === thisDevice ? ' · this device' : ''}</span><small className="block text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>{d.country ? `${d.country} · ` : ''}Last active {new Date(d.last_seen).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · first seen {new Date(d.first_seen).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</small></span>
        <button type="button" className="text-xs font-semibold" style={{ color: '#dc2626' }} onClick={() => void removeMyLoginDevice(d.id).then(() => setDevices((cur) => (cur || []).filter((x) => x.id !== d.id))).catch(() => setDevicesError('Could not remove that device.'))}>Remove</button>
      </div>)}</div>}
    {devicesError && devices && devices.length > 0 && <p className="text-sm" style={{ color: '#dc2626' }}>{devicesError}</p>}
  </div>;

  if (view === 'content') return <div className="nl-acc-pane">
    <Back title="Content preferences" />
    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Shape what you see and what Taste Match SE suggests. Only you can see your choices.</p>
    <div className="nl-acc-shelf">
      <Row icon={<Compass />} label="Manage interests" value={userPrefs.prefs.content.length ? String(userPrefs.prefs.content.length) : undefined} onClick={() => setView('interests')} />
      <Row icon={<EyeOff />} label="Muted words" value={userPrefs.prefs.muted.length ? String(userPrefs.prefs.muted.length) : undefined} onClick={() => setView('muted')} />
      <Row icon={<Sparkles />} label="Taste Match" onClick={() => setView('tastematch')} />
    </div>
  </div>;

  if (view === 'interests') return <div className="nl-acc-pane">
    <Back title="Manage interests" />
    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Pick the traits you are comfortable dealing with in the books you read. Only you can see your choices.</p>
    {traits === null ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</p> : traits.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No traits are available yet. Check back soon.</p> :
      <div className="nl-acc-chips">{traits.map((t) => { const on = userPrefs.prefs.content.includes(t.id); return <button key={t.id} type="button" aria-pressed={on} className={on ? 'is-on' : ''} onClick={() => void userPrefs.setContent(on ? userPrefs.prefs.content.filter((x) => x !== t.id) : [...userPrefs.prefs.content, t.id])}>{t.label}</button>; })}</div>}
    {userPrefs.error && <p className="text-sm" style={{ color: '#dc2626' }}>{userPrefs.error}</p>}
  </div>;

  if (view === 'muted') {
    const words = userPrefs.prefs.muted;
    const draft = mutedDraft.trim().replace(/\s+/g, ' ');
    const dupe = words.some((w) => w.toLowerCase() === draft.toLowerCase());
    const addMuted = (e: React.FormEvent) => { e.preventDefault(); if (!draft || dupe || words.length >= MAX_MUTED) return; void userPrefs.setMuted([...words, draft]); setMutedDraft(''); };
    return <div className="nl-acc-pane">
      <Back title="Muted words" />
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Hide reviews that have specific words or phrases. They are left out of the reviews list, Taste Match SE picks, and &ldquo;More like this&rdquo;. Matching ignores capitals and accents and looks for whole words.</p>
      <form onSubmit={addMuted} className="nl-acc-mutebox">
        <input value={mutedDraft} onChange={(e) => setMutedDraft(e.target.value)} className="input-field" maxLength={60} placeholder="Add words or phrases to mute" aria-label="Add words or phrases to mute" />
        <button className="btn-primary" disabled={!draft || dupe || words.length >= MAX_MUTED}>Add</button>
        {dupe && <p className="text-xs" style={{ color: '#dc2626' }}>That one is already muted.</p>}
        {words.length >= MAX_MUTED && <p className="text-xs" style={{ color: '#dc2626' }}>You can mute up to {MAX_MUTED} words or phrases.</p>}
      </form>
      <section className="nl-acc-section" aria-label="Hidden words and phrases">
        <h3 className="nl-acc-label">Hidden words and phrases</h3>
        {words.length === 0
          ? <div className="nl-acc-empty"><EyeOff className="w-6 h-6" aria-hidden="true" /><strong>No hidden words or phrases</strong></div>
          : <div className="nl-acc-shelf">{words.map((w) => <div key={w} className="nl-acc-row" style={{ cursor: 'default' }}>
              <span className="nl-acc-name">{w}</span>
              <button type="button" className="text-xs font-semibold" style={{ color: '#dc2626' }} aria-label={`Unmute ${w}`} onClick={() => void userPrefs.setMuted(words.filter((x) => x !== w))}>Remove</button>
            </div>)}</div>}
      </section>
      {userPrefs.error && <p className="text-sm" style={{ color: '#dc2626' }}>{userPrefs.error}</p>}
    </div>;
  }

  if (view === 'tastematch') {
    const tm = userPrefs.prefs.tm;
    const flip = (k: TasteMatchKey) => void userPrefs.setTasteMatch(k, !tm[k]);
    const sw = (k: TasteMatchKey, label: string, hint?: string) => <label key={k} className="nl-acc-row nl-acc-toggle">
      <span className="nl-acc-name"><span className="block">{label}</span>{hint && <small className="block text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>{hint}</small>}</span>
      <input type="checkbox" role="switch" className="nl-switch" checked={tm[k]} onChange={() => flip(k)} aria-label={label} />
    </label>;
    const profileOn = tm.profilePersonal || tm.profileReading;
    return <div className="nl-acc-pane">
      <Back title="Taste Match controls" />
      <div className="nl-acc-whyrow">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Choose what Taste Match SE may use to find your matches. Everything starts on, and your choices apply to your account only.</p>
        <div className="nl-acc-why">
          <button type="button" className="nl-acc-why-btn" aria-label="Why Taste Match uses this information" aria-expanded={tmInfoOpen} onClick={() => setTmInfoOpen((o) => !o)}><HelpCircle className="w-5 h-5" aria-hidden="true" /></button>
          {tmInfoOpen && <div className="nl-acc-why-pop" role="dialog" aria-label="About Taste Match information">
            <button type="button" className="nl-acc-why-x" aria-label="Close" onClick={() => setTmInfoOpen(false)}><X className="w-4 h-4" aria-hidden="true" /></button>
            <strong>Why we take this</strong>
            <p>{TASTE_MATCH_NOTE}</p>
            <p>Read more in our <button type="button" className="nl-acc-link" onClick={() => navigate('/privacy')}>Privacy Policy</button> and <button type="button" className="nl-acc-link" onClick={() => navigate('/terms')}>Terms</button>.</p>
          </div>}
        </div>
      </div>
      <section className="nl-acc-section" aria-label="Profile answers">
        <h3 className="nl-acc-label">Profile answers{profileOn ? '' : ' · off'}</h3>
        <div className="nl-acc-shelf">
          {sw('profilePersonal', 'Personal', 'Your answers in personal sections of your profile')}
          {sw('profileReading', 'Reading', 'Favourite book, author and genre, and your reading answers')}
        </div>
      </section>
      <section className="nl-acc-section" aria-label="Activity and devices">
        <h3 className="nl-acc-label">Everything else</h3>
        <div className="nl-acc-shelf">
          {sw('reviews', 'Reviews submitted', 'Reviews you wrote and reviews you saved')}
          {sw('interests', 'Interests managed', 'The traits you picked under Manage interests')}
          {sw('device', 'Device info', 'Touch or mouse, and the time of day')}
          {sw('browser', 'Browser info', 'Browser language and how past puzzles went in this browser')}
        </div>
      </section>
      {userPrefs.error && <p className="text-sm" style={{ color: '#dc2626' }}>{userPrefs.error}</p>}
    </div>;
  }

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
        {!recentSignIn && <GoogleSignInButton fallbackLabel="Re-verify with Google" onStart={() => { try { sessionStorage.setItem('nl_return_to', '/account/delete'); } catch { /* ignore */ } }} onError={(message) => setDeleteError(message)} />}
      </>}
      <div><label className="label">Type DELETE to confirm</label><input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="input-field" autoComplete="off" /></div>
      {deleteError && <p className="text-sm" style={{ color: '#dc2626' }}>{deleteError}</p>}
      <button disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: '#dc2626', color: 'white', opacity: deleting ? .6 : 1 }}><Trash2 className="w-4 h-4" /> {deleting ? 'Deleting account…' : 'Delete my account'}</button>
    </form>
  </div>;

  return null;
  };

  const nav = <div className="nl-acc-root">
    <p className="nl-acc-who">Signed in as <strong>{user.email}</strong>{usesGoogle ? ' · via Google' : ''}</p>
    <Shelf label="You">
      <Row icon={<AtSign />} label="Account" value={profile?.novelty_username ? `@${profile.novelty_username}` : undefined} active={view === 'account'} onClick={() => setView('account')} />
      <Row icon={<Bookmark />} label="My Reviews" value="Saved" onClick={() => { setArchivesTab('saved'); setArchivesOpen(true); }} />
      <Row icon={<Archive />} label="Archives" onClick={() => { setArchivesTab('stories'); setArchivesOpen(true); }} />
      <Row icon={theme === 'dark' ? <Moon /> : <Sun />} label="Appearance" value={theme === 'dark' ? 'Dark' : 'Light'} active={view === 'appearance'} onClick={() => setView('appearance')} />
    </Shelf>
    <Shelf label="Settings">
      <Row icon={<Volume2 />} label="Sound controls" value={soundFx.getPrefs().master ? undefined : 'Off'} active={view === 'sounds'} onClick={() => setView('sounds')} />
      <Row icon={<Bell />} label="Notifications" active={view === 'notifications'} onClick={() => setView('notifications')} />
      <Row icon={<SlidersHorizontal />} label="Content preferences" active={view === 'content' || inContent} onClick={() => setView('content')} />
      <Row icon={<Cookie />} label="Cookie settings" active={view === 'cookies'} onClick={() => setView('cookies')} />
    </Shelf>
    <Shelf label="Documentation">
      <Row icon={<FileText />} label="Terms" onClick={() => navigate('/terms')} />
      <Row icon={<ShieldCheck />} label="Privacy" onClick={() => navigate('/privacy')} />
      <Row icon={<Cookie />} label="Cookie policy" onClick={() => navigate('/cookies')} />
    </Shelf>
    <Shelf label="Security">
      <Row icon={<KeyRound />} label="Change password" active={view === 'password'} onClick={() => setView('password')} />
      <Row icon={<Fingerprint />} label="Login devices" active={view === 'devices'} onClick={() => setView('devices')} />
      <Row icon={<MessageSquareWarning />} label="Grievances" value={grievances.length ? String(grievances.length) : undefined} active={view === 'grievances'} onClick={() => setView('grievances')} />
      <Row icon={<LogOut />} label={signingOut ? 'Signing out…' : 'Sign out'} danger busy={signingOut} onClick={() => void logOut()} />
      <Row icon={<Trash2 />} label="Delete account" danger active={view === 'delete'} onClick={() => setView('delete')} />
    </Shelf>
  </div>;

  const pane = renderPane();
  return <div className={`nl-acc-layout ${pane ? 'is-detail' : 'is-list'}`}>
    <div className="nl-acc-nav">{nav}</div>
    {pane && <div className="nl-acc-detail">{pane}</div>}
    {archivesOpen && <ArchivesModal initialTab={archivesTab} userId={user.id} navigate={navigate} onClose={() => setArchivesOpen(false)} />}
  </div>;
}

function PasswordField({ label, value, onChange, auto }: { label: string; value: string; onChange: (v: string) => void; auto: string }) {
  return <div><label className="label">{label}</label><div className="relative"><Lock className="field-icon" /><input type="password" required value={value} onChange={(e) => onChange(e.target.value)} className="input-field pl-10" autoComplete={auto} /></div></div>;
}

/** Account & settings → Sounds: one master switch, a volume slider and a switch per area. Saved on this device. */
function SoundsPane({ Back }: { Back: (p: { title: string }) => ReactNode }) {
  const prefs = useSyncExternalStore(soundFx.subscribe, soundFx.getPrefs);
  return <div className="nl-acc-pane">
    <Back title="Sound controls" />
    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Choose which sounds Novelty Library makes. Saved on this device.</p>
    <div className="nl-acc-shelf">
      <label className="nl-acc-row nl-acc-toggle"><span className="nl-acc-name"><span className="block">All sounds</span><small className="block text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>Master switch for everything below.</small></span><input type="checkbox" role="switch" className="nl-switch" checked={prefs.master} onChange={(e) => { soundFx.setPrefs({ master: e.target.checked }); if (e.target.checked) soundFx.play('click', 'games', true); }} aria-label="All sounds" /></label>
      {SOUND_CATEGORIES.map((c) => <div key={c.key} className="nl-acc-row nl-acc-toggle" style={{ opacity: prefs.master ? 1 : 0.5 }}>
        <span className="nl-acc-name"><span className="block">{c.label}</span><small className="block text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>{c.hint}</small></span>
        <button type="button" className="nl-snd-test" disabled={!prefs.master || !prefs[c.key]} onClick={() => soundFx.play(c.sample, c.key)} aria-label={`Preview ${c.label} sound`}>Test</button>
        <input type="checkbox" role="switch" className="nl-switch" checked={prefs[c.key]} disabled={!prefs.master} onChange={(e) => { soundFx.setPrefs({ [c.key]: e.target.checked }); if (e.target.checked) soundFx.play(c.sample, c.key); }} aria-label={c.label} />
      </div>)}
    </div>
    <div className="space-y-1">
      <label className="label" htmlFor="nl-snd-vol">Volume · {Math.round(prefs.volume * 100)}%</label>
      <input id="nl-snd-vol" type="range" min={0} max={100} step={5} value={Math.round(prefs.volume * 100)} disabled={!prefs.master} onChange={(e) => soundFx.setPrefs({ volume: Number(e.target.value) / 100 })} onPointerUp={() => soundFx.play('click', 'games')} className="nl-snd-range" />
    </div>
  </div>;
}
