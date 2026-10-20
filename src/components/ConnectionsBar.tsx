import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Lock, UserCheck, Users, X } from 'lucide-react';
import { fetchConnections, followUsername, unfollowUsername, type ConnectionProfile } from '@/lib/social';
import { FollowButton } from '@/components/FollowButton';
import { sanitizeUserText, safeExternalUrl } from '@/lib/sanitize';
import { useOverlayHistory } from '@/lib/overlayHistory';

export type ConnKind = 'followers' | 'following';

/** Blue Followers | Following table that sits just above the profile card. */
export function FollowStatsBar({ followers, following, hideFollowers, hideFollowing, isOwn, onOpen }: { followers: number; following: number; hideFollowers: boolean; hideFollowing: boolean; isOwn: boolean; onOpen: (k: ConnKind) => void }) {
  const cell = (kind: ConnKind, count: number, hidden: boolean) => {
    const locked = hidden && !isOwn;
    return (
      <button type="button" className={`nl-conn-cell ${locked ? 'is-locked' : ''}`} disabled={locked} onClick={() => onOpen(kind)} aria-label={`${count} ${kind}${locked ? ' (private)' : ' - view list'}`}>
        <span className="nl-conn-ic">{kind === 'followers' ? <Users aria-hidden="true" /> : <UserCheck aria-hidden="true" />}</span>
        <span className="nl-conn-num">{locked ? <Lock aria-hidden="true" /> : count.toLocaleString()}</span>
        <span className="nl-conn-word">{kind === 'followers' ? 'Followers' : 'Following'}{hidden && isOwn && <em><Lock aria-hidden="true" /> only you</em>}</span>
      </button>
    );
  };
  return <div className="nl-conn-bar" role="group" aria-label="Followers and following">{cell('followers', followers, hideFollowers)}{cell('following', following, hideFollowing)}</div>;
}

type Props = {
  open: ConnKind | null;
  onClose: () => void;
  onKind: (k: ConnKind) => void;
  username: string | null;          // whose lists these are
  counts: { followers: number; following: number };
  hidden: { followers: boolean; following: boolean };
  isOwn: boolean;
  me: { id: string; username: string | null } | null;  // the signed-in viewer
  navigate: (path: string) => void;
  onChanged?: () => void;           // called after a follow/unfollow so counts can refresh
  ownerControls?: (kind: ConnKind) => ReactNode;
};

/** One popup, two columns (Followers | Following), each row with a blue follow / unfollow button. */
export function ConnectionsModal({ open, onClose, onKind, username, counts, hidden, isOwn, me, navigate, onChanged, ownerControls }: Props) {
  const [rows, setRows] = useState<ConnectionProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState<Set<string>>(new Set());   // ids the viewer follows
  const [busyId, setBusyId] = useState<string | null>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useOverlayHistory(open !== null, onClose);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // The viewer's own "following" list tells us which buttons read "Following".
  useEffect(() => {
    if (!open || !me?.username) { setMine(new Set()); return; }
    let alive = true;
    void fetchConnections(me.username, 'following').then((l) => { if (alive) setMine(new Set(l.map((p) => p.id))); }).catch(() => undefined);
    return () => { alive = false; };
  }, [open !== null, me?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !username) { setRows([]); return; }
    if (!isOwn && hidden[open]) { setRows([]); return; }
    let alive = true; setLoading(true); setRows([]);
    void fetchConnections(username, open).then((l) => { if (alive) setRows(l); }).catch(() => { if (alive) setRows([]); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, username, isOwn, hidden.followers, hidden.following]);

  if (!open) return null;

  const toggle = async (p: ConnectionProfile) => {
    if (!p.novelty_username || busyId) return;
    const was = mine.has(p.id);
    setBusyId(p.id);
    try {
      if (was) await unfollowUsername(p.novelty_username); else await followUsername(p.novelty_username);
      setMine((s) => { const n = new Set(s); if (was) n.delete(p.id); else n.add(p.id); return n; });
      onChanged?.();
    } catch { /* leave the button as it was */ } finally { setBusyId(null); }
  };

  const blocked = !isOwn && hidden[open];
  const kinds: ConnKind[] = ['followers', 'following'];
  return createPortal(
    <div className="nl-conn-backdrop" onClick={onClose}>
      <div className="nl-conn-modal" role="dialog" aria-modal="true" aria-label="Followers and following" onClick={(e) => e.stopPropagation()}>
        <div className="nl-conn-top">
          <div className="nl-conn-tabs" role="tablist">
            {kinds.map((k) => {
              const lock = !isOwn && hidden[k];
              return (
                <button key={k} type="button" role="tab" aria-selected={open === k} disabled={lock} className={`nl-conn-tab ${open === k ? 'is-on' : ''}`} onClick={() => onKind(k)}>
                  {k === 'followers' ? <Users aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
                  <b>{lock ? <Lock aria-hidden="true" /> : counts[k].toLocaleString()}</b>
                  <span>{k === 'followers' ? 'Followers' : 'Following'}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="nl-conn-x" onClick={onClose} aria-label="Close"><X aria-hidden="true" /></button>
        </div>
        {isOwn && ownerControls?.(open)}
        <ul className="nl-conn-list">
          {blocked ? <li className="nl-conn-empty"><Lock aria-hidden="true" /> This list is private.</li>
            : loading ? <li className="nl-conn-empty">Loading…</li>
            : rows.length === 0 ? <li className="nl-conn-empty">{open === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</li>
            : rows.map((p) => {
              const avatar = safeExternalUrl(p.avatar_url);
              const name = sanitizeUserText(p.name || 'Novelty Reader', 80);
              const self = !!me && me.id === p.id;
              return (
                <li key={p.id} className="nl-conn-row">
                  <button type="button" className="nl-conn-who" onClick={() => { if (p.novelty_username) { onClose(); navigate(`/profile/@${encodeURIComponent(p.novelty_username)}`); } }}>
                    <span className="nl-conn-av">{avatar ? <img src={avatar} alt="" loading="lazy" /> : name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0"><strong>{name}</strong><small>@{sanitizeUserText(p.novelty_username || 'reader', 60)}</small></span>
                  </button>
                  {me?.username && !self && p.novelty_username && <FollowButton size="sm" following={mine.has(p.id)} busy={busyId === p.id} onClick={() => void toggle(p)} label={name} />}
                </li>
              );
            })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
