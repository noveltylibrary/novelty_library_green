import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { summarizeReviews, type PeopleStats } from '@/lib/authors';
import type { Review } from '@/types/review';

/** One row per published review from public_reviewer_index() (NL_SQL_200). Never contains an e-mail address. */
export interface ReviewerIndexRow {
  review_no: string;
  reviewer_uid: string | null;
  novelty_username: string | null;
  reviewer_name: string | null;
  has_account: boolean;
}

let indexPromise: Promise<ReviewerIndexRow[]> | null = null;
let indexAt = 0;
/** Shared, cached for a few minutes. Resolves to [] when the SQL has not been run (reviewer pages stay hidden). */
export function loadReviewerIndex(): Promise<ReviewerIndexRow[]> {
  if (!indexPromise || Date.now() - indexAt > 5 * 60_000) {
    indexAt = Date.now();
    indexPromise = Promise.resolve(supabase.rpc('public_reviewer_index')).then(({ data, error }) => (error ? [] : ((data ?? []) as ReviewerIndexRow[]))).catch(() => []);
  }
  return indexPromise;
}

export function useReviewerIndex(): ReviewerIndexRow[] {
  const [rows, setRows] = useState<ReviewerIndexRow[]>([]);
  useEffect(() => {
    let alive = true;
    void loadReviewerIndex().then((r) => { if (alive) setRows(r); });
    return () => { alive = false; };
  }, []);
  return rows;
}

export const reviewNoOf = (r: Review): string => String(r.master_review_no ?? r.review_number ?? '');

export interface ReviewerProfile extends PeopleStats {
  uid: string;
  name: string;
  username: string | null;
  hasAccount: boolean;
  reviews: Review[];
}

/** Public path: account holders go to their @username profile, everyone else to /reviewer/<id>. */
export const reviewerPath = (p: { uid: string; username: string | null; hasAccount: boolean }): string =>
  p.hasAccount && p.username ? `/profile/@${encodeURIComponent(p.username.replace(/^@/, ''))}` : `/reviewer/${encodeURIComponent(p.uid)}`;

/** Short, readable form of the unique ID (first 8 hex characters, upper-case). */
export const shortReviewerId = (uid: string): string => uid.replace(/-/g, '').slice(0, 8).toUpperCase();

/** Groups published reviews by the reviewer's unique ID. */
export function buildReviewerProfiles(all: Review[], rows: ReviewerIndexRow[]): ReviewerProfile[] {
  const byNo = new Map(rows.filter((r) => r.reviewer_uid).map((r) => [String(r.review_no), r]));
  const groups = new Map<string, { row: ReviewerIndexRow; reviews: Review[] }>();
  for (const review of all) {
    const row = byNo.get(reviewNoOf(review));
    if (!row?.reviewer_uid) continue;
    const g = groups.get(row.reviewer_uid);
    if (g) { g.reviews.push(review); if (!g.row.novelty_username && row.novelty_username) g.row = row; }
    else groups.set(row.reviewer_uid, { row, reviews: [review] });
  }
  return [...groups.entries()].map(([uid, { row, reviews }]) => {
    const sorted = [...reviews].sort((a, b) => (b.rw_rating || 0) - (a.rw_rating || 0));
    const name = (row.reviewer_name || sorted.find((r) => r.reviewer_name)?.reviewer_name || row.novelty_username || 'Novelty Reader').trim();
    return { uid, name, username: row.novelty_username, hasAccount: row.has_account, reviews: sorted, ...summarizeReviews(sorted) };
  });
}

/** Reviewer profile for one uid (also memoised for pages that only need a single reviewer). */
export function useReviewerProfile(all: Review[], uid: string): { profile: ReviewerProfile | null; ready: boolean } {
  const rows = useReviewerIndex();
  return useMemo(() => ({ profile: buildReviewerProfiles(all, rows).find((p) => p.uid === uid) ?? null, ready: rows.length > 0 && all.length > 0 }), [all, rows, uid]);
}
