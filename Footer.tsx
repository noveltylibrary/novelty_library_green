import { BookOpen, Instagram, Mail } from 'lucide-react';
import { useSupportEmail } from '@/lib/siteSettings';

interface FooterProps {
  navigate: (path: string) => void;
}

export function Footer({ navigate }: FooterProps) {
  const supportEmail = useSupportEmail();
  return (
    <footer className="mt-24" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="container-prose py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl gradient-teal flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <span className="font-serif text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                Novelty Library
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
              What book broke your brain this month? We review the books that mess with your head — in two minutes or less.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Explore
            </h4>
            <div className="flex flex-col gap-2.5">
              <button onClick={() => navigate('/')} className="text-sm transition-colors text-left" style={{ color: 'var(--color-text)' }}>Home</button>
              <button onClick={() => navigate('/reviews')} className="text-sm transition-colors text-left" style={{ color: 'var(--color-text)' }}>Reviews</button>
              <button onClick={() => navigate('/submit')} className="text-sm transition-colors text-left" style={{ color: 'var(--color-text)' }}>Submit a Review</button>
              <button onClick={() => navigate('/about')} className="text-sm transition-colors text-left" style={{ color: 'var(--color-text)' }}>About Us</button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Connect
            </h4>
            <div className="flex flex-col gap-2.5">
              <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 text-sm transition-colors" style={{ color: 'var(--color-text)' }}>
                <Mail className="w-4 h-4" /> {supportEmail}
              </a>
              <a href="https://instagram.com/novelty.lib" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm transition-colors" style={{ color: 'var(--color-text)' }}>
                <Instagram className="w-4 h-4" /> Reviews
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            © {new Date().getFullYear()} Novelty Library. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Reviews are opinions of individual reviewers, not cumulative assessments.
          </p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <button type="button" onClick={() => navigate('/privacy')} className="transition-colors hover:underline underline-offset-2">
            Privacy Policy
          </button>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={() => navigate('/terms')} className="transition-colors hover:underline underline-offset-2">
            Terms of Service
          </button>
        </div>
      </div>
    </footer>
  );
}
