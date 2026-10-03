import { ArrowLeft, Mail } from 'lucide-react';
import { useSupportEmail } from '@/lib/siteSettings';
import { useEditableOverride, EditablePageOverride } from '@/components/EditablePageOverride';

interface TermsPageProps {
  navigate: (path: string) => void;
}

export function TermsPage({ navigate }: TermsPageProps) {
  const editable = useEditableOverride('terms');
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
            Terms of Service &amp; Fair Use
          </h1>
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Last updated: September 2026
          </p>
          <p className="text-sm mb-10" style={{ color: 'var(--color-text-muted)' }}>
            Applicable Law: These Terms are intended to operate in accordance with applicable laws of India.
          </p>

          <div className="space-y-8 text-sm leading-7" style={{ color: 'var(--color-text)' }}>
            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">Scope of these terms</h2>
              <p>
                These terms apply to book reviews, interactive reading maps, reading tracking, community challenges,
                and all current or future features offered on Novelty Library.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">Age Representation &amp; Parental Assent</h2>
              <p>
                Novelty Library is designed for readers aged 13 and above. By accessing the platform, creating an account,
                or submitting a review, you represent and warrant that you meet this age requirement, or that you are
                accessing the service under the supervision and with the consent of a parent or legal guardian. Novelty
                Library does not knowingly solicit or collect personally identifiable information from children under 13
                without guardian consent. If Novelty Library receives verified notification that personal information of a
                child has been submitted without required assent, we will take immediate steps to anonymize the submission
                and purge associated personal credentials.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">Submitting reviews</h2>
              <p>
                By submitting a review to Novelty Library, you grant Novelty Library a non-exclusive license to
                format, edit for presentation, reproduce, and display that submitted review as part of the site,
                review posts, and related Novelty Library materials. You retain ownership of your original review.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">Book information and fair use</h2>
              <p>
                Book titles, cover thumbnails, publisher information, and other book metadata belong to their respective
                publishers, authors, artists, or other rights holders. Novelty Library uses this material strictly for
                purposes of book identification, review, commentary, and criticism under applicable Fair Use principles.
                We do not claim ownership of those third-party materials.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">Reviewer responsibility</h2>
              <p>
                Reviewers are responsible for the content they submit and should only submit material they have the
                right to share. Reviews should be genuine commentary about books and should not knowingly contain
                unlawful, infringing, or abusive material.
              </p>
            </section>

            <section>
              <h2 className="font-serif text-xl font-semibold mb-2">Copyright Infringement, Intermediary Takedowns &amp; Review Permanence</h2>
              <p>
                If you are an author, publisher, or rights holder and believe that any promotional image, book cover,
                or material displayed on Novelty Library infringes your copyright under the Indian Copyright Act, 1957
                or international conventions, please send a written takedown request to{' '}
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                  style={{ color: 'var(--color-cyan-dark)' }}
                >
                  <Mail className="w-3.5 h-3.5" /> {supportEmail}
                </a>{' '}
                detailing the specific material and proof of ownership. As an intermediary operating under the
                Information Technology Act, 2000 (and applicable Intermediary Guidelines), we will examine valid requests
                and take down infringing third-party intellectual property.
              </p>
              <p className="mt-4">
                <strong>Review Permanence Clause:</strong> This takedown process applies exclusively to third-party
                copyright claims (such as unauthorized book covers or poster artwork). Submitted book reviews cannot be
                deleted, removed, or taken down once assigned a Review Number, as each entry permanently anchors our
                sequential library archive. Reviewers seeking to disassociate themselves from a published review may
                request to have their personal details anonymized (removing their name and Instagram handle) by contacting
                the same email address, while the review text, rating, and Review Number remain permanent parts of the archive.
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
