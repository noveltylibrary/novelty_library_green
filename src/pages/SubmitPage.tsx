import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Send, Star, PenTool, Search, Upload,
  Save, Lock, Eye, Edit3, Download, AlertCircle, X,
  Clock, BookOpen, Sparkles, Heart, Plus, Trash2, FileText, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { submitReview, searchOpenLibrary, uploadCoverImage, saveDraft, loadDrafts, checkBookAvailability, createBookReservation, type OpenLibraryResult, type SavedReviewDraft } from '@/lib/reviews';
import { getErrorMessage } from '@/lib/format';
import type { Review } from '@/types/review';

interface SubmitPageProps {
  navigate: (path: string) => void;
}

const GENRES = [
  'Self-Help', 'Fiction', 'Non-Fiction', 'Mystery', 'Thriller', 'Romance',
  'Drama', 'Poetry', 'Biography', 'Anthology', 'Sports', 'Contemporary Fiction',
  'Psychological Thriller', 'Historical Fiction', 'Other',
];

const LANGUAGES = [
  'English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati',
  'Kannada', 'Malayalam', 'Punjabi', 'Urdu', 'French', 'Spanish', 'German',
  'Italian', 'Portuguese', 'Japanese', 'Korean', 'Russian', 'Other',
];

const HEARD_FROM_OPTIONS = [
  'Reviewers', 'Authors', 'Novelty Library Website', 'Google search',
  'Social media', 'Other',
];

interface FormState {
  title: string;
  author: string;
  genre: string;
  traits: string;
  language: string;
  review_text: string;
  rw_rating: number;
  goodreads_rating: string;
  amazon_rating: string;
  cover_image_url: string;
  cover_storage_path: string;
  buy_link: string;
  series_name: string;
  series_number: string;
  translated_from: string;
  review_date: string;
  heard_from: string;
  form_feedback: string;
  rating_integer: number;
  undertaking_accepted: boolean;
}

const EMPTY_FORM: FormState = {
  title: '', author: '', genre: '', traits: '', language: '', review_text: '',
  rw_rating: 7, goodreads_rating: '', amazon_rating: '', cover_image_url: '',
  cover_storage_path: '', buy_link: '', series_name: '', series_number: '',
  translated_from: '', review_date: '', heard_from: '', form_feedback: '', rating_integer: 9,
  undertaking_accepted: false,
};

const splitTraits = (value: string) => value.split(',').map((trait) => trait.trim()).filter(Boolean).slice(0, 5);
const LOCAL_DRAFT_KEY = 'novelty_review_local_draft_v2';
const LOCAL_DRAFT_TIME_KEY = 'novelty_review_local_draft_time_v2';
const DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

// The Instagram poster uses the Novelty Library star scale derived from the
// reviewer's 0–10 R/W rating. The ranges intentionally match the supplied
// reference table exactly.
function rwRatingToStars(rating: number): number {
  const value = Math.max(0, Math.min(10, Math.round(rating * 10) / 10));
  if (value <= 1.5) return 0.5;
  if (value <= 2.5) return 1;
  if (value <= 3.5) return 1.5;
  if (value <= 4.5) return 2;
  if (value <= 5.5) return 2.5;
  if (value <= 6.5) return 3;
  if (value <= 7.5) return 3.5;
  if (value <= 8.5) return 4;
  return 4.5;
}

