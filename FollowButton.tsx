import { UserCheck, UserPlus } from 'lucide-react';

/** The one Follow button used everywhere (profiles, follower lists, authors). Always blue. */
export function FollowButton({ following, busy = false, onClick, size = 'md', label }: { following: boolean; busy?: boolean; onClick: () => void; size?: 'sm' | 'md'; label?: string }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`nl-follow-btn ${size === 'sm' ? 'is-sm' : ''} ${following ? 'is-following' : ''}`}
      aria-pressed={following}
      aria-label={label ? `${following ? 'Unfollow' : 'Follow'} ${label}` : undefined}
    >
      {following ? <UserCheck aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
      <span>{following ? 'Following' : 'Follow'}</span>
    </button>
  );
}
