export interface Review {
  id: string;
  slug: string;
  title: string;
  author: string;
  genre: string;
  traits: string | null;
  language: string;
  review_text: string;
  rw_rating: number;
  goodreads_rating: number | null;
  reviewer_handle: string | null;
  cover_image_url: string | null;
  cover_storage_path: string | null;
  poster_url: string | null;
  poster_link: string | null;
  published_on: string | null;
  buy_link: string | null;
  labels: string[];
  published_at: string;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'approved' | 'declined';
  is_published: boolean;
  admin_notes: string | null;
  series_name: string | null;
  series_number: number | null;
  translated_from: string | null;
  amazon_rating: number | null;
  review_date: string | null;
  heard_from: string | null;
  form_feedback: string | null;
  rating_integer: number | null;
  undertaking_accepted: boolean;
  user_id: string | null;
  master_review_no: string | null;
  review_number: number | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  novelty_username: string | null;
  favorite_book: string | null;
  books_read_this_month: number | null;
  total_books_read: number | null;
  reading_since: number | null;
  favorite_author: string | null;
  favorite_genre: string | null;
  /** Reviewer verdict; null for legacy reviews. */
  verdict?: 'perfection' | 'go_for_it' | 'timepass' | null;
}

export interface Profile {
  id: string;
  instagram_id: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  header_image_url?: string | null;
  social_links?: { platform: string; url: string }[];
  profile_answers?: Record<string, unknown>;
  website: string | null;
  novelty_username: string | null;
  favorite_book: string | null;
  books_read_this_month: number | null;
  total_books_read: number | null;
  reading_since: number | null;
  favorite_author: string | null;
  favorite_genre: string | null;
  created_at: string;
  updated_at: string;
  hide_followers?: boolean;
  hide_following?: boolean;
  profile_visibility?: Record<string, boolean>;
  /** Advanced Reader question keys shown as Q&A on the profile card (max 5). */
  selected_question_ids?: string[];
  /** Advanced Reader question keys shown as tags on the profile card (max 3). */
  profile_display_tags?: string[];
}

export interface ReviewDraft {
  id: string;
  user_id: string;
  name: string;
  draft_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ReviewStatus = 'pending' | 'approved' | 'declined';
