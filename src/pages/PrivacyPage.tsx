import { ArrowLeft, Mail } from 'lucide-react';
import { useSupportEmail } from '@/lib/siteSettings';
import { useEditableOverride, EditablePageOverride } from '@/components/EditablePageOverride';

interface PrivacyPageProps {
  navigate: (path: string) => void;
}

export function PrivacyPage({ navigate }: PrivacyPageProps) {
  const editable = useEditableOverride('privacy');
  if (editable) return <EditablePageOverride page={editable} navigate={navigate} />;
  const supportEmail = useSupportEmail();
  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <article className="surface-card p-6 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-teal-dark)' }}>
            Legal
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight mb-3" style={{ color: 'var(--color-text)' }}>
            Privacy Policy &amp; Data Governance Notice
          </h1>
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Last updated: September 2026
          </p>
          <p className="text-sm mb-10" style={{ color: 'var(--color-text-muted)' }}>
            Applicable Law: This Privacy Policy is intended to operate in accordance with applicable laws of India.
          </p>

          <section className="rounded-2xl p-4 sm:p-5 mb-8" style={{ background: 'linear-gradient(90deg,rgba(0,151,178,.08),rgba(92,225,230,.11))', border: '1px solid rgba(0,151,178,.18)' }}>
            <h2 className="font-serif text-lg font-semibold mb-1.5">Service availability notice</h2>
            <p className="text-sm leading-6">Some features available in the current webapp deployment might become locked in future deployments once subscription plans are introduced.</p>
          </section>

          <div className="space-y-8 text-sm leading-7" style={{ color: 'var(--color-text)' }}>
            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">1. Information We Collect</h2>
              <p>
                When you create an account, log in, or submit a review on Novelty Library, we collect your email
                address, display name, and Instagram handle via our authentication system. These details are collected
                solely for account verification, spam prevention, and reviewer attribution.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">2. Age &amp; Children’s Privacy</h2>
              <p>
                Novelty Library is designed for readers aged 13 and above. We do not knowingly solicit or collect
                personally identifiable information from children under 13 without guardian consent. If we receive a
                verified notification that a child’s personal information was submitted without the required assent or
                consent, we will take reasonable immediate steps to anonymize the submission and purge associated personal
                credentials, subject to any information we are required to retain by law.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">3. How We Use Your Information &amp; Service Providers</h2>
              <p>
                Account authentication, security tokens, and profile data are securely processed through Supabase. Your
                display name and Instagram handle are displayed alongside your published book reviews so readers can
                view attribution for each critique.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">4. No Sale or Commercialization of Personal Data</h2>
              <p>
                We handle personal data in accordance with applicable Indian data-protection requirements and seek to
                follow the principles reflected in the Digital Personal Data Protection (DPDP) Act, 2023, as applicable.
                We do not sell, rent, license, or trade your personal information, email address, or social handles to
                any third party for marketing or advertising purposes.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">5. Account Deletion vs. Permanent Review Archive (Anonymization Policy)</h2>
              <p className="mb-4">
                You have the right to request deletion of your account and personal identifiers at any time by emailing{' '}
                <a
                  href={`mailto:${supportEmail}`}
                  className="font-medium underline underline-offset-2"
                  style={{ color: 'var(--color-cyan-dark)' }}
                >
                  {supportEmail}
                </a>
                .
              </p>
              <ul className="list-disc pl-5 space-y-3">
                <li>
                  <strong>Account &amp; Contact Data:</strong> Upon verification, we will delete your authentication
                  account, stored email address, and private credentials.
                </li>
                <li>
                  <strong>Published Reviews:</strong> Because each published review is assigned a permanent,
                  sequential Review Number that anchors the integrity of our public catalog, the review content and its
                  assigned Review Number will not be removed. Instead, your personal information will be completely
                  anonymized: your display name and Instagram handle will be scrubbed and replaced with &quot;Anonymous.&quot;
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">6. Grievance Officer &amp; Contact</h2>
              <p>
                In accordance with the Information Technology Act, 2000, the IT (Intermediary Guidelines) Rules, and
                data privacy standards, for any privacy inquiries, data deletion requests, or grievances, contact our
                designated administrator at:
              </p>
              <p className="mt-3">
                <strong>Email:</strong>{' '}
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                  style={{ color: 'var(--color-cyan-dark)' }}
                >
                  <Mail className="w-3.5 h-3.5" /> {supportEmail}
                </a>
              </p>
              <p className="mt-3">
                We will verify and address all legitimate requests in accordance with applicable Indian law.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">Right to Modify</h2>
              <p>
                We may update these terms periodically to reflect platform improvements. Continued use of Novelty Library
                following any updates constitutes acceptance of the revised terms.
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
