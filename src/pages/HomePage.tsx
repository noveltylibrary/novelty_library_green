import { useEffect, useState } from 'react';
import { fetchHomeAnalytics, type HomeAnalytics } from '@/lib/homeAnalytics';
import { HeroSection } from '@/components/HeroSection';
import { AdsterraAdSlot } from '@/components/AdsterraAdSlot';

interface HomePageProps { navigate: (path: string) => void; }

export function HomePage({ navigate }: HomePageProps) {
  const [analytics, setAnalytics] = useState<HomeAnalytics | null>(null);
  useEffect(() => { let alive = true; fetchHomeAnalytics().then((data) => alive && setAnalytics(data)).catch(() => undefined); return () => { alive = false; }; }, []);
  return (
    <div className="pb-20 animate-fade-in">
      <HeroSection navigate={navigate} live={analytics ? { accepted_total: analytics.accepted_total, authors: analytics.authors, avg_form_rating: analytics.avg_form_rating } : null} />
      <div className="container-prose pt-14">
        <AdsterraAdSlot className="my-10 mx-auto" />
      </div>
    </div>
  );
}
