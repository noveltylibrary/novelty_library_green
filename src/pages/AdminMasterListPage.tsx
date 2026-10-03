import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Search, ExternalLink, Table2, Plus,
  Trash2, Save, X, Check, AlertCircle, RotateCw, ChevronLeft, ChevronRight,
  LayoutGrid, Database, RefreshCw, BookOpen, Star, User,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// This is only kept as an optional "peek at the original" reference link —
// the Table/Cards views below are the actual place to add, edit and delete
// entries. They're backed by Supabase directly, so nothing here ever
// requires opening Google Sheets.
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/14PSrS1Jve37kI_3eNEr-9IojbzhyaLFEU3iqMRtiI-Q/edit';
const SHEET_IMPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheet-proxy?action=import`;
const SHEET_CLEANUP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheet-proxy?action=cleanup-junk`;

// v3.1: the sheet-proxy Edge Function is admin-only. It must receive the
// signed-in admin's own JWT (never the public anon key).
async function adminFunctionHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Your session has expired — please sign in again.');
  return { Authorization: `Bearer ${token}` };
}

// Derive the Supabase project ref from the project URL (e.g.
// "https://lcnbsmoezfkaowcmjbeu.supabase.co" -> "lcnbsmoezfkaowcmjbeu") so we
// can link straight into the Supabase dashboard's table editor for this
// project's master_list table — no separate setup needed.
const SUPABASE_PROJECT_REF = (import.meta.env.VITE_SUPABASE_URL as string || '')
  .replace('https://', '')
  .split('.')[0];
const SUPABASE_TABLE_EDITOR_URL = SUPABASE_PROJECT_REF
  ? `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/editor`
  : 'https://supabase.com/dashboard';

interface MasterRow {
  id: string;
  review_no: string;
  timestamp: string;
  name: string;
  email: string;
  novelty_username: string;
  contact_required: string;
  instagram: string;
  website: string;
  book_title: string;
  author: string;
  genre: string;
  series: string;
  book_number: string;
  language: string;
  translated_in: string;
  reviewers_rating: string;
  goodreads_rating: string;
  amazon_rating: string;
  traits: string;
  book_cover: string;
  review: string;
  amazon_link: string;
  review_date: string;
  heard_from: string;
  agreement: string;
  form_rating: string;
  suggestions: string;
  status: string;
  blogger_draft: string;
  // Position within the Google Sheet as of the last sync (1-based), used
  // purely for ordering — see fetchRows below. Null for rows added by hand
  // in this table rather than imported from the sheet.
  sheet_row_index: number | null;
}

type ColumnKey = keyof Omit<MasterRow, 'id' | 'sheet_row_index'>;
type Draft = Omit<MasterRow, 'id' | 'sheet_row_index'>;

const COLUMNS: { key: ColumnKey; label: string; width: number }[] = [
  { key: 'review_no', label: 'Review No.', width: 90 },
  { key: 'timestamp', label: 'Timestamp', width: 130 },
  { key: 'name', label: 'Name', width: 120 },
  { key: 'email', label: 'Email', width: 180 },
  { key: 'novelty_username', label: 'Novelty Username', width: 140 },
  { key: 'instagram', label: 'Instagram', width: 140 },
  { key: 'website', label: 'Website', width: 120 },
  { key: 'book_title', label: 'Book Title', width: 180 },
  { key: 'author', label: 'Author', width: 140 },
  { key: 'genre', label: 'Genre', width: 100 },
  { key: 'series', label: 'Series', width: 100 },
  { key: 'book_number', label: 'Book #', width: 60 },
  { key: 'language', label: 'Language', width: 80 },
  { key: 'translated_in', label: 'Translated In', width: 90 },
  { key: 'reviewers_rating', label: 'R/W Rating', width: 80 },
  { key: 'goodreads_rating', label: 'Goodreads', width: 80 },
  { key: 'amazon_rating', label: 'Amazon', width: 70 },
  { key: 'traits', label: 'Traits', width: 160 },
  { key: 'book_cover', label: 'Cover URL', width: 120 },
  { key: 'review', label: 'Review', width: 280 },
  { key: 'amazon_link', label: 'Amazon Link', width: 120 },
  { key: 'review_date', label: 'Review Date', width: 90 },
  { key: 'heard_from', label: 'Heard From', width: 100 },
  { key: 'status', label: 'Status', width: 80 },
];

