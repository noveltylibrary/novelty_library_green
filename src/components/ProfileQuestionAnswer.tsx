import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import type { ProfileQuestion } from '@/lib/profileQuestions';
import { prepareImageForUpload, uploadProfileQuestionImage } from '@/lib/imageUpload';

const OTHER_PREFIX = '__other__::';

export function encodeOtherAnswer(value: string): string {
  return `${OTHER_PREFIX}${value}`;
}

export function decodeOtherAnswer(value: unknown): { isOther: boolean; value: string } {
  const str = typeof value === 'string' ? value : '';
  return str.startsWith(OTHER_PREFIX) ? { isOther: true, value: str.slice(OTHER_PREFIX.length) } : { isOther: false, value: str };
}

export function answerText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map(v => String(v))
      .map(v => v.startsWith(OTHER_PREFIX) ? v.slice(OTHER_PREFIX.length) : v)
      .filter(Boolean)
      .join(', ');
  }
  if (value && typeof value === 'object' && 'value' in value) return String((value as { value?: unknown }).value ?? '');
  const str = String(value ?? '');
  return str.startsWith(OTHER_PREFIX) ? str.slice(OTHER_PREFIX.length) : str;
}

export function answerImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(v => String(v)).filter(v => /^https?:\/\//i.test(v));
}

