import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import type { Review } from '@/types/review';
import { fetchReviews } from '@/lib/reviews';
import { HomeAnalytics } from '@/components/HomeAnalytics';
import { fetchHomeAnalytics, type HomeAnalytics as AnalyticsData } from '@/lib/homeAnalytics';

export function AnalyticsPage({ navigate }: { navigate: (path: string) => void }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchHomeAnalytics().then((d) => { if (alive) setAnalytics(d); }).catch(() => { if (alive) setFailed(true); }),
      fetchReviews().then((d) => { if (alive) setReviews(d); }).catch(() => { if (alive) setReviews([]); }),
    ]);
    return () => { alive = false; };
  }, []);

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-sm mb-7" style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] font-semibold" style={{ color: 'var(--color-teal-dark)' }}>
            <BarChart3 className="w-4 h-4" /> Library analytics
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold mt-2" style={{ color: 'var(--color-text)' }}>Analytics</h1>
          <p className="text-sm mt-2 max-w-2xl" style={{ color: 'var(--color-text-muted)' }}>
            The complete Novelty Library analytics view, moved off the home surface so the homepage stays clean.
          </p>
        </div>
        <HomeAnalytics navigate={navigate} published={reviews} data={analytics} failed={failed} />
      </div>
    </div>
  );
}