const EMPTY_ROW: Draft = {
  review_no: '', timestamp: '', name: '', email: '', novelty_username: '', contact_required: '',
  instagram: '', website: '', book_title: '', author: '', genre: '',
  series: '', book_number: '', language: '', translated_in: '',
  reviewers_rating: '', goodreads_rating: '', amazon_rating: '',
  traits: '', book_cover: '', review: '', amazon_link: '',
  review_date: '', heard_from: '', agreement: '', form_rating: '',
  suggestions: '', status: '', blogger_draft: '',
};

// Row Validation Guardrail: a genuine row's Review No. is always either
// blank (a hand-added row that hasn't been assigned a number yet) or a
// plain positive integer. If it's anything else — letters, punctuation, a
// stray fragment of review text — this row's columns are shifted (the
// fingerprint of a row shredded by a parsing bug upstream) and it must
// never render, even if it made it into Supabase. `id` is also required so
// a row can never render without something stable to key edits/deletes off
// of.
function isValidRow(row: MasterRow): boolean {
  if (!row.id) return false;
  const reviewNo = (row.review_no ?? '').trim();
  return reviewNo === '' || /^\d+$/.test(reviewNo);
}

// Defense in depth: normalize "smart"/curly quotes (what phones and Word's
// autocorrect substitute for straight ones) down to plain ASCII quotes, and
// collapse any literal backslash-quote sequences someone typed by hand.
// This keeps every saved field made of ordinary text characters with no
// special meaning to any delimited format this data might pass through
// again (e.g. a future CSV export), even though Supabase itself stores it
// safely as JSON regardless.
function sanitizeText(value: string): string {
  return value
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/\\"/g, '"');
}

function sanitizeDraft(draft: Draft): Draft {
  const next = { ...draft };
  for (const key of Object.keys(next) as ColumnKey[]) {
    next[key] = sanitizeText(next[key] ?? '');
  }
  return next;
}

interface MasterListPageProps {
  navigate: (path: string) => void;
  embedded?: boolean;
}

