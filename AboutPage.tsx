import { useSupportEmail } from '@/lib/siteSettings';
import { useEditableOverride, EditablePageOverride } from '@/components/EditablePageOverride';
import { useState } from 'react';
import { BookOpen, Users, Heart, Sparkles, PenTool, ArrowRight, ChevronDown, Globe2, ShieldCheck, Languages, Sparkle, Library, Compass, Wand2 } from 'lucide-react';

interface AboutPageProps {
  navigate: (path: string) => void;
}

const faqs = [
  {
    q: 'What does Novelty Library do?',
    a: "Novelty Library is an open-to-all review submission platform built to make reading more visible and more honest. It aims to close the gap between authors and readers without the paywalls and financial friction that come with a lot of other review channels, so every review is delivered with a real standard of transparency. At heart, it's a clean, permanent digital shelf for honest reviewers and indie readers — one that doesn't depend on the churn of social feeds, and that treats every reviewer as part of the project rather than just a contributor.",
  },
  {
    q: 'Why share your review on Novelty Library?',
    a: "Your voice, credited, as it should be. Sharing here means helping hidden gems, debut authors, and regional literature get seen outside the usual popularity algorithms — and every review lives on its own shareable page with your name and handle front and center. Reviews reach a large, active reading community, can be written in whichever language you're most comfortable reviewing in (10+ languages welcome), and the whole catalog stays free of bot-written summaries or paid placements — just real readers, saying what they actually think.",
  },
  {
    q: 'How can you review books on Novelty?',
    a: 'Just fill out the book review form on the Submit page — that\'s the dedicated Novelty Book Reviews form where every submission starts.',
  },
];

