import { BookMarked, Feather } from 'lucide-react';

/** Special role tag: Author = purple + gold, Reviewer = teal. Used at the top of author and reviewer pages. */
export function RoleTag({ role, size = 'md' }: { role: 'author' | 'reviewer'; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = role === 'author' ? Feather : BookMarked;
  return (
    <span className={`nl-role-tag is-${role} is-${size}`}>
      <Icon aria-hidden="true" />
      <span>{role === 'author' ? 'Author' : 'Reviewer'}</span>
    </span>
  );
}

/** Full-width band that crowns an author (or reviewer) page. */
export function RoleRibbon({ role, note }: { role: 'author' | 'reviewer'; note?: string }) {
  return (
    <div className={`nl-role-ribbon is-${role}`}>
      <RoleTag role={role} size="lg" />
      {note && <small>{note}</small>}
    </div>
  );
}