export function AdminMasterListPage({ navigate, embedded = false }: MasterListPageProps) {
  const { isAdmin, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: ColumnKey } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [page, setPage] = useState(0);
  const [showAllCols, setShowAllCols] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [rowDraft, setRowDraft] = useState<Draft>(EMPTY_ROW);
  const pageSize = 25;
  const editRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Order by sheet_row_index first (the row's actual position in the
      // Google Sheet, assigned during sync) so the table always renders in
      // exactly the sheet's own order. created_at is only a fallback
      // tiebreak, for rows added by hand in this table (sheet_row_index is
      // null for those, and Postgres sorts nulls last here).
      const { data, error: fetchError } = await supabase
        .from('master_list')
        .select('*')
        .order('sheet_row_index', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (fetchError) throw fetchError;
      const sorted = ((data ?? []) as MasterRow[]).sort((a, b) => {
        const an = Number.parseInt((a.review_no ?? '').trim(), 10);
        const bn = Number.parseInt((b.review_no ?? '').trim(), 10);
        const aValid = Number.isFinite(an);
        const bValid = Number.isFinite(bn);
        if (aValid && bValid) return bn - an;
        if (aValid) return -1;
        if (bValid) return 1;
        return String(b.review_no ?? '').localeCompare(String(a.review_no ?? ''));
      });
      setRows(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Pulls the Google Sheet and reconciles master_list against it: new
  // review numbers get inserted, and review numbers already present get
  // their fields brought back in sync with the sheet. Only ever runs when
  // the admin explicitly clicks "Sync Now" — this used to also run
  // silently on page load and again every 45s, which made the whole admin
  // panel feel like it was constantly auto-refreshing out from under
  // whoever was working in it. Now it runs only on demand.
  const syncFromSheet = useCallback(async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(SHEET_IMPORT_URL, {
        headers: await adminFunctionHeaders(),
      });
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
      const result = await res.json();
      setLastSynced(new Date());
      const parts: string[] = [];
      if (result.imported > 0) parts.push(`${result.imported} new`);
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      if (parts.length > 0) {
        setSyncMsg(`Synced with sheet (${result.totalInSheet} rows in sheet): ${parts.join(', ')}${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`);
      } else {
        setSyncMsg(`Already up to date — ${result.totalInSheet} rows in sheet, all match Supabase${result.skipped > 0 ? ` (${result.skipped} skipped)` : ''}`);
      }
      await fetchRows();
      setTimeout(() => setSyncMsg(null), 8000);
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [fetchRows]);

  // One-off (repeatable) fix for rows that got imported before the
  // book_title/author guard existed — removes any master_list row that has
  // neither a title nor an author, which is the signature left behind by a
  // stray un-escaped quote character in the sheet breaking CSV structure
  // for one field (see the sheet-proxy parser for the full explanation).
  const cleanupJunk = async () => {
    if (!confirm('This permanently deletes any row that has both an empty Book Title and an empty Author — the pattern left behind by the CSV-shredding bug. Real reviews are never affected. Continue?')) return;
    setCleaningUp(true);
    setSyncMsg(null);
    try {
      const res = await fetch(SHEET_CLEANUP_URL, {
        headers: await adminFunctionHeaders(),
      });
      if (!res.ok) throw new Error(`Cleanup failed (${res.status})`);
      const result = await res.json();
      setSyncMsg(result.deleted > 0 ? `Removed ${result.deleted} broken row(s)` : 'No broken rows found');
      setTimeout(() => setSyncMsg(null), 4000);
      await fetchRows();
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Cleanup failed');
    } finally {
      setCleaningUp(false);
    }
  };

  // Loads whatever is already in Supabase the moment the page opens. This
  // does NOT talk to the Google Sheet — that only happens when the admin
  // clicks "Sync Now" below.
  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;
    fetchRows();
  }, [authLoading, isAdmin, fetchRows]);

  // Row Validation Guardrail: rows.length can include stray, shifted rows
  // already sitting in Supabase from before this fix (or from any future
  // hiccup upstream) — filter those out before they ever reach the table
  // or card views. `rows` itself is left untouched so save/dirty tracking
  // still works against the real underlying data.
  const validRows = useMemo(() => rows.filter(isValidRow), [rows]);
  const invalidRowCount = rows.length - validRows.length;

  const filtered = useMemo(() => {
    if (!search.trim()) return validRows;
    const q = search.toLowerCase();
    return validRows.filter((r) =>
      r.book_title.toLowerCase().includes(q) ||
      r.author.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.genre.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.instagram.toLowerCase().includes(q) ||
      r.review_no.toLowerCase().includes(q)
    );
  }, [validRows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const visibleColumns = showAllCols
    ? COLUMNS
    : COLUMNS.filter((c) => !['contact_required', 'agreement', 'form_rating', 'suggestions', 'blogger_draft', 'website', 'translated_in', 'book_number'].includes(c.key));

  // ---- Table view (cell-by-cell editing) ----

  const startEdit = (rowId: string, col: ColumnKey, currentValue: string) => {
    setEditingCell({ rowId, col });
    setEditValue(currentValue || '');
    setTimeout(() => {
      if (editRef.current) {
        editRef.current.focus();
        editRef.current.select();
      }
    }, 0);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { rowId, col } = editingCell;
    const sanitized = sanitizeText(editValue);
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, [col]: sanitized } : r
      )
    );
    setDirtyRows((prev) => new Set(prev).add(rowId));
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveRow = async (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const { id, ...updates } = row;
      void id;
      const { error: updateError } = await supabase
        .from('master_list')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', rowId);
      if (updateError) throw updateError;
      setDirtyRows((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      setSaveMsg('Row saved');
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save row');
    } finally {
      setSaving(false);
    }
  };

  const saveAllDirty = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const dirtyIds = Array.from(dirtyRows);
      for (const rowId of dirtyIds) {
        const row = rows.find((r) => r.id === rowId);
        if (!row) continue;
        const { id, ...updates } = row;
        void id;
        const { error: updateError } = await supabase
          .from('master_list')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', rowId);
        if (updateError) throw updateError;
      }
      setDirtyRows(new Set());
      setSaveMsg(`Saved ${dirtyIds.length} row(s)`);
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // ---- Cards view (whole-row editing) ----

  const startCardEdit = (row: MasterRow) => {
    const { id, sheet_row_index, ...rest } = row;
    void id;
    void sheet_row_index;
    setRowDraft(rest);
    setEditingRowId(row.id);
  };

  const cancelCardEdit = () => {
    setEditingRowId(null);
    setRowDraft(EMPTY_ROW);
  };

  // Switching Table <-> Cards used to leave an in-progress card edit
  // dangling in memory (neither saved nor discarded), which could make a
  // row look inconsistent until the page was reloaded. Now, switching away
  // from Cards while something is mid-edit always cleanly discards that
  // draft first, with a clear message — never a silent half-state.
  const changeView = (mode: 'table' | 'cards') => {
    if (editingRowId) {
      const editedRow = rows.find((r) => r.id === editingRowId);
      cancelCardEdit();
      setSaveMsg(`Discarded unsaved changes to "${editedRow?.book_title || editedRow?.review_no || 'that entry'}" — click Save next time before switching views.`);
      setTimeout(() => setSaveMsg(null), 5000);
    }
    setViewMode(mode);
  };

  const saveCardEdit = async () => {
    if (!editingRowId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const cleanDraft = sanitizeDraft(rowDraft);
      const { error: updateError } = await supabase
        .from('master_list')
        .update({ ...cleanDraft, updated_at: new Date().toISOString() })
        .eq('id', editingRowId);
      if (updateError) throw updateError;
      setRows((prev) => prev.map((r) => (r.id === editingRowId ? { ...r, ...cleanDraft } : r)));
      setEditingRowId(null);
      setRowDraft(EMPTY_ROW);
      setSaveMsg('Entry saved');
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  // ---- Shared: add / delete ----

  const addRow = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const { data, error: insertError } = await supabase
        .from('master_list')
        .insert(EMPTY_ROW)
        .select()
        .single();
      if (insertError) throw insertError;
      const newRow = data as MasterRow;
      setRows((prev) => [...prev, newRow]);
      setSaveMsg('New row added');
      setTimeout(() => setSaveMsg(null), 2000);
      if (viewMode === 'cards') startCardEdit(newRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add row');
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (rowId: string) => {
    if (!confirm('Delete this row permanently?')) return;
    try {
      const { error: deleteError } = await supabase
        .from('master_list')
        .delete()
        .eq('id', rowId);
      if (deleteError) throw deleteError;
      setRows((prev) => prev.filter((r) => r.id !== rowId));
      setDirtyRows((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      if (editingRowId === rowId) cancelCardEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete row');
    }
  };

  if (!authLoading && !isAdmin) {
    return (
      <div className="pt-32 container-prose text-center">
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Admin access required.</p>
        <button onClick={() => navigate('/admin')} className="btn-primary">Back to Admin</button>
      </div>
    );
  }

  return (
    <div className={embedded ? 'animate-fade-in' : 'pt-24 pb-20 container-prose animate-fade-in'}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          {!embedded && (
            <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1.5 text-sm mb-3 transition-colors" style={{ color: 'var(--color-text-muted)' }}>
              <ArrowLeft className="w-4 h-4" /> Admin Dashboard
            </button>
          )}
          <div className="flex items-center gap-2">
            <Table2 className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} />
            <h1 className="font-serif text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>Accepted Reviews List</h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {rows.length > 0 ? `${filtered.length} entries — fully editable, backed by Supabase` : 'Editable list — click "Sync Now" to pull entries from the sheet'}
            {lastSynced && (
              <span style={{ opacity: 0.6 }}> · last synced with sheet {lastSynced.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <button
              onClick={() => changeView('table')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
              style={{
                background: viewMode === 'table' ? 'var(--color-teal-dark)' : 'var(--color-surface)',
                color: viewMode === 'table' ? 'white' : 'var(--color-text-muted)',
              }}
            >
              <Table2 className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => changeView('cards')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
              style={{
                background: viewMode === 'cards' ? 'var(--color-teal-dark)' : 'var(--color-surface)',
                color: viewMode === 'cards' ? 'white' : 'var(--color-text-muted)',
              }}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
          </div>
          <button onClick={() => syncFromSheet()} disabled={syncing} className="btn-ghost text-sm" title="Pull the Google Sheet and reconcile Supabase with it now — only runs when you click this">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button onClick={cleanupJunk} disabled={cleaningUp} className="btn-ghost text-sm" style={{ color: '#ef4444' }} title="Remove broken rows left behind by the CSV-shredding bug (no book title and no author)">
            <Trash2 className="w-4 h-4" /> {cleaningUp ? 'Cleaning...' : 'Clean Up Junk Rows'}
          </button>
          <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm" title="View the original Google Sheet (read-only reference)">
            <ExternalLink className="w-4 h-4" /> View Sheet
          </a>
          <a href={SUPABASE_TABLE_EDITOR_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm" title="Open the master_list table directly in the Supabase dashboard">
            <Database className="w-4 h-4" /> Open in Supabase
          </a>
          {dirtyRows.size > 0 && viewMode === 'table' && (
            <button onClick={saveAllDirty} disabled={saving} className="btn-primary text-sm">
              <Save className="w-4 h-4" /> Save All ({dirtyRows.size})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#ef4444' }} />
          <p className="text-sm flex-1" style={{ color: '#ef4444' }}>{error}</p>
          <button onClick={() => setError(null)} style={{ color: '#ef4444' }}><X className="w-4 h-4" /></button>
        </div>
      )}

      {saveMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: 'rgba(53, 211, 217, 0.08)', border: '1px solid rgba(53, 211, 217, 0.2)' }}>
          <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-teal-dark)' }} />
          <p className="text-sm" style={{ color: 'var(--color-teal-dark)' }}>{saveMsg}</p>
        </div>
      )}

      {invalidRowCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#ef4444' }} />
          <p className="text-sm flex-1" style={{ color: '#ef4444' }}>
            {invalidRowCount} row{invalidRowCount === 1 ? '' : 's'} hidden — corrupted "Review No." (text where a number should be). Run "Clean Up Junk Rows" to remove them permanently.
          </p>
        </div>
      )}

      {syncMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: 'rgba(0, 151, 178, 0.08)', border: '1px solid rgba(0, 151, 178, 0.2)' }}>
          <RefreshCw className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-teal-dark)' }} />
          <p className="text-sm" style={{ color: 'var(--color-teal-dark)' }}>{syncMsg}</p>
          <button onClick={() => setSyncMsg(null)} style={{ color: 'var(--color-teal-dark)' }}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search title, author, name, genre..."
            className="input-field pl-10"
          />
        </div>
        {viewMode === 'table' && (
          <button
            onClick={() => setShowAllCols(!showAllCols)}
            className="btn-ghost text-xs whitespace-nowrap"
            style={{ padding: '8px 12px' }}
          >
            {showAllCols ? 'Hide Extra Columns' : 'Show All Columns'}
          </button>
        )}
        <button onClick={fetchRows} disabled={loading} className="btn-ghost text-xs whitespace-nowrap" style={{ padding: '8px 12px' }}>
          <RotateCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <button onClick={addRow} disabled={saving} className="btn-primary text-xs whitespace-nowrap" style={{ padding: '8px 12px' }}>
          <Plus className="w-3.5 h-3.5" /> Add Row
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--color-paper)' }} />
          ))}
        </div>
      )}

      {!loading && viewMode === 'table' && (
        <>
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto" style={{ maxHeight: '65vh' }}>
              <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead className="sticky top-0 z-20">
                  <tr style={{ background: 'var(--color-paper)' }}>
                    <th style={{ width: 50, minWidth: 50 }} className="text-center px-2 py-2 border-b-2" >
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Edit</span>
                    </th>
                    {visibleColumns.map((col) => (
                      <th
                        key={col.key}
                        className="text-left px-3 py-2 font-semibold whitespace-nowrap border-b-2"
                        style={{ color: 'var(--color-text)', width: col.width, minWidth: col.width, borderColor: 'var(--color-border)' }}
                      >
                        <span className="text-xs">{col.label}</span>
                      </th>
                    ))}
                    <th style={{ width: 50, minWidth: 50 }} className="text-center px-2 py-2 border-b-2">
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Del</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={visibleColumns.length + 2} className="text-center py-12">
                        <Table2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-text-muted)', opacity: 0.2 }} />
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          No entries yet. Click "Sync Now" to pull entries from the Google Sheet, or "Add Row" to create one manually.
                        </p>
                      </td>
                    </tr>
                  )}
                  {pageRows.map((row, rowIdx) => (
                    <tr
                      key={row.id}
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: dirtyRows.has(row.id) ? 'rgba(245, 158, 11, 0.04)' : rowIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                      }}
                    >
                      <td className="text-center px-2 py-1">
                        {dirtyRows.has(row.id) ? (
                          <button
                            onClick={() => saveRow(row.id)}
                            disabled={saving}
                            className="p-1 rounded transition-colors"
                            style={{ background: 'rgba(53, 211, 217, 0.1)', color: 'var(--color-teal-dark)' }}
                            title="Save this row"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)', opacity: 0.3 }}>
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                      {visibleColumns.map((col) => {
                        const isEditing = editingCell?.rowId === row.id && editingCell?.col === col.key;
                        const value = row[col.key];
                        return (
                          <td
                            key={col.key}
                            className="px-3 py-1 cursor-text"
                            style={{ minWidth: col.width, maxWidth: col.width }}
                            onClick={() => !isEditing && startEdit(row.id, col.key, value)}
                          >
                            {isEditing ? (
                              col.key === 'review' ? (
                                <textarea
                                  ref={editRef as React.RefObject<HTMLTextAreaElement>}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') cancelEdit();
                                    if (e.key === 'Enter' && e.ctrlKey) commitEdit();
                                  }}
                                  className="w-full text-xs p-1 rounded outline-none resize-y"
                                  style={{
                                    background: 'var(--color-bg)',
                                    border: '2px solid var(--color-teal-dark)',
                                    minHeight: '60px',
                                    color: 'var(--color-text)',
                                  }}
                                  rows={3}
                                />
                              ) : (
                                <input
                                  ref={editRef as React.RefObject<HTMLInputElement>}
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') cancelEdit();
                                    if (e.key === 'Enter') commitEdit();
                                  }}
                                  className="w-full text-xs p-1 rounded outline-none"
                                  style={{
                                    background: 'var(--color-bg)',
                                    border: '2px solid var(--color-teal-dark)',
                                    color: 'var(--color-text)',
                                  }}
                                />
                              )
                            ) : (
                              renderCellValue(value, col.key)
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center px-2 py-1">
                        <button
                          onClick={() => deleteRow(row.id)}
                          className="p-1 rounded transition-colors hover:bg-red-50"
                          style={{ color: 'rgba(239, 68, 68, 0.4)' }}
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            filteredCount={filtered.length}
            setPage={setPage}
          />
        </>
      )}

      {!loading && viewMode === 'cards' && (
        <>
          {pageRows.length === 0 ? (
            <div className="surface-card text-center py-16">
              <LayoutGrid className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-text-muted)', opacity: 0.2 }} />
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                No entries yet. Click "Sync Now" to pull entries from the Google Sheet, or "Add Row" to create one manually.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pageRows.map((row) =>
                editingRowId === row.id ? (
                  <CardEditor
                    key={row.id}
                    draft={rowDraft}
                    setDraft={setRowDraft}
                    onSave={saveCardEdit}
                    onCancel={cancelCardEdit}
                    onDelete={() => deleteRow(row.id)}
                    saving={saving}
                  />
                ) : (
                  <CardView key={row.id} row={row} onEdit={() => startCardEdit(row)} onDelete={() => deleteRow(row.id)} />
                )
              )}
            </div>
          )}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            filteredCount={filtered.length}
            setPage={setPage}
          />
        </>
      )}
    </div>
  );
}