export function AboutPage({ navigate }: AboutPageProps) {
  const editable = useEditableOverride('about');
  if (editable) return <EditablePageOverride page={editable} navigate={navigate} />;
  const supportEmail = useSupportEmail();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in nl-about-shell">
      <div className="max-w-4xl mx-auto">
        <div className="nl-about-hero text-center mb-16">
          <div className="nl-about-orbit" aria-hidden="true" />
          <div className="nl-about-floaters" aria-hidden="true">
            <span><Library className="w-4 h-4" /></span><span><Compass className="w-4 h-4" /></span><span><Wand2 className="w-4 h-4" /></span>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6" style={{ background: 'rgba(0, 151, 178, 0.1)' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-teal-dark)' }} />
            <span className="text-xs font-medium tracking-wide" style={{ color: 'var(--color-teal-dark)' }}>Our Story</span>
          </div>
          <h1 className="font-serif text-5xl font-semibold leading-tight tracking-tight mb-6 text-balance" style={{ color: 'var(--color-text)' }}>
            What book broke your brain this month?
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Novelty Library exists so indie readers have a clean, permanent digital shelf that doesn't rely on random social feeds. We were tired of typing "books to read" and "best book recommendations" into Google, so we built a home for honest, community-driven book reviews instead.
          </p>
        </div>

        {/* About Novelty Library — three pillars sourced from the site's About section */}
        <div className="mb-16">
          <h2 className="font-serif text-3xl font-semibold mb-8 text-center" style={{ color: 'var(--color-text)' }}>About Novelty Library</h2>
          <div className="space-y-6">
            <div className="surface-card p-6 flex gap-4 animate-fade-up nl-about-card">
              <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(0, 151, 178, 0.1)' }}>
                <BookOpen className="w-6 h-6" style={{ color: 'var(--color-teal-dark)' }} />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>What mission do we serve?</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  Novelty Library Reviews is built specifically so honest reviewers and indie readers have a clean, permanent digital shelf that doesn't rely on random social feeds. We want to help more authors and reviewers find their voice in a publicity-driven world, and we're glad to give reviewers a hand and a place in Novelty's little hopeful journey.
                </p>
              </div>
            </div>
            <div className="surface-card p-6 flex gap-4 animate-fade-up nl-about-card" style={{ animationDelay: '100ms' }}>
              <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(0, 151, 178, 0.1)' }}>
                <Sparkle className="w-6 h-6" style={{ color: 'var(--color-teal-dark)' }} />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>What's new on the platform?</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  We run things so you feel visible. The Submit Book Reviews form comes with a live form-progress indicator, light/dark-tone matching, a proper preview step before you post, and Quick-Search-and-Fill — type a book's name and the details pull straight from Open Library. Reviewers also get Save-and-Load drafts, a short editing window right after submitting, and an instant downloadable Instagram-story poster — all built to make submitting fast, modern, and genuinely enjoyable.
                </p>
              </div>
            </div>
            <div className="surface-card p-6 flex gap-4 animate-fade-up nl-about-card" style={{ animationDelay: '200ms' }}>
              <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(0, 151, 178, 0.1)' }}>
                <Heart className="w-6 h-6" style={{ color: 'var(--color-teal-dark)' }} />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Tired of the mediocre?</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  If you're tired of typing "books to read" or "best book recommendations" into Google, search no further. Novelty Library brings together book reviews, top recommendations, must-reads, and literary critiques for every kind of reader — fiction, non-fiction, mystery, romance, thrillers, and classics alike. Come for the reviews, stay for the author spotlights and reading guides.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Why share your review — bullets from the site */}
        <div className="mb-16">
          <h2 className="font-serif text-3xl font-semibold mb-2 text-center" style={{ color: 'var(--color-text)' }}>Why Share Your Review?</h2>
          <p className="text-center text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>Your voice, credited, as it should be.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: Sparkles, title: 'Spotlight great books & writers', desc: 'Help hidden gems, debut voices, and regional literature get seen beyond mainstream popularity algorithms.' },
              { icon: Users, title: 'Dedicated reviewer credit', desc: 'Every review carries your name and social handle on its own dedicated, shareable page.' },
              { icon: Globe2, title: 'Reach a growing readership', desc: 'Your thoughts get read across an active, growing reading community with a lot of platform views.' },
              { icon: Languages, title: 'Multi-language welcome', desc: 'Review in your language of choice — celebrating literature across 10+ regional and international languages.' },
              { icon: ShieldCheck, title: '100% authentic & human', desc: 'A trusted catalog where genuine reader voices matter — no bot-generated summaries, no paid spam.' },
            ].map((v) => (
              <div key={v.title} className="surface-card p-5 flex gap-3 nl-about-card">
                <v.icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-teal-dark)' }} />
                <div>
                  <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{v.title}</h4>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works — kept from the original page */}
        <div className="mb-16">
          <h2 className="font-serif text-3xl font-semibold mb-8 text-center" style={{ color: 'var(--color-text)' }}>How It Works</h2>
          <div className="space-y-4">
            {[
              { step: '1', title: 'Read a book', desc: 'Pick up something that catches your eye. Fiction, non-fiction, poetry — anything goes.' },
              { step: '2', title: 'Write your take', desc: 'Submit your review through our form. No essays needed — just your honest, two-minute take.' },
              { step: '3', title: 'Get featured', desc: 'We publish your review to the library and tag you on Instagram. Your take helps other readers discover their next great read.' },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-4 p-5 surface-card nl-about-card">
                <div className="flex-shrink-0 w-8 h-8 rounded-full gradient-teal text-white flex items-center justify-center text-sm font-bold">
                  {s.step}
                </div>
                <div>
                  <h4 className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>{s.title}</h4>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="font-serif text-3xl font-semibold mb-2 text-center" style={{ color: 'var(--color-text)' }}>Frequently Asked Questions</h2>
          <p className="text-center text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
            Can't find your answer here? Reach us at{' '}
            <a href={`mailto:${supportEmail}`} className="font-medium" style={{ color: 'var(--color-cyan-dark)' }}>
              {supportEmail}
            </a>
            .
          </p>
          <div className="space-y-3">
            {faqs.map((item, i) => (
              <div key={item.q} className="surface-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-serif text-base font-semibold" style={{ color: 'var(--color-text)' }}>{item.q}</span>
                  <ChevronDown
                    className="w-4 h-4 flex-shrink-0 transition-transform duration-300"
                    style={{ color: 'var(--color-text-muted)', transform: openFaq === i ? 'rotate(180deg)' : 'none' }}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 -mt-1">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center p-10 rounded-3xl gradient-teal text-white">
          <PenTool className="w-8 h-8 text-white/70 mx-auto mb-4" />
          <h2 className="font-serif text-3xl font-semibold mb-3">Got a book that hit different?</h2>
          <p className="text-white/70 leading-relaxed mb-6 max-w-md mx-auto">
            Drop it here. No spam, just vibes — follow for more two-minute book takes that'll mess with your head.
          </p>
          <button onClick={() => navigate('/submit')} className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm tracking-wide bg-white/15 hover:bg-white/25 transition-all duration-300">
            Submit Your Review <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
