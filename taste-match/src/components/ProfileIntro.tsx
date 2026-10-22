import type { ProfileQuestion } from '@/lib/profileQuestions';
import { answerText } from '@/components/ProfileQuestionAnswer';
import { sanitizeUserText } from '@/lib/sanitize';

/** The reader's "About me" / bio question, if the question set has one. */
export function findAboutQuestion(questions: ProfileQuestion[]): ProfileQuestion | undefined {
  const norm = (q: ProfileQuestion) => ({ key: q.key.toLowerCase().replace(/[_\-\s]+/g, ' ').trim(), text: q.question.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim() });
  return questions.find((q) => {
    if (q.active === false) return false;
    const { key, text } = norm(q);
    return ['bio', 'about', 'about me', 'reader bio'].includes(key) || ['bio', 'about', 'about me', 'reader bio', 'about you', 'about yourself', 'tell us about yourself'].includes(text);
  });
}

/** Short intro shown after the profile card and before highlights and tabs. */
export function ProfileIntro({ questions, answers, visibility }: { questions: ProfileQuestion[]; answers: Record<string, unknown>; visibility: Record<string, boolean> }) {
  const q = findAboutQuestion(questions);
  if (!q) return null;
  if ((visibility[`question:${q.key}`] ?? q.public_default) === false) return null;
  const text = sanitizeUserText(answerText(answers[q.key]), 1200).trim();
  if (!text) return null;
  return (
    <section className="nl-intro" aria-label="About this reader">
      <p className="nl-intro-kicker">About</p>
      <p className="nl-intro-text">{text}</p>
    </section>
  );
}