function CalculatedStars({ value, size = 18 }: { value: number; size?: number }) {
  const normalized = rwRatingToStars(Number(value) || 0);
  const fullStars = Math.floor(normalized);
  const hasHalf = normalized - fullStars >= 0.5;
  const totalIcons = fullStars + (hasHalf ? 1 : 0);

  return (
    <span
      className="calculated-stars"
      aria-label={`${normalized.toFixed(1)} stars`}
      title={`${normalized.toFixed(1)} stars`}
    >
      {Array.from({ length: totalIcons }).map((_, index) => {
        const half = hasHalf && index === fullStars;
        return (
          <span key={index} className="calculated-star" style={{ width: size, height: size }}>
            <Star
              width={size}
              height={size}
              strokeWidth={1.8}
              className="calculated-star-outline"
            />
            {(!half || index < fullStars) && (
              <Star
                width={size}
                height={size}
                strokeWidth={1.8}
                fill="currentColor"
                className="calculated-star-fill"
              />
            )}
            {half && (
              <span className="calculated-star-half">
                <Star
                  width={size}
                  height={size}
                  strokeWidth={1.8}
                  fill="currentColor"
                  className="calculated-star-fill"
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function posterStarsSvg(stars: number): string {
  const normalized = rwRatingToStars(stars);
  const fullStars = Math.floor(normalized);
  const hasHalf = normalized - fullStars >= 0.5;
  const count = fullStars + (hasHalf ? 1 : 0);
  const starPath = 'M12 1.8l3.15 6.38 7.04 1.02-5.1 4.97 1.2 7.01L12 17.87l-6.29 3.31 1.2-7.01-5.1-4.97 7.04-1.02L12 1.8z';
  const gap = 38;
  const start = 190 - ((Math.max(count, 1) - 1) * gap) / 2;
  const starsMarkup = Array.from({ length: count }).map((_, index) => {
    const half = hasHalf && index === fullStars;
    const x = start + index * gap;
    if (half) {
      return `<g transform="translate(${x - 12} 20)"><path d="${starPath}" fill="none" stroke="white" stroke-width="2"/><clipPath id="halfStar"><rect x="0" y="0" width="12" height="25"/></clipPath><path d="${starPath}" fill="white" clip-path="url(#halfStar)"/></g>`;
    }
    return `<path d="${starPath}" transform="translate(${x - 12} 20)" fill="white"/>`;
  }).join('');
  return `<g>${starsMarkup}</g>`;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normaliseTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function reviewQualityTips(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return ['A few honest lines about what worked, surprised you, or stayed with you is a good starting point.'];
  const words = trimmed.split(/\s+/).length;
  const sentences = (trimmed.match(/[.!?]+(?:\s|$)/g) || []).length;
  const tips: string[] = [];
  if (words < 120) tips.push('Add a little more detail about the characters, story, ideas, or emotional impact.');
  if (sentences < 3) tips.push('Try breaking your thoughts into at least 3 sentences so the review is easier to read.');
  if (/\b(very very|really really|good good|bad bad)\b/i.test(trimmed)) tips.push('You may want to replace repeated words with a more specific description.');
  if ((trimmed.match(/[A-Z]{6,}/g) || []).length >= 3) tips.push('There are several all-caps words; check that they are intentional.');
  if (!tips.length) tips.push('Looks good — your review has enough detail for a useful reader-facing review.');
  return tips;
}

export function SubmitPage({ navigate }: SubmitPageProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftMsg, setDraftMsg] = useState<string | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<SavedReviewDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const openFromHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#reserve' || hash.endsWith('#reserve') || hash.includes('/submit#reserve')) {
        setReservationModalOpen(true);
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);
  const [loadDraftModalOpen, setLoadDraftModalOpen] = useState(false);
  const [reservationBook, setReservationBook] = useState('');
  const [reservationAuthor, setReservationAuthor] = useState('');
  const [reservationSubmitting, setReservationSubmitting] = useState(false);

  // Honeypot spam field. Deliberately kept out of FormState/drafts — a real
  // visitor never sees or fills this in; if it has a value on submit, the
  // request is almost certainly a bot and is dropped silently.
  const [faxNumber, setFaxNumber] = useState('');

  // Open Library search
  const [olQuery, setOlQuery] = useState('');
  const [olResults, setOlResults] = useState<OpenLibraryResult[]>([]);
  const [olSearching, setOlSearching] = useState(false);

  // Cover upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverSource, setCoverSource] = useState<'open-library' | 'uploaded' | 'url' | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [qualityTips, setQualityTips] = useState<string[]>([]);

  // Post-submit edit window
  const [submittedReview, setSubmittedReview] = useState<Review | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [editTimeLeft, setEditTimeLeft] = useState(300); // 5 minutes in seconds
  const [editExpired, setEditExpired] = useState(false);

  const update = (field: keyof FormState, value: string | number | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
  };


  // Pulls a field's real DOM value back into state the moment the browser's
  // autofill paints it — see the nl-autofill-start keyframe in index.css.
  // Without this, a browser-filled field can look empty to React (and so
  // to the progress bar and to validation) even though it's visibly filled.
  const syncAutofill = (field: keyof FormState) => (e: React.AnimationEvent<HTMLInputElement>) => {
    if (e.animationName !== 'nl-autofill-start') return;
    const val = e.target.value;
    if (val) update(field, val);
  };

  // Only the fields marked "*" on the form count toward progress — Form
  // Rating and "Where did you hear about us" are optional and deliberately
  // excluded.
  const COMPULSORY_FIELDS: (keyof FormState)[] = [
    'title', 'author', 'genre', 'language', 'traits', 'review_text', 'goodreads_rating', 'rw_rating',
  ];
  const compulsoryDone = COMPULSORY_FIELDS.filter((f) => {
    const v = form[f];
    if (f === 'review_text') return form.review_text.trim().length >= 100;
    if (f === 'goodreads_rating') return Boolean(form.goodreads_rating.trim()) && Number(form.goodreads_rating) >= 0 && Number(form.goodreads_rating) <= 5;
    return typeof v === 'string' ? v.trim().length > 0 : Boolean(v);
  }).length + (form.undertaking_accepted ? 1 : 0);
  const compulsoryTotal = COMPULSORY_FIELDS.length + 1; // +1 for the undertaking checkbox
  const formProgress = Math.round((compulsoryDone / compulsoryTotal) * 100);

  // Edit countdown timer
  useEffect(() => {
    if (!submittedReview || editExpired) return;
    if (editTimeLeft <= 0) {
      setEditExpired(true);
      setEditMode(false);
      return;
    }
    const timer = setTimeout(() => setEditTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [submittedReview, editTimeLeft, editExpired]);

  // Check if page was refreshed after submit
  useEffect(() => {
    if (submittedReview && performance.navigation) {
      // On refresh, lock editing
      setEditMode(false);
    }
  }, [submittedReview]);

  // Always bring the success state to the very top so the animated book and
  // prominent "Form submitted!" confirmation are the first things visible.
  useEffect(() => {
    if (!success || !submittedReview) return;
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }, [success, submittedReview]);

  const handleOpenLibrarySearch = useCallback(async () => {
    if (!olQuery.trim()) return;
    setOlSearching(true);
    try {
      const results = await searchOpenLibrary(olQuery.trim());
      setOlResults(results);
    } catch {
      setOlResults([]);
    } finally {
      setOlSearching(false);
    }
  }, [olQuery]);

  const fillFromOpenLibrary = (result: OpenLibraryResult) => {
    update('title', result.title);
    update('author', result.author);
    if (result.coverUrl) {
      update('cover_image_url', result.coverUrl);
      setCoverPreview(result.coverUrl);
      setCoverSource('open-library');
    }
    if (result.subjects.length > 0) update('traits', result.subjects.slice(0, 5).join(', '));
    if (result.language) update('language', result.language);
    setOlResults([]);
    setOlQuery('');
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      setError(null);
      const { path, publicUrl } = await uploadCoverImage(file, user.id);
      update('cover_storage_path', path);
      update('cover_image_url', publicUrl);
      setCoverPreview(publicUrl);
      setCoverSource('uploaded');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to upload image'));
    }
  };

  const getDraftPayload = () => ({ ...form, coverPreview, coverSource });

  const refreshSavedDrafts = useCallback(async () => {
    if (!user) { setSavedDrafts([]); return; }
    try { setSavedDrafts(await loadDrafts()); } catch { setSavedDrafts([]); }
  }, [user?.id]);

  useEffect(() => { void refreshSavedDrafts(); }, [refreshSavedDrafts]);

  const writeLocalDraft = (payload = getDraftPayload()) => {
    try {
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(payload));
      const now = Date.now();
      localStorage.setItem(LOCAL_DRAFT_TIME_KEY, String(now));
      setLastSavedAt(now);
    } catch {
      // Some private browsing modes can disable localStorage.
    }
  };

  const applyDraft = (draft: Record<string, unknown>) => {
    const nextForm: FormState = { ...EMPTY_FORM };
    (Object.keys(EMPTY_FORM) as (keyof FormState)[]).forEach((key) => {
      if (key in draft) nextForm[key] = draft[key] as never;
    });
    setForm(nextForm);
    const savedCover = typeof draft.coverPreview === 'string' ? draft.coverPreview : nextForm.cover_image_url;
    setCoverPreview(savedCover || null);
    const source = draft.coverSource;
    if (source === 'open-library' || source === 'uploaded' || source === 'url') setCoverSource(source);
    else if (nextForm.cover_storage_path) setCoverSource('uploaded');
    else if (nextForm.cover_image_url) setCoverSource('url');
    setQualityTips(reviewQualityTips(nextForm.review_text));
  };


  const openDraftSaveModal = () => {
    if (!user) { setDraftMsg('Sign in to save drafts to your account.'); return; }
    setDraftName('');
    setDraftModalOpen(true);
  };

  const confirmSaveDraft = async () => {
    if (!user) return;
    const nextNumber = Math.min(savedDrafts.length + 1, 5);
    const effectiveName = draftName.trim() || form.title.trim() || `Draft [${nextNumber}]`;
    try {
      const saved = await saveDraft(getDraftPayload() as Record<string, unknown>, effectiveName, selectedDraftId || undefined);
      writeLocalDraft(saved.draft_data);
      setSelectedDraftId(saved.id);
      setDraftModalOpen(false);
      setDraftMsg(`“${saved.name}” saved.`);
      await refreshSavedDrafts();
    } catch (err) {
      setDraftMsg(getErrorMessage(err, 'Could not save draft.'));
    }
    setTimeout(() => setDraftMsg(null), 3500);
  };

  const handleLoadSelectedDraft = async (id: string) => {
    setSelectedDraftId(id);
    if (!id) return;
    const selected = savedDrafts.find((d) => d.id === id);
    if (selected) {
      applyDraft(selected.draft_data);
      setLoadDraftModalOpen(false);
      setDraftMsg(`“${selected.name}” loaded.`);
      setRecoveryAvailable(false);
      setTimeout(() => document.querySelector<HTMLInputElement>('input[name="title"]')?.focus(), 50);
    }
    setTimeout(() => setDraftMsg(null), 3500);
  };

  const openLoadDraftModal = async () => {
    if (!user) {
      setDraftMsg('Sign in to load drafts saved to your account.');
      setTimeout(() => setDraftMsg(null), 3500);
      return;
    }
    await refreshSavedDrafts();
    setLoadDraftModalOpen(true);
  };

  const orderedDrafts = [...savedDrafts].sort((a, b) => {
    const aTime = Date.parse(a.created_at || a.updated_at || '');
    const bTime = Date.parse(b.created_at || b.updated_at || '');
    return aTime - bTime;
  });

  const submitReservation = async () => {
    if (!reservationBook.trim()) { setDraftMsg('Enter a book name to reserve.'); return; }
    setReservationSubmitting(true);
    setError(null);
    try {
      await createBookReservation(reservationBook, reservationAuthor);
      setReservationModalOpen(false);
      setReservationBook(''); setReservationAuthor('');
      setDraftMsg(`Reservation request filled for “${reservationBook.trim()}”. Waiting for admin acceptance.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not submit reservation request.'));
    } finally { setReservationSubmitting(false); }
    setTimeout(() => setDraftMsg(null), 5000);
  };

  // Local recovery runs quietly while the user types. It never replaces the
  // explicit Save Draft button and only keeps the latest seven days.
  useEffect(() => {
    const hasContent = Object.entries(form).some(([key, value]) => key !== 'undertaking_accepted' && String(value).trim() !== '');
    if (!hasContent) return;
    const timer = window.setTimeout(() => writeLocalDraft(), 1200);
    return () => window.clearTimeout(timer);
  }, [form, coverPreview, coverSource]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
      const timestamp = Number(localStorage.getItem(LOCAL_DRAFT_TIME_KEY) || 0);
      if (!raw || !timestamp || Date.now() - timestamp >= DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(LOCAL_DRAFT_KEY);
        localStorage.removeItem(LOCAL_DRAFT_TIME_KEY);
        return;
      }
      setRecoveryAvailable(true);
      setLastSavedAt(timestamp);
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    const title = form.title.trim();
    if (title.length < 2) { setDuplicateWarning(null); return; }
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkBookAvailability(title);
        if (!result.unavailable) setDuplicateWarning(null);
        else setDuplicateWarning(result.reason === 'reserved'
          ? `“${title}” is already reserved. Please pick another book.`
          : `“${title}” is already reviewed. Please pick another book.`);
      } catch { setDuplicateWarning(null); }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [form.title]);

  useEffect(() => {
    setQualityTips(reviewQualityTips(form.review_text));
  }, [form.review_text]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check: a real visitor never sees or fills this field. If it
    // has any value, this is a bot — abort silently with no Supabase write
    // and no user-facing error (so the bot's scraper gets no signal either).
    if (faxNumber.trim().length > 0) {
      return;
    }

    if (!user) {
      setError('You must sign in to submit a review.');
      navigate('/auth');
      return;
    }

    if (!profile?.name) {
      setError('Complete your profile (Name) before submitting.');
      navigate('/profile');
      return;
    }

    if (!form.language.trim()) {
      setError('Language is required.');
      return;
    }

    if (!form.traits.trim()) {
      setError('Add at least one trait.');
      return;
    }

    if (form.title.trim().length > 150) {
      setError('Book title must be 150 characters or fewer.');
      return;
    }

    if (form.author.trim().length > 100) {
      setError('Author name must be 100 characters or fewer.');
      return;
    }

    if (form.review_text.trim().length < 100) {
      setError('Your review must be at least 100 characters.');
      return;
    }

    if (form.review_text.trim().length > 2000) {
      setError('Your review must be 2000 characters or fewer.');
      return;
    }

    if (!form.goodreads_rating.trim()) {
      setError('Goodreads rating is required.');
      return;
    }

    if (!form.cover_image_url.trim()) {
      setError('Cover image is required. Please upload a cover, choose the Open Library cover, or paste a valid image URL.');
      return;
    }

    if (!isValidHttpUrl(form.cover_image_url.trim())) {
      setError('Cover image URL must be a valid http:// or https:// URL.');
      return;
    }

    if (form.buy_link.trim() && !isValidHttpUrl(form.buy_link.trim())) {
      setError('Buy link must be a valid http:// or https:// URL.');
      return;
    }

    if (!form.undertaking_accepted) {
      setError('You must accept the undertaking to submit.');
      return;
    }

    if (form.goodreads_rating && Number(form.goodreads_rating) > 5) {
      setError('Goodreads rating must be 5 or less.');
      return;
    }

    try {
      const availability = await checkBookAvailability(form.title.trim());
      if (availability.unavailable) {
        setError(availability.reason === 'reserved'
          ? 'This book is already reserved. Please pick another book.'
          : 'This book is already reviewed. Please pick another book.');
        return;
      }
    } catch (availabilityError) {
      setError(getErrorMessage(availabilityError, 'Could not check whether this book is already reviewed or reserved.'));
      return;
    }

    if (form.amazon_rating && Number(form.amazon_rating) > 5) {
      setError('Amazon rating must be 5 or less.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const review = await submitReview({
        title: form.title.trim(),
        author: form.author.trim(),
        genre: form.genre,
        traits: form.traits.trim() || undefined,
        language: form.language.trim(),
        review_text: form.review_text.trim(),
        rw_rating: form.rw_rating,
        goodreads_rating: form.goodreads_rating ? Number(form.goodreads_rating) : undefined,
        amazon_rating: form.amazon_rating ? Number(form.amazon_rating) : undefined,
        reviewer_handle: profile.instagram_id || undefined,
        reviewer_name: profile.name || undefined,
        reviewer_email: profile.email || user.email || undefined,
        cover_image_url: form.cover_image_url.trim() || undefined,
        cover_storage_path: form.cover_storage_path.trim() || undefined,
        buy_link: form.buy_link.trim() || undefined,
        series_name: form.series_name.trim() || undefined,
        series_number: form.series_number ? Number(form.series_number) : undefined,
        translated_from: form.translated_from.trim() || undefined,
        review_date: form.review_date || undefined,
        heard_from: form.heard_from.trim() || undefined,
        form_feedback: form.form_feedback.trim() || undefined,
        rating_integer: form.rating_integer,
        undertaking_accepted: form.undertaking_accepted,
      });
      try {
        localStorage.removeItem(LOCAL_DRAFT_KEY);
        localStorage.removeItem(LOCAL_DRAFT_TIME_KEY);
      } catch { /* storage unavailable */ }
      setRecoveryAvailable(false);
      setSubmittedReview(review);
      setEditTimeLeft(300);
      setSuccess(true);
    } catch (err) {
      const raw = getErrorMessage(err, 'Failed to submit review');
      const friendly = raw.includes('duplicate key value')
        ? 'A review with this title already exists. Try adding a subtitle or slight variation.'
        : raw;
      setError(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!submittedReview || editExpired) return;

    if (!form.title.trim() || !form.author.trim() || !form.genre.trim() || !form.language.trim()) {
      setError('Please complete all required fields.');
      return;
    }
    if (!form.traits.trim()) {
      setError('Add at least one trait.');
      return;
    }
    if (form.title.trim().length > 150) {
      setError('Book title must be 150 characters or fewer.');
      return;
    }
    if (form.author.trim().length > 100) {
      setError('Author name must be 100 characters or fewer.');
      return;
    }
    if (form.review_text.trim().length < 100) {
      setError('Your review must be at least 100 characters.');
      return;
    }
    if (form.review_text.trim().length > 2000) {
      setError('Your review must be 2000 characters or fewer.');
      return;
    }
    if (!form.goodreads_rating.trim()) {
      setError('Goodreads rating is required.');
      return;
    }
    if (!form.cover_image_url.trim()) {
      setError('Cover image is required. Please add a cover before saving changes.');
      return;
    }
    if (!isValidHttpUrl(form.cover_image_url.trim())) {
      setError('Cover image URL must be a valid http:// or https:// URL.');
      return;
    }

    if (form.buy_link.trim() && !isValidHttpUrl(form.buy_link.trim())) {
      setError('Buy link must be a valid http:// or https:// URL.');
      return;
    }
    if (Number(form.goodreads_rating) > 5) {
      setError('Goodreads rating cannot exceed 5.');
      return;
    }
    if (form.amazon_rating && Number(form.amazon_rating) > 5) {
      setError('Amazon rating cannot exceed 5.');
      return;
    }
    if (!form.undertaking_accepted) {
      setError('You must accept the undertaking to save changes.');
      return;
    }

    setError(null);
    try {
      setSubmitting(true);
      const reviewUpdate = {
        title: form.title,
        author: form.author,
        genre: form.genre,
        traits: form.traits || null,
        language: form.language,
        review_text: form.review_text,
        rw_rating: form.rw_rating,
        goodreads_rating: form.goodreads_rating ? Number(form.goodreads_rating) : null,
        amazon_rating: form.amazon_rating ? Number(form.amazon_rating) : null,
        series_name: form.series_name || null,
        series_number: form.series_number ? Number(form.series_number) : null,
        translated_from: form.translated_from || null,
        review_date: form.review_date || null,
        heard_from: form.heard_from || null,
        form_feedback: form.form_feedback || null,
        cover_image_url: form.cover_image_url || null,
        cover_storage_path: form.cover_storage_path || null,
        buy_link: form.buy_link || null,
        undertaking_accepted: form.undertaking_accepted,
        rating_integer: form.rating_integer,
        updated_at: new Date().toISOString(),
      };

      let { error: updateError } = await supabase
        .from('reviews')
        .update(reviewUpdate)
        .eq('id', submittedReview.id);

      // Gracefully support databases that have not applied the optional
      // form_feedback migration yet. The review itself can still be edited.
      if (updateError?.code === 'PGRST204' && updateError.message?.includes('form_feedback')) {
        const { form_feedback: _formFeedback, ...legacyUpdate } = reviewUpdate;
        ({ error: updateError } = await supabase
          .from('reviews')
          .update(legacyUpdate)
          .eq('id', submittedReview.id));
      }

      if (updateError) throw updateError;
      setEditMode(false);
      setDraftMsg('Review updated!');
      setTimeout(() => setDraftMsg(null), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update review'));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadIGPoster = async () => {
    if (!submittedReview) return;
    try {
      // Build the poster locally so the downloaded artwork is always in sync
      // with the current UI. This also avoids serving an older deployed Edge
      // Function that still contains the legacy Blogspot footer.
      const escapeXml = (value: string) => value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&apos;');
      const stars = rwRatingToStars(Number(submittedReview.rw_rating || 0));
      const title = escapeXml(submittedReview.title || 'Untitled book');
      const author = escapeXml(submittedReview.author || 'Unknown author');
      const reviewer = escapeXml(profile?.instagram_id || profile?.name || '');
      const svg = `<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d9488"/>
      <stop offset="100%" stop-color="#0c4a6e"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect x="60" y="60" width="960" height="1800" rx="40" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <text x="540" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="42" fill="rgba(255,255,255,0.6)" letter-spacing="8">NOVELTY LIBRARY</text>
  <text x="540" y="700" text-anchor="middle" font-family="Georgia, serif" font-size="72" font-weight="600" fill="white">${title}</text>
  <text x="540" y="820" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="rgba(255,255,255,0.7)">by ${author}</text>
  <g transform="translate(330 890)">
    <rect x="0" y="0" width="420" height="100" rx="50" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.22)"/>
    ${posterStarsSvg(stars)}
  </g>
  <line x1="340" y1="1300" x2="740" y2="1300" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  ${reviewer ? `<text x="540" y="1380" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="rgba(255,255,255,0.8)">Reviewed by</text><text x="540" y="1430" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="600" fill="white">${reviewer}</text>` : ''}
  <g transform="translate(407 1695)">
    <rect x="0" y="0" width="266" height="70" rx="35" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.18)"/>
    <rect x="22" y="18" width="34" height="34" rx="9" fill="none" stroke="white" stroke-width="3"/>
    <circle cx="39" cy="35" r="8" fill="none" stroke="white" stroke-width="3"/>
    <circle cx="49" cy="25" r="3" fill="white"/>
    <text x="72" y="45" font-family="Arial, sans-serif" font-size="27" font-weight="600" fill="white">novelty.co.in</text>
  </g>
</svg>`;

      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const context = canvas.getContext('2d');
        if (!context) {
          URL.revokeObjectURL(svgUrl);
          setError('Your browser could not prepare the poster image.');
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(svgUrl);
          if (!blob) {
            setError('Failed to create the PNG poster.');
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `novelty-review-${submittedReview.slug || 'poster'}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }, 'image/png');
      };
      image.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        setError('Failed to render the poster image.');
      };
      image.src = svgUrl;
    } catch {
      setError('Failed to generate the poster.');
    }
  };

  const handleSubmitAnotherReview = () => {
    try {
      localStorage.removeItem(LOCAL_DRAFT_KEY);
      localStorage.removeItem(LOCAL_DRAFT_TIME_KEY);
    } catch { /* storage unavailable */ }
    setForm(EMPTY_FORM);
    setSubmittedReview(null);
    setSuccess(false);
    setEditMode(false);
    setPreviewMode(false);
    setEditExpired(false);
    setEditTimeLeft(300);
    setError(null);
    setDraftMsg(null);
    setCoverPreview(null);
    setCoverSource(null);
    setDuplicateWarning(null);
    setRecoveryAvailable(false);
    setLastSavedAt(null);
    setOlQuery('');
    setOlResults([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate('/submit');
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // Success screen with edit/preview/download
  if (success && submittedReview) {
    return (
      <div className="pt-32 pb-20 container-prose">
        <div className="max-w-2xl mx-auto animate-scale-in">
          <div className="text-center mb-8">
            <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center animate-success-book" aria-hidden="true">
              <div className="absolute inset-1 rounded-full" style={{ background: 'rgba(53, 211, 217, 0.10)', boxShadow: '0 0 45px rgba(53, 211, 217, 0.20)' }} />
              <svg viewBox="0 0 96 96" className="relative w-24 h-24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 24.5C27 20 36 20.5 48 27v49c-12-6.5-21-7-30-2.5V24.5Z" fill="rgba(53,211,217,.16)" stroke="var(--color-teal-dark)" strokeWidth="3" strokeLinejoin="round"/>
                <path d="M78 24.5C69 20 60 20.5 48 27v49c12-6.5 21-7 30-2.5V24.5Z" fill="rgba(53,211,217,.24)" stroke="var(--color-teal-dark)" strokeWidth="3" strokeLinejoin="round"/>
                <path d="M48 27v49" stroke="var(--color-teal-dark)" strokeWidth="3" strokeLinecap="round"/>
                <path d="m35 43 8 8 17-19" stroke="var(--color-teal-dark)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-success-check"/>
              </svg>
            </div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: 'var(--color-teal-dark)' }}>Form submitted!</div>
            <h1 className="font-serif text-5xl md:text-6xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Happy Reading! <span aria-hidden="true">📖</span></h1>
            <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
              Your review has been submitted for moderation. An admin will review it before it appears on the site.
            </p>

            {/* Edit countdown */}
            {!editExpired && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(53, 211, 217, 0.10)', border: '1px solid rgba(53, 211, 217, 0.20)' }}>
                <Clock className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-teal-dark)' }}>
                  Edit window: {formatTime(editTimeLeft)}
                </span>
              </div>
            )}
            {editExpired && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
                <Lock className="w-4 h-4" style={{ color: '#ef4444' }} />
                <span className="text-sm font-medium" style={{ color: '#ef4444' }}>Edit window expired</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            {!editExpired && !editMode && !previewMode && (
              <button onClick={() => setEditMode(true)} className="btn-primary">
                <Edit3 className="w-4 h-4" /> Edit Review
              </button>
            )}
            <button onClick={() => setPreviewMode(!previewMode)} className="btn-ghost">
              <Eye className="w-4 h-4" /> {previewMode ? 'Hide Preview' : 'Preview'}
            </button>
            <button onClick={downloadIGPoster} className="btn-ghost">
              <Download className="w-4 h-4" /> Download Poster (PNG)
            </button>
            <button onClick={handleSubmitAnotherReview} className="btn-primary">
              <Plus className="w-4 h-4" /> Submit Another Review
            </button>
            <button onClick={() => navigate('/')} className="btn-ghost">
              Back to Home
            </button>
          </div>

          {/* Preview mode */}
          {previewMode && (
            <div className="review-preview-card animate-fade-in">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--color-teal-dark)' }}>Novelty Review</p>
                  <h3 className="font-serif text-2xl font-semibold mt-1" style={{ color: 'var(--color-text)' }}>Your preview</h3>
                </div>
                <span className="preview-rating"><strong>{rwRatingToStars(form.rw_rating).toFixed(1)}</strong><CalculatedStars value={form.rw_rating} size={17} /></span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-5 items-start">
                <div className="preview-cover-frame">
                  {coverPreview ? (
                    <img src={coverPreview} alt={form.title || 'Book cover'} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-8 h-8" style={{ color: 'var(--color-teal-dark)', opacity: 0.45 }} />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-serif text-2xl font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>{form.title || 'Untitled book'}</h4>
                  <p className="text-sm mt-1 mb-4" style={{ color: 'var(--color-text-muted)' }}>by {form.author || 'Unknown author'}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="preview-pill preview-pill-primary">{form.genre || 'Genre'}</span>
                    <span className="preview-pill preview-pill-primary">{form.language || 'Language'}</span>
                    {splitTraits(form.traits).map((trait) => <span className="preview-pill preview-pill-trait" key={trait}>{trait}</span>)}
                  </div>
                  <div className={`grid gap-3 ${form.amazon_rating.trim() ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
                    <PreviewMetric label="Goodreads" value={form.goodreads_rating || '—'} />
                    {form.amazon_rating.trim() && <PreviewMetric label="Amazon" value={form.amazon_rating} />}
                    <PreviewMetric label="R/W" value={`${form.rw_rating.toFixed(1)} / 10`} accent />
                  </div>
                </div>
              </div>
              <div className="preview-review-block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-teal-dark)' }}>Your review</p>
                <p className="text-sm leading-7 whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{form.review_text || 'Your review will appear here.'}</p>
              </div>
            </div>
          )}

          {/* Edit mode */}
          {editMode && !editExpired && (
            <div className="surface-card p-6 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Edit Your Review</h3>
                <span className="text-sm font-medium" style={{ color: 'var(--color-teal-dark)' }}>{formatTime(editTimeLeft)} left</span>
              </div>
              <SubmitFormFields
                form={form}
                update={update}
                coverPreview={coverPreview}
                coverSource={coverSource}
                fileInputRef={fileInputRef}
                onCoverUpload={handleCoverUpload}
                onCoverUrlChange={(value) => setCoverSource(value.trim() ? 'url' : null)}
                syncAutofill={syncAutofill}
              />
              <div className="flex gap-3">
                <button onClick={handleEditSubmit} disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Saving...' : (<><Save className="w-4 h-4" /> Save Changes</>)}
                </button>
                <button onClick={() => setEditMode(false)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          )}

          {draftMsg && (
            <p className="text-center text-sm" style={{ color: 'var(--color-teal-dark)' }}>{draftMsg}</p>
          )}
          {error && (
            <div className="flex items-start gap-2 p-4 rounded-xl mt-4" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="pt-32 container-prose text-center">
        <div className="w-10 h-10 rounded-full mx-auto mb-4 animate-spin border-2 border-transparent" style={{ borderTopColor: 'var(--color-teal-dark)', borderBottomColor: 'var(--color-teal-dark)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      </div>
    );
  }

  // Auth gate
  if (!user) {
    return (
      <div className="pt-32 container-prose text-center max-w-md mx-auto">
        <PenTool className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
        <h1 className="font-serif text-2xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Sign In Required</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>You need an account to submit a review, but you can read the submission guide without signing in.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => navigate('/review-guidelines')} className="btn-ghost inline-flex items-center gap-2"><FileText className="w-4 h-4" /> Read Review Submission Guide</button>
          <button type="button" onClick={() => navigate('/auth')} className="btn-primary">Sign In / Sign Up</button>
        </div>
      </div>
    );
  }

  // Profile gate — if profile hasn't loaded yet, show loading; if loaded but incomplete, show gate
  if (user && !profile) {
    return (
      <div className="pt-32 container-prose text-center">
        <div className="w-10 h-10 rounded-full mx-auto mb-4 animate-spin border-2 border-transparent" style={{ borderTopColor: 'var(--color-teal-dark)', borderBottomColor: 'var(--color-teal-dark)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading your profile...</p>
      </div>
    );
  }

  if (user && profile && !profile.name) {
    return (
      <div className="pt-32 container-prose text-center max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(245, 158, 11, 0.4)' }} />
        <h1 className="font-serif text-2xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Complete Your Profile</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          You need to add your Name before submitting a review.
        </p>
        <button onClick={() => navigate('/profile')} className="btn-primary">Go to Profile</button>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 container-prose animate-fade-in">
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5" style={{ background: 'rgba(0, 151, 178, 0.1)' }}>
            <PenTool className="w-3.5 h-3.5" style={{ color: 'var(--color-teal-dark)' }} />
            <span className="text-xs font-medium tracking-wide" style={{ color: 'var(--color-teal-dark)' }}>Community Submission</span>
          </div>
          <h1 className="font-serif text-4xl font-semibold mb-3 tracking-tight" style={{ color: 'var(--color-text)' }}>Tell us about the book that broke your brain 🕮</h1>
          <p className="leading-relaxed text-base md:text-lg max-w-xl mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            Skip the essay. Drop your review below. We'll turn your submission into a Novelty Review poster.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button type="button" onClick={() => navigate('/review-guidelines')} className="btn-ghost inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm nl-guide-glow-btn">
              <FileText className="w-4 h-4" /> Review Guidelines
            </button>
            <button id="reserve" type="button" onClick={() => setReservationModalOpen(true)} className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5" style={{ background: 'var(--color-teal-dark)' }}>
              <BookOpen className="w-4 h-4" /> Reserve a Book
            </button>
            <button type="button" onClick={() => void openLoadDraftModal()} className="btn-ghost inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm">
              <Save className="w-4 h-4" /> Load Draft
            </button>
          </div>
          <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>Read the submission guidelines, reserve a book without writing a review, or load one of your saved drafts.</p>
        </div>

        {/* Open Library Search */}
        <div className="surface-card p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Quick Search & Auto-Fill</h3>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Search by title, or title + author, to auto-fill book details, language, traits, and cover image.
          </p>
          <div className="quick-search-row flex gap-2">
            <input
              type="text"
              value={olQuery}
              onChange={(e) => setOlQuery(e.target.value)}
              onBlur={() => setOlQuery((q) => q.trim())}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleOpenLibrarySearch())}
              placeholder="Type a book title (e.g. 1984, Dune, Babel)..."
              className="input-field"
            />
            <button onClick={handleOpenLibrarySearch} disabled={olSearching || olQuery.trim().length < 2} className="btn-ghost whitespace-nowrap">
              {olSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {!olSearching && olQuery.trim().length >= 2 && olResults.length === 0 && (
            <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>No close matches yet. Try the title plus author name.</p>
          )}
          {olResults.length > 0 && (
            <div className="mt-3 space-y-2 animate-fade-in">
              {olResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => fillFromOpenLibrary(r)}
                  className="flex items-center gap-3 w-full text-left p-3 rounded-xl transition-colors hover:bg-[rgba(0,151,178,0.05)]"
                  style={{ border: '1px solid var(--color-border)' }}
                >
                  {r.coverUrl ? (
                    <img src={r.coverUrl} alt={r.title} className="w-10 h-14 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-14 rounded gradient-teal flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-white/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{r.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{r.author}{r.publishYear ? ` · ${r.publishYear}` : ''}{r.language ? ` · ${r.language}` : ''}</p>
                    {r.subjects.length > 0 && <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{r.subjects.slice(0, 3).join(' · ')}</p>}
                  </div>
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Form progress — tracks only the compulsory (*) questions, and
            stays accurate through autofill via syncAutofill on each field. */}
        <div className="surface-card p-4 mb-6 sticky top-20 z-10" style={{ backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              Form Progress
            </span>
            <span className="text-xs font-bold" style={{ color: 'var(--color-teal-dark)' }}>
              {formProgress}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-paper)' }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out gradient-teal"
              style={{ width: `${formProgress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Preview your review details before submitting.</p>
          <button type="button" onClick={() => setPreviewMode((v) => !v)} className="btn-ghost text-sm"><Eye className="w-4 h-4" /> {previewMode ? 'Hide Preview' : 'Preview'}</button>
        </div>
        {previewMode && (
          <div className="live-poster-wrap mb-6 animate-fade-in">
            <div className="live-poster-card">
              <div className="live-poster-cover">
                {coverPreview ? <img src={coverPreview} alt="" /> : <BookOpen className="w-10 h-10" style={{ color: 'rgba(255,255,255,.55)' }} />}
              </div>
              <div className="live-poster-copy">
                <p className="text-[10px] uppercase tracking-[0.24em] font-semibold" style={{ color: 'rgba(255,255,255,.7)' }}>Novelty Review · Live Preview</p>
                <h3 className="font-serif text-2xl md:text-3xl font-semibold mt-2 break-words">{form.title || 'Your Book Title'}</h3>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,.75)' }}>{form.author || 'Author Name'}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="live-poster-pill live-poster-rating"><strong>{rwRatingToStars(form.rw_rating).toFixed(1)}</strong><CalculatedStars value={form.rw_rating} size={12} /></span>
                  {form.genre && <span className="live-poster-pill">{form.genre}</span>}
                  {form.language && <span className="live-poster-pill">{form.language}</span>}
                </div>
                {splitTraits(form.traits).length > 0 && <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,.72)' }}>{splitTraits(form.traits).join(' · ')}</p>}
                <p className="text-sm leading-relaxed mt-4 line-clamp-5" style={{ color: 'rgba(255,255,255,.9)' }}>{form.review_text || 'Your review excerpt will appear here as you write.'}</p>
                <div className="mt-5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.18)' }}><span className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,.65)' }}>novelty.co.in</span></div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/*
            Honeypot spam trap — invisible to sighted users and removed from
            the accessibility tree, so it should never be seen or filled in
            by a real visitor. Off-screen positioning (rather than
            display:none/visibility:hidden) is deliberate: some bots skip
            fields hidden that way, but still fill this one in, while screen
            readers and keyboard navigation (aria-hidden + tabIndex={-1})
            still skip straight past it for real users.
          */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '-9999px',
              top: '-9999px',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
          >
            <input
              type="text"
              id="fax_number"
              name="fax_number"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={faxNumber}
              onChange={(e) => setFaxNumber(e.target.value)}
            />
          </div>

          <SubmitFormFields
            form={form}
            update={update}
            coverPreview={coverPreview}
            coverSource={coverSource}
            fileInputRef={fileInputRef}
            onCoverUpload={handleCoverUpload}
            onCoverUrlChange={(value) => setCoverSource(value.trim() ? 'url' : null)}
            syncAutofill={syncAutofill}
          />

          {duplicateWarning && (
            <div className="advisory-banner">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#b7791f' }} />
              <p className="text-xs" style={{ color: 'var(--color-text)' }}>{duplicateWarning}</p>
            </div>
          )}

          {form.review_text.trim() && (
            <div className="quality-helper">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Review quality helper</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: form.review_text.trim().length >= 100 ? 'var(--color-teal-dark)' : '#ef4444' }}>
                  {form.review_text.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <ul className="space-y-1.5">
                {qualityTips.map((tip) => <li key={tip} className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>• {tip}</li>)}
              </ul>
            </div>
          )}

          {/* Form Rating — love hearts (optional), whole numbers only */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Form Rating (1-10, optional)
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                  const filled = form.rating_integer >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => update('rating_integer', form.rating_integer === n ? 0 : n)}
                      className="relative w-8 h-8 flex items-center justify-center transition-transform hover:scale-110"
                      title={`${n}`}
                    >
                      <Heart
                        className="w-6 h-6 absolute"
                        style={{ color: 'var(--color-border)' }}
                      />
                      {filled && (
                        <Heart
                          className="w-6 h-6"
                          style={{ color: 'var(--color-teal-dark)', fill: 'var(--color-teal-dark)' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              Tap a heart to set a whole-number rating.
            </p>
          </div>

          {/* Heard from (optional) */}
          <OtherSelectField
            label="Where did you hear about Novelty Library?"
            value={form.heard_from}
            options={HEARD_FROM_OPTIONS}
            placeholder="Select"
            otherPlaceholder="Please specify"
            onChange={(value) => update('heard_from', value)}
          />

          {/* Form feedback */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>What changes would you want to see in the form? (optional)</label>
            <textarea
              rows={3}
              value={form.form_feedback}
              onChange={(e) => update('form_feedback', e.target.value)}
              placeholder="Your suggestions here..."
              className="input-field resize-y"
            />
          </div>

          {/* Undertaking */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={form.undertaking_accepted}
                onChange={(e) => update('undertaking_accepted', e.target.checked)}
                className="mt-1 w-5 h-5 rounded accent-teal-600"
              />
              <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                I confirm this review is my original opinion. I understand the R/W Rating reflects my personal view, not a cumulative assessment. I accept the undertaking.
              </span>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-4 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
              <button onClick={() => setError(null)} className="ml-auto" style={{ color: '#ef4444' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? 'Submitting...' : (<><Send className="w-4 h-4" /> Submit Review</>)}
          </button>
        </form>

        <div className="draft-actions flex mt-6">
          <button type="button" onClick={openDraftSaveModal} className="btn-ghost text-sm w-full">
            <Save className="w-4 h-4" /> Save Draft
          </button>
        </div>

        {draftMsg && (
          <p className="text-center text-sm mt-4" style={{ color: 'var(--color-teal-dark)' }}>{draftMsg}</p>
        )}
      </div>


      {loadDraftModalOpen && <div className="fixed inset-0 z-[125] grid place-items-center p-4 bg-black/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="load-draft-title" onClick={() => setLoadDraftModalOpen(false)}>
        <div className="w-full max-w-lg rounded-3xl p-6 shadow-2xl" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 id="load-draft-title" className="font-serif text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Load Draft</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Select one of your saved drafts to bring it back into this form. Up to 5 drafts per account.</p>
            </div>
            <button type="button" onClick={() => setLoadDraftModalOpen(false)} className="p-2 rounded-xl shrink-0" aria-label="Close load draft"><X className="w-5 h-5" /></button>
          </div>
          {orderedDrafts.length === 0 ? (
            <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(0,151,178,.06)', border: '1px solid var(--color-border)' }}>
              <Save className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-teal-dark)', opacity: .7 }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>No saved drafts yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Use the Save Draft button at the bottom of this form to create one.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {orderedDrafts.map((draft, index) => (
                <button key={draft.id} type="button" onClick={() => void handleLoadSelectedDraft(draft.id)} className="w-full text-left rounded-2xl p-4 transition-all hover:-translate-y-0.5" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0 font-semibold text-sm" style={{ background: 'rgba(0,151,178,.1)', color: 'var(--color-teal-dark)' }}>{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>{draft.name}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Saved {new Date(draft.updated_at || draft.created_at).toLocaleString()}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>}

      {draftModalOpen && <div className="fixed inset-0 z-[120] grid place-items-center p-4 bg-black/45 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setDraftModalOpen(false)}>
        <div className="w-full max-w-md rounded-3xl p-6" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4"><div><h2 className="font-serif text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Save Draft</h2><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Up to 5 drafts per account.</p></div><button type="button" onClick={() => setDraftModalOpen(false)}><X className="w-5 h-5" /></button></div>
          <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder={form.title.trim() || `Draft [${Math.min(savedDrafts.length + 1, 5)}]`} className="input-field w-full" autoFocus />
          <div className="flex gap-2 mt-4"><button type="button" onClick={() => setDraftModalOpen(false)} className="btn-ghost flex-1">Cancel</button><button type="button" onClick={() => void confirmSaveDraft()} className="btn-primary flex-1">Save Draft</button></div>
        </div>
      </div>}

      {reservationModalOpen && <div className="fixed inset-0 z-[120] grid place-items-center p-4 bg-black/45 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setReservationModalOpen(false)}>
        <div className="w-full max-w-md rounded-3xl p-6" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4"><div><h2 className="font-serif text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>Reserve a Book</h2><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>No review is required right now.</p></div><button type="button" onClick={() => setReservationModalOpen(false)}><X className="w-5 h-5" /></button></div>
          <div className="space-y-3"><input value={reservationBook} onChange={(e) => setReservationBook(e.target.value)} placeholder="Book name" className="input-field w-full" autoFocus required /><input value={reservationAuthor} onChange={(e) => setReservationAuthor(e.target.value)} placeholder="Author name (optional)" className="input-field w-full" /></div>
          <div className="mt-4 rounded-2xl p-3 text-xs leading-relaxed" style={{ background: 'rgba(0,151,178,.08)', color: 'var(--color-text)' }}><b>Important:</b> An admin must accept your reservation request before the book is reserved. Filling out this window alone does not reserve the book.</div>
          <div className="flex gap-2 mt-4"><button type="button" onClick={() => setReservationModalOpen(false)} className="btn-ghost flex-1">Cancel</button><button type="button" disabled={reservationSubmitting} onClick={() => void submitReservation()} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--color-teal-dark)' }}>{reservationSubmitting ? 'Sending...' : 'Request Reservation'}</button></div>
        </div>
      </div>}
    </div>
  );
}

function SubmitFormFields({
  form, update, coverPreview, coverSource, fileInputRef, onCoverUpload, onCoverUrlChange, syncAutofill,
}: {
  form: FormState;
  update: (field: keyof FormState, value: string | number | boolean) => void;
  coverPreview: string | null;
  coverSource: 'open-library' | 'uploaded' | 'url' | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCoverUrlChange: (value: string) => void;
  syncAutofill: (field: keyof FormState) => (e: React.AnimationEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Cover upload + preview */}
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          {coverPreview ? (
            <img src={coverPreview} alt="Cover preview" className="w-24 h-32 rounded-xl object-cover" />
          ) : (
            <div className="w-24 h-32 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-paper)' }}>
              <BookOpen className="w-8 h-8" style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onCoverUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-ghost text-sm"
          >
            <Upload className="w-4 h-4" /> Upload Cover Image <span className="text-red-500">*</span>
          </button>
          <input
            type="url"
            value={form.cover_image_url}
            onChange={(e) => { const value = e.target.value; update('cover_image_url', value); onCoverUrlChange(value); }}
            placeholder="Or paste image URL (required)"
            className="input-field text-xs"
          />
          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            <span className="cover-source-dot" data-source={coverSource || 'none'} />
            <span>{coverSource === 'open-library' ? 'Catalogue cover · Open Library' : coverSource === 'uploaded' ? 'Your uploaded cover' : coverSource === 'url' ? 'Cover from pasted image URL' : 'Cover image is required'}</span>
          </div>
        </div>
      </div>

      {/* Title + Author */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Book Title *</label>
          <input required type="text" maxLength={150} value={form.title} onChange={(e) => update('title', e.target.value)} onAnimationStart={syncAutofill('title')} placeholder="A Court of Thorns and Roses" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Author *</label>
          <input required type="text" maxLength={100} value={form.author} onChange={(e) => update('author', e.target.value)} onAnimationStart={syncAutofill('author')} placeholder="Sarah J. Maas" className="input-field" />
        </div>
      </div>

      {/* Genre + Language (compulsory) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OtherSelectField
          label="Genre" required value={form.genre} options={GENRES}
          placeholder="Select" otherPlaceholder="Enter genre"
          onChange={(value) => update('genre', value)}
        />
        <OtherSelectField
          label="Language" required value={form.language} options={LANGUAGES}
          placeholder="Select" otherPlaceholder="Enter language"
          onChange={(value) => update('language', value)}
        />
      </div>

      {/* Series name + number (optional) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Series Name (optional)</label>
          <input type="text" value={form.series_name} onChange={(e) => update('series_name', e.target.value)} placeholder="ACOTAR Series" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Series Number (optional)</label>
          <input type="number" min="1" value={form.series_number} onChange={(e) => update('series_number', e.target.value)} placeholder="1" className="input-field" />
        </div>
      </div>

      {/* Translated in (optional) */}
      <OtherSelectField
        label="Translated In (optional)"
        value={form.translated_from}
        options={LANGUAGES}
        placeholder="Select"
        otherPlaceholder="Enter language"
        onChange={(value) => update('translated_from', value)}
      />

      {/* Traits (compulsory, 1–5) */}
      <TraitsField value={form.traits} onChange={(value) => update('traits', value)} />

      {/* Review text */}
      <ReviewTextField value={form.review_text} onChange={(value) => update('review_text', value)} />

      {/* Ratings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>R/W Rating (out of 10) *</label>
          <div className="flex items-center gap-3">
            <input type="range" min="0" max="10" step="0.1" value={form.rw_rating} onChange={(e) => update('rw_rating', Number(e.target.value))} className="flex-1 rw-range" />
            <div className="rw-rating-badge">
              <Star className="w-3.5 h-3.5" fill="currentColor" />{form.rw_rating.toFixed(1)}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg w-fit" style={{ background: 'var(--color-paper)' }}>
            <span className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Manual</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={form.rw_rating}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (Number.isNaN(raw)) return;
                const clamped = Math.min(10, Math.max(0, Math.round(raw * 10) / 10));
                update('rw_rating', clamped);
              }}
              className="w-16 text-sm font-bold bg-transparent outline-none"
              style={{ color: 'var(--color-teal-dark)' }}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Goodreads (max 5) *</label>
          <input
            required type="number" min="0" max="5" step="0.01"
            value={form.goodreads_rating}
            onChange={(e) => update('goodreads_rating', e.target.value)}
            onAnimationStart={syncAutofill('goodreads_rating')}
            placeholder="4.2"
            className={`input-field ${Number(form.goodreads_rating) > 5 ? 'input-error' : ''}`}
          />
          {Number(form.goodreads_rating) > 5 && (
            <p className="field-error">Goodreads rating cannot exceed 5.</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Amazon (max 5, optional)</label>
          <input
            type="number" min="0" max="5" step="0.01"
            value={form.amazon_rating}
            onChange={(e) => update('amazon_rating', e.target.value)}
            placeholder="4.5"
            className={`input-field ${Number(form.amazon_rating) > 5 ? 'input-error' : ''}`}
          />
          {Number(form.amazon_rating) > 5 && (
            <p className="field-error">Amazon rating cannot exceed 5.</p>
          )}
        </div>
      </div>

      {/* Review date + buy link */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Review Date (optional)</label>
          <input type="date" value={form.review_date} onChange={(e) => update('review_date', e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Buy Link (optional)</label>
          <input type="url" value={form.buy_link} onChange={(e) => update('buy_link', e.target.value)} placeholder="https://amazon.in/dp/..." className={`input-field ${form.buy_link.trim() && !isValidHttpUrl(form.buy_link.trim()) ? 'input-error' : ''}`} />
          {form.buy_link.trim() && !isValidHttpUrl(form.buy_link.trim()) && <p className="field-error">Enter a valid http:// or https:// link.</p>}
        </div>
      </div>
    </div>
  );
}

function ReviewTextField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const chars = value.length;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const readSeconds = Math.max(1, Math.ceil((words / 240) * 60));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Your Review *</label>
      </div>
      <textarea
        required
        minLength={100}
        maxLength={2000}
        rows={7}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What broke your brain about this book? A few honest lines is enough."
        className="input-field resize-y leading-relaxed"
      />
      <div className="flex items-center justify-between gap-4 mt-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        <span>~{readSeconds} sec read</span>
        <span className={chars >= 100 ? 'review-char-ok' : 'review-char-error'}>{chars} / 100–2000 characters</span>
      </div>
    </div>
  );
}

function OtherSelectField({
  label,
  value,
  options,
  placeholder,
  otherPlaceholder,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  otherPlaceholder: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [otherMode, setOtherMode] = useState(() => Boolean(value) && !options.includes(value));
  const isOther = otherMode || (Boolean(value) && !options.includes(value));
  const knownValue = isOther ? 'Other' : (options.includes(value) ? value : '');

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {label}{required ? ' *' : ''}
      </label>
      <select
        required={required && !isOther}
        value={knownValue}
        onChange={(e) => {
          if (e.target.value === 'Other') {
            setOtherMode(true);
            onChange('');
          } else {
            setOtherMode(false);
            onChange(e.target.value);
          }
        }}
        className={`input-field select-cyan ${!knownValue ? 'select-placeholder' : ''} ${isOther ? 'select-cyan-active' : ''}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {isOther && (
        <div className="mt-2 animate-fade-in">
          <input
            required={required}
            type="text"
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={otherPlaceholder}
            className="input-field other-input-glow"
          />
        </div>
      )}
    </div>
  );
}

function TraitsField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const traits = splitTraits(value);
  const [draft, setDraft] = useState('');
  const atLimit = traits.length >= 5;

  const setTraits = (next: string[]) => onChange(next.slice(0, 5).join(', '));

  const addTrait = () => {
    const next = draft.trim();
    if (!next || atLimit) return;
    if (traits.some((trait) => trait.toLowerCase() === next.toLowerCase())) {
      setDraft('');
      return;
    }
    setTraits([...traits, next]);
    setDraft('');
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
          Traits *
        </label>
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>{traits.length}/5</span>
      </div>
      <div className="traits-box">
        <div className="flex flex-wrap gap-2 min-h-8">
          {traits.map((trait) => (
            <span key={trait} className="trait-chip">
              {trait}
              <button
                type="button"
                aria-label={`Remove ${trait}`}
                onClick={() => setTraits(traits.filter((item) => item !== trait))}
                className="trait-remove"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
          {traits.length === 0 && (
            <span className="text-sm py-1" style={{ color: 'var(--color-text-muted)' }}>Add at least one trait</span>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={draft}
            disabled={atLimit}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTrait();
              }
            }}
            placeholder={atLimit ? 'Maximum 5 traits reached' : 'e.g. Emotional, Plot Twist'}
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={addTrait}
            disabled={!draft.trim() || atLimit}
            className="trait-add-button"
            aria-label="Add trait"
            title="Add trait"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>
      <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>Add 1 to 5 traits. Press Enter or Add after each one.</p>
    </div>
  );
}

function PreviewMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`preview-metric${accent ? ' preview-metric-accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

