import { useState, type ComponentType } from 'react';
import { BookOpen, Users, Heart, Sparkles, PenTool, ArrowRight, ChevronDown, Globe2, ShieldCheck, Languages, Sparkle, Library, Compass, Wand2 } from 'lucide-react';
import type { AboutSection } from '@/lib/aboutSections';

const ICONS: Record<string, ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  book: BookOpen, sparkles: Sparkle, heart: Heart, users: Users, globe: Globe2, languages: Languages, shield: ShieldCheck, library: Library, compass: Compass, wand: Wand2, pen: PenTool,
};

const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
const safeLink = (link: string) => (/^(\/|https?:\/\/)/i.test(link.trim()) ? link.trim() : '');

function Heading({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return <>
    <h2 className={`font-serif text-3xl font-semibold ${subtitle || children ? 'mb-2' : 'mb-8'} text-center`} style={{ color: 'var(--color-text)' }}>{title}</h2>
    {children ?? (subtitle ? <p className="text-center text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p> : null)}
  </>;
}

function Faq({ section, email }: { section: AboutSection; email: string }) {
  const [open, setOpen] = useState<number | null>(0);
  const [before, after] = section.subtitle.split('{{email}}');
  return <div className="mb-16">
    <Heading title={section.title}>
      {section.subtitle && <p className="text-center text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
        {before}{after !== undefined && <><a href={`mailto:${email}`} className="font-medium" style={{ color: 'var(--color-cyan-dark)' }}>{email}</a>{after}</>}
      </p>}
    </Heading>
    <div className="space-y-3">
      {section.items.map((item, i) => <div key={`${item.title}-${i}`} className="surface-card overflow-hidden">
        <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="w-full flex items-center justify-between gap-4 p-5 text-left">
          <span className="font-serif text-base font-semibold" style={{ color: 'var(--color-text)' }}>{item.title}</span>
          <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform duration-300" style={{ color: 'var(--color-text-muted)', transform: open === i ? 'rotate(180deg)' : 'none' }} />
        </button>
        {open === i && <div className="px-5 pb-5 -mt-1"><p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{item.desc}</p></div>}
      </div>)}
    </div>
  </div>;
}

export function AboutSectionBlock({ section, email, navigate }: { section: AboutSection; email: string; navigate: (path: string) => void }) {
  switch (section.layout) {
    case 'hero':
      return <div className="nl-about-hero text-center mb-16">
        <div className="nl-about-orbit" aria-hidden="true" />
        <div className="nl-about-floaters" aria-hidden="true"><span><Library className="w-4 h-4" /></span><span><Compass className="w-4 h-4" /></span><span><Wand2 className="w-4 h-4" /></span></div>
        {section.eyebrow && <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6" style={{ background: 'rgba(0, 151, 178, 0.1)' }}>
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-teal-dark)' }} />
          <span className="text-xs font-medium tracking-wide" style={{ color: 'var(--color-teal-dark)' }}>{section.eyebrow}</span>
        </div>}
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight tracking-tight mb-6 text-balance" style={{ color: 'var(--color-text)' }}>{section.title}</h1>
        {paragraphs(section.body).map((p, i) => <p key={i} className="text-lg leading-relaxed mb-3" style={{ color: 'var(--color-text-muted)' }}>{p}</p>)}
      </div>;

    case 'pillars':
      return <div className="mb-16">
        <Heading title={section.title} subtitle={section.subtitle} />
        <div className="space-y-6">
          {section.items.map((it, i) => { const Icon = ICONS[it.icon || 'book'] || BookOpen; return <div key={`${it.title}-${i}`} className="surface-card p-6 flex gap-4 animate-fade-up nl-about-card" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(0, 151, 178, 0.1)' }}><Icon className="w-6 h-6" style={{ color: 'var(--color-teal-dark)' }} /></div>
            <div className="min-w-0"><h3 className="font-serif text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>{it.title}</h3><p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{it.desc}</p></div>
          </div>; })}
        </div>
      </div>;

    case 'grid':
      return <div className="mb-16">
        <Heading title={section.title} subtitle={section.subtitle} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {section.items.map((it, i) => { const Icon = ICONS[it.icon || 'sparkles'] || Sparkles; return <div key={`${it.title}-${i}`} className="surface-card p-5 flex gap-3 nl-about-card">
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-teal-dark)' }} />
            <div className="min-w-0"><h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{it.title}</h4><p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{it.desc}</p></div>
          </div>; })}
        </div>
      </div>;

    case 'steps':
      return <div className="mb-16">
        <Heading title={section.title} subtitle={section.subtitle} />
        <div className="space-y-4">
          {section.items.map((it, i) => <div key={`${it.title}-${i}`} className="flex items-start gap-4 p-5 surface-card nl-about-card">
            <div className="flex-shrink-0 w-8 h-8 rounded-full gradient-teal text-white flex items-center justify-center text-sm font-bold">{i + 1}</div>
            <div className="min-w-0"><h4 className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>{it.title}</h4><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{it.desc}</p></div>
          </div>)}
        </div>
      </div>;

    case 'faq':
      return <Faq section={section} email={email} />;

    case 'cta': {
      const link = safeLink(section.button_link);
      return <div className="text-center p-8 sm:p-10 rounded-3xl gradient-teal text-white mb-8">
        <PenTool className="w-8 h-8 text-white/70 mx-auto mb-4" />
        <h2 className="font-serif text-3xl font-semibold mb-3">{section.title}</h2>
        {section.body && <p className="text-white/70 leading-relaxed mb-6 max-w-md mx-auto">{section.body}</p>}
        {section.button_label && link && <button type="button" onClick={() => (link.startsWith('/') ? navigate(link) : window.open(link, '_blank', 'noopener,noreferrer'))} className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm tracking-wide bg-white/15 hover:bg-white/25 transition-all duration-300">{section.button_label} <ArrowRight className="w-4 h-4" /></button>}
      </div>;
    }

    default:
      return <div className="mb-16">
        <Heading title={section.title} subtitle={section.subtitle} />
        <div className="surface-card p-6 space-y-3">{paragraphs(section.body).map((p, i) => <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{p}</p>)}</div>
      </div>;
  }
}