interface Props {
  question: ProfileQuestion;
  value: unknown;
  userId: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export function ProfileQuestionAnswer({ question, value, userId, onChange, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [multiOpen, setMultiOpen] = useState(false);

  if (question.type === 'image_upload') {
    const urls = answerImageUrls(value);
    const maxImages = Math.max(1, Math.min(6, question.image_count || 1));
    const maxMb = Math.max(1, Math.min(5, question.image_max_mb || 5));
    const maxWidth = Math.max(320, Math.min(6000, question.image_max_width || 1600));
    const maxHeight = Math.max(320, Math.min(6000, question.image_max_height || 1600));
    const chooseFiles = async (files: FileList | null) => {
      if (!files?.length || disabled || uploading) return;
      setUploading(true);
      setUploadError(null);
      try {
        const selected = Array.from(files).slice(0, Math.max(0, maxImages - urls.length));
        const next = [...urls];
        for (const raw of selected) {
          const prepared = await prepareImageForUpload(raw);
          if (prepared.size > maxMb * 1024 * 1024) throw new Error(`${raw.name} is larger than the ${maxMb} MB limit for this question.`);
          const uploaded = await uploadProfileQuestionImage(prepared, userId, question.key, { maxWidth, maxHeight });
          next.push(uploaded.publicUrl);
        }
        onChange(next.slice(0, maxImages));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Image upload failed.');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    };

    return <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Array.from({ length: maxImages }).map((_, i) => {
          const url = urls[i];
          return <div key={i} className="aspect-square rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden dark:border-slate-700 dark:bg-slate-900/40">
            {url ? <div className="relative h-full w-full"><img src={url} alt="Profile answer" className="h-full w-full object-cover"/><button type="button" onClick={() => onChange(urls.filter((_, idx) => idx !== i))} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white" aria-label="Remove image"><Trash2 className="h-3.5 w-3.5" /></button></div> : <button type="button" disabled={disabled || uploading} onClick={() => inputRef.current?.click()} className="h-full w-full grid place-items-center text-center text-xs text-slate-400 hover:text-teal-600 dark:text-slate-500 dark:hover:text-cyan-300"><ImagePlus className="h-6 w-6 mx-auto mb-1" />Add image</button>}
          </div>;
        })}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple={maxImages > 1} className="hidden" onChange={e => void chooseFiles(e.target.files)} />
      {urls.length < maxImages && <button type="button" disabled={disabled || uploading} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-4 py-2 text-xs font-bold text-teal-800 dark:text-cyan-200 disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{uploading ? 'Uploading…' : `Add image ${urls.length + 1} of ${maxImages}`}</button>}
      <p className="text-[11px] text-slate-500 dark:text-slate-400">JPEG, PNG or WebP · up to {maxMb} MB · max resolution {maxWidth} × {maxHeight}px</p>
      {uploadError && <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">{uploadError}</p>}
    </div>;
  }

  if (question.type === 'select' || question.type === 'select_single') {
    const decoded = decodeOtherAnswer(value);
    const selected = decoded.isOther ? '__other__' : answerText(value);
    return <div className="space-y-2">
      <select value={selected} onChange={e => onChange(e.target.value === '__other__' ? encodeOtherAnswer('') : e.target.value)} className="input-field" disabled={disabled}>
        <option value="">Choose…</option>
        {question.options.map(option => <option key={option} value={option}>{option}</option>)}
        {question.allow_other !== false && <option value="__other__">Other…</option>}
      </select>
      {decoded.isOther && <input value={decoded.value} onChange={e => onChange(encodeOtherAnswer(e.target.value))} placeholder="Enter your own answer…" className="input-field" disabled={disabled} autoFocus />}
    </div>;
  }

  if (question.type === 'select_multiple') {
    const raw = Array.isArray(value) ? value.map(v => String(v)) : [];
    const selectedOptions = raw.filter(v => !v.startsWith(OTHER_PREFIX));
    const otherEntry = raw.find(v => v.startsWith(OTHER_PREFIX)) || '';
    const otherValue = otherEntry.slice(OTHER_PREFIX.length);
    const maxSelections = question.max_selections == null ? null : Math.max(1, Math.floor(Number(question.max_selections) || 1));
    const sortedOptions = question.alphabetical_sort ? [...question.options].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })) : question.options;
    const toggleOption = (option: string) => {
      const next = selectedOptions.includes(option)
        ? selectedOptions.filter(v => v !== option)
        : (maxSelections != null && selectedOptions.length >= maxSelections ? selectedOptions : [...selectedOptions, option]);
      onChange(otherEntry ? [...next, otherEntry] : next);
    };
    const toggleOther = () => {
      if (otherEntry) { onChange(selectedOptions); return; }
      if (maxSelections != null && selectedOptions.length >= maxSelections) return;
      onChange([...selectedOptions, encodeOtherAnswer('')]);
    };
    const summary = [...selectedOptions, ...(otherEntry ? [otherValue || 'Other'] : [])];
    return <div className="space-y-2">
      <div className="relative">
        <button type="button" disabled={disabled} onClick={() => setMultiOpen(v => !v)} className="input-field w-full text-left flex items-center justify-between gap-3 disabled:opacity-60">
          <span className="min-w-0 truncate">{summary.length ? summary.join(', ') : 'Choose one or more…'}</span>
          <span className={`shrink-0 text-xs transition-transform ${multiOpen ? 'rotate-180' : ''}`}>⌄</span>
        </button>
        {multiOpen && <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Select one or more{maxSelections != null ? ` · ${selectedOptions.length}/${maxSelections}` : ''}</div>
          <div className="grid gap-1">
            {sortedOptions.map(option => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-teal-500/10">
              <input type="checkbox" checked={selectedOptions.includes(option)} onChange={() => toggleOption(option)} disabled={disabled} />
              <span>{option}</span>
            </label>)}
            {question.allow_other !== false && <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-teal-500/10">
              <input type="checkbox" checked={!!otherEntry} onChange={toggleOther} disabled={disabled} />
              <span>Other…</span>
            </label>}
          </div>
          <button type="button" className="mt-2 w-full rounded-xl px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-500/10 dark:text-cyan-200" onClick={() => setMultiOpen(false)}>Done</button>
        </div>}
      </div>
      {(selectedOptions.length > 0 || otherEntry) && <div className="flex flex-wrap gap-1.5">
        {selectedOptions.map(v => <span key={v} className="rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-semibold text-teal-800 dark:text-cyan-200">{v}</span>)}
        {otherEntry && <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-800 dark:text-cyan-200">{otherValue || 'Other'}</span>}
      </div>}
      {otherEntry && <input value={otherValue} onChange={e => onChange([...selectedOptions, encodeOtherAnswer(e.target.value)])} placeholder="Enter your own answer…" className="input-field" disabled={disabled} autoFocus />}
    </div>;
  }

  const text = answerText(value);
  if (question.type === 'long_text') return <textarea value={text} onChange={e => onChange(e.target.value)} className="input-field min-h-28" placeholder={question.placeholder || 'Write a few lines…'} disabled={disabled} />;
  const fallbackPlaceholder = question.type === 'number' ? 'e.g. 12' : question.type === 'year' ? 'e.g. 2018' : question.type === 'url' ? 'https://example.com/your-profile' : 'Your answer…';
  return <input type={question.type === 'number' || question.type === 'year' ? 'number' : question.type === 'url' ? 'url' : 'text'} value={text} onChange={e => onChange(e.target.value)} className="input-field" placeholder={question.placeholder || fallbackPlaceholder} disabled={disabled} />;
}