function Pagination({
  currentPage, totalPages, pageSize, filteredCount, setPage,
}: {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  filteredCount: number;
  setPage: (fn: (p: number) => number) => void;
}) {
  if (filteredCount <= pageSize) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredCount)} of {filteredCount}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0}
          className="btn-ghost text-xs"
          style={{ padding: '6px 10px', opacity: currentPage === 0 ? 0.4 : 1 }}
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
          {currentPage + 1} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={currentPage >= totalPages - 1}
          className="btn-ghost text-xs"
          style={{ padding: '6px 10px', opacity: currentPage >= totalPages - 1 ? 0.4 : 1 }}
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CardView({ row, onEdit, onDelete }: { row: MasterRow; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="surface-card p-4 flex flex-col gap-3 cursor-pointer transition-shadow hover:shadow-md" onClick={onEdit}>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(0, 151, 178, 0.1)', color: 'var(--color-teal-dark)' }}>
          Review No. {row.review_no || '—'}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded transition-colors hover:bg-red-50"
          style={{ color: 'rgba(239, 68, 68, 0.4)' }}
          title="Delete entry"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-start gap-3">
        {row.book_cover ? (
          <img src={row.book_cover} alt={row.book_title} className="w-12 h-16 rounded object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-16 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-paper)' }}>
            <BookOpen className="w-5 h-5" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-serif text-base font-semibold leading-snug truncate" style={{ color: 'var(--color-text)' }}>
            {row.book_title || 'Untitled'}
          </h3>
          <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{row.author || 'Unknown author'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {row.reviewers_rating && (
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--color-teal-dark)' }}>
            <Star className="w-3 h-3 fill-current" /> {row.reviewers_rating}/10
          </span>
        )}
        {row.genre && <span>{row.genre}</span>}
        {row.name && (
          <span className="inline-flex items-center gap-1">
            <User className="w-3 h-3" /> {row.name}
          </span>
        )}
        {row.status && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(0, 151, 178, 0.08)', color: 'var(--color-teal-dark)' }}>
            {row.status}
          </span>
        )}
      </div>

      {row.review && (
        <p className="text-xs line-clamp-3" style={{ color: 'var(--color-text)' }}>{row.review}</p>
      )}
    </div>
  );
}

function CardEditor({
  draft, setDraft, onSave, onCancel, onDelete, saving,
}: {
  draft: Draft;
  setDraft: (updater: (prev: Draft) => Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const field = (key: ColumnKey, label: string, span = false) => (
    <div className={span ? 'col-span-2' : ''}>
      <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
      <input
        type="text"
        value={draft[key]}
        onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
        className="input-field text-xs"
        style={{ padding: '6px 8px' }}
      />
    </div>
  );

  return (
    <div className="surface-card p-4 flex flex-col gap-3 md:col-span-2 xl:col-span-3" style={{ border: '2px solid var(--color-teal-dark)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-base font-semibold" style={{ color: 'var(--color-text)' }}>Editing entry</h3>
        <div className="flex gap-2">
          <button onClick={onSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={onCancel} className="btn-ghost text-xs px-3 py-1.5">Cancel</button>
          <button onClick={onDelete} className="btn-ghost text-xs px-3 py-1.5" style={{ color: '#ef4444' }}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {field('review_no', 'Review No.')}
        {field('timestamp', 'Timestamp')}
        {field('name', 'Name')}
        {field('email', 'Email')}
        {field('novelty_username', 'Novelty Username')}
        {field('instagram', 'Instagram')}
        {field('book_title', 'Book Title')}
        {field('author', 'Author')}
        {field('genre', 'Genre')}
        {field('series', 'Series')}
        {field('language', 'Language')}
        {field('reviewers_rating', 'R/W Rating')}
        {field('goodreads_rating', 'Goodreads')}
        {field('amazon_rating', 'Amazon')}
        {field('book_cover', 'Cover URL')}
        {field('amazon_link', 'Amazon Link')}
        {field('review_date', 'Review Date')}
        {field('status', 'Status')}
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--color-text-muted)' }}>Review</label>
        <textarea
          value={draft.review}
          onChange={(e) => setDraft((prev) => ({ ...prev, review: e.target.value }))}
          className="input-field text-xs resize-y"
          style={{ minHeight: '90px', padding: '6px 8px' }}
          rows={4}
        />
      </div>
    </div>
  );
}

function renderCellValue(value: string, col: ColumnKey): React.ReactNode {
  if (!value) return <span style={{ color: 'var(--color-text-muted)', opacity: 0.2 }}>—</span>;

  if (col === 'novelty_username' && value) {
    const handle = value.replace(/^@/, '');
    return <button type="button" onClick={() => window.location.hash = `/profile/@${encodeURIComponent(handle)}`} className="text-xs hover:underline truncate block" style={{ color: 'var(--color-cyan-dark)' }}>@{handle}</button>;
  }

  if (col === 'instagram' && value) {
    const handle = value.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
    return (
      <a href={value.startsWith('http') ? value : `https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline truncate block" style={{ color: 'var(--color-cyan-dark)' }}>
        {handle}
      </a>
    );
  }

  if (col === 'amazon_link' && value) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--color-cyan-dark)' }}>
        Link
      </a>
    );
  }

  if (col === 'book_cover' && value) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--color-cyan-dark)' }}>
        View
      </a>
    );
  }

  if (col === 'review') {
    return (
      <span className="text-xs block truncate" style={{ color: 'var(--color-text-muted)', maxWidth: 280 }} title={value}>
        {value.slice(0, 120)}{value.length > 120 ? '...' : ''}
      </span>
    );
  }

  if (col === 'reviewers_rating' && value) {
    return <span className="text-xs font-bold" style={{ color: 'var(--color-teal-dark)' }}>{value}/10</span>;
  }

  if (col === 'status' && value) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(0, 151, 178, 0.1)', color: 'var(--color-teal-dark)' }}>
        {value}
      </span>
    );
  }

  return <span className="text-xs truncate block" style={{ color: 'var(--color-text)' }}>{value}</span>;
}
