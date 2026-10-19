import { ArrowLeft, BookMarked, Send, CheckCircle2, Globe2, FolderOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AdminReviewsPage } from '@/pages/AdminReviewsPage';
import { AdminMasterListPage } from '@/pages/AdminMasterListPage';
import { AdminPostersPage } from '@/pages/AdminPostersPage';
import { AdminPublishedReviewsPage } from '@/pages/AdminPublishedReviewsPage';
import { AdminCommunityReviewsPage } from '@/pages/AdminCommunityReviewsPage';
import { AdminReservedBookReviewsPage } from '@/pages/AdminReservedBookReviewsPage';

export type BookReviewsTab = 'submitted' | 'accepted' | 'published' | 'reserved' | 'posters' | 'community';

interface AdminBookReviewsPageProps {
  navigate: (path: string) => void;
  tab: BookReviewsTab;
}

// Order here is the order the tabs render in — keep this in sync with the
// requested sequence: Submitted -> Accepted -> Published -> Posters.
const TABS: { key: BookReviewsTab; label: string; icon: typeof Send }[] = [
  { key: 'submitted', label: 'Submitted Reviews List', icon: Send },
  { key: 'accepted', label: 'Accepted Reviews List', icon: CheckCircle2 },
  { key: 'published', label: 'Publishing Queue', icon: Globe2 },
  { key: 'reserved', label: 'Reserved Book Reviews List', icon: BookMarked },
  { key: 'posters', label: 'Posters', icon: FolderOpen },
  { key: 'community', label: 'Community Reviews', icon: Globe2 },
];

export function AdminBookReviewsPage({ navigate, tab }: AdminBookReviewsPageProps) {
  const { user, isAdmin, loading: authLoading } = useAuth();

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
        <BookMarked className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(239, 68, 68, 0.3)' }} />
        <h1 className="font-serif text-2xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Access Denied</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          Your account doesn't have admin access.
        </p>
        <button onClick={() => navigate('/')} className="btn-ghost">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
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
          <BookMarked className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} />
          <h1 className="font-serif text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>Book Reviews</h1>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Everything to do with book reviews — from submission through to publishing and posters — in one place.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(`/admin/book-reviews/${t.key}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              background: tab === t.key ? 'var(--color-teal-dark)' : 'var(--color-surface)',
              color: tab === t.key ? 'white' : 'var(--color-text-muted)',
              border: tab === t.key ? 'none' : '1px solid var(--color-border)',
            }}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'submitted' && <AdminReviewsPage navigate={navigate} embedded />}
      {tab === 'accepted' && <AdminMasterListPage navigate={navigate} embedded />}
      {tab === 'published' && <AdminPublishedReviewsPage navigate={navigate} embedded />}
      {tab === 'reserved' && <AdminReservedBookReviewsPage navigate={navigate} embedded />}
      {tab === 'posters' && <AdminPostersPage navigate={navigate} embedded />}
      {tab === 'community' && <AdminCommunityReviewsPage navigate={navigate} embedded />}
    </div>
  );
}

