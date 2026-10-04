import { useState } from 'react';
import { ArrowUpRight, Download, ExternalLink, Instagram, Mail, Share, Smartphone, Sparkles, Zap } from 'lucide-react';
import { useSupportEmail } from '@/lib/siteSettings';
import { usePwaInstall } from '@/lib/pwa';

interface FooterProps {
  navigate: (path: string) => void;
}

const LINKS: [string, string][] = [
  ['Home', '/'],
  ['Reviews', '/reviews'],
  ['Submit a Review', '/submit'],
  ['About Us', '/about'],
];

export function Footer({ navigate }: FooterProps) {
  const supportEmail = useSupportEmail();
  const { canInstall, isInstalled, platform, install } = usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);
  const isStandalone = isInstalled;

  return (
    <footer className="nl-footer mt-24">
      <div className="container-prose pb-10">
        {!isStandalone && (
          <section className="nl-footer-cta" aria-label="Install the Novelty Library app">
            <span className="nl-footer-orb nl-footer-orb-a" aria-hidden="true" />
            <span className="nl-footer-orb nl-footer-orb-b" aria-hidden="true" />
            <div className="nl-footer-cta-copy">
              <span className="nl-footer-kicker"><Sparkles className="w-3.5 h-3.5" /> Free · No app store needed</span>
              <h3 className="font-serif">Keep Novelty Library one tap away</h3>
              <p>Install the app to your home screen. It opens full-screen like a real app, so your next review is always a tap away.</p>
              <ul className="nl-footer-perks">
                <li><Zap className="w-3.5 h-3.5" /> Opens instantly</li>
                <li><Smartphone className="w-3.5 h-3.5" /> Full-screen, no browser bar</li>
                <li><Sparkles className="w-3.5 h-3.5" /> Takes 5 seconds</li>
              </ul>
            </div>
            <div className="nl-footer-cta-action">
              <button
                type="button"
                className="nl-footer-install"
                onClick={() => (canInstall ? void install() : setShowHelp((v) => !v))}
                aria-expanded={!canInstall ? showHelp : undefined}
              >
                <Download className="w-5 h-5" /> {canInstall ? 'Install the app' : 'How to install'}
              </button>
              {showHelp && !canInstall && (
                <div className="nl-footer-help animate-fade-in" role="note">
                  {platform === 'in-app' ? (
                    <p><ExternalLink className="w-3.5 h-3.5" /> <span>You're inside another app's browser. Open this page in <b>Chrome</b> or <b>Safari</b> (menu, then “Open in browser”) and tap Install again.</span></p>
                  ) : platform === 'ios' ? (
                    <p><Share className="w-3.5 h-3.5" /> <span>Tap the <b>Share</b> button in Safari, then choose <b>“Add to Home Screen”</b>.</span></p>
                  ) : (
                    <>
                      <p><Download className="w-3.5 h-3.5" /> <span><b>Android:</b> open the browser menu (⋮) and choose <b>“Install app”</b> or “Add to Home screen”.</span></p>
                      <p><Share className="w-3.5 h-3.5" /> <span><b>iPhone / iPad:</b> tap Share, then “Add to Home Screen”.</span></p>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        <div className="nl-footer-grid">
          <div className="nl-footer-brand">
            <div className="flex items-center gap-3 mb-4">
              <img src="/novelty-library-logo.png" alt="" width={40} height={40} className="nl-footer-logo" />
              <span className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Novelty Library</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
              What book broke your brain this month? We review the books that mess with your head, in two minutes or less.
            </p>
          </div>

          <nav aria-label="Explore">
            <h4 className="nl-footer-h">Explore</h4>
            <div className="flex flex-col gap-1">
              {LINKS.map(([label, path]) => (
                <button key={path} onClick={() => navigate(path)} className="nl-footer-link">{label}</button>
              ))}
            </div>
          </nav>

          <div>
            <h4 className="nl-footer-h">Connect</h4>
            <div className="flex flex-col gap-2">
              <a href={`mailto:${supportEmail}`} className="nl-footer-pill"><Mail className="w-4 h-4" /> <span className="truncate">{supportEmail}</span></a>
              <a href="https://instagram.com/novelty.lib" target="_blank" rel="noopener noreferrer" className="nl-footer-pill nl-footer-pill-ig">
                <Instagram className="w-4 h-4" /> @novelty.lib <ArrowUpRight className="w-3.5 h-3.5 ml-auto" />
              </a>
            </div>
          </div>
        </div>

        <div className="nl-footer-bottom">
          <p>© {new Date().getFullYear()} Novelty Library. All rights reserved. <span style={{ opacity: .6 }}>· v1.4</span></p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate('/privacy')} className="hover:underline underline-offset-2">Privacy Policy</button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => navigate('/terms')} className="hover:underline underline-offset-2">Terms of Service</button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => navigate('/cookies')} className="hover:underline underline-offset-2">Cookie Policy</button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => window.dispatchEvent(new Event('nl-open-cookie-settings'))} className="hover:underline underline-offset-2">Cookie settings</button>
          </div>
        </div>
        <p className="nl-footer-note">Reviews are opinions of individual reviewers, not cumulative assessments.</p>
      </div>
    </footer>
  );
}
