import { useEffect, useState, type ChangeEvent } from 'react';
import { Clock3, ImagePlus, Sparkles, Upload, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createStory, uploadStoryImage } from '@/lib/social';

interface StoryComposerModalProps {
  open: boolean;
  onClose: () => void;
  onPublished?: () => void | Promise<void>;
}

/** Shared story composer used by both Home and Profile. */
export function StoryComposerModal({ open, onClose, onPublished }: StoryComposerModalProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetDraft = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(null); setCaption(''); setError(null);
  };
  const closeComposer = () => {
    if (uploading) return;
    resetDraft(); onClose();
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !uploading) closeComposer(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, uploading, previewUrl]);

  const pickImage = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]; event.target.value = '';
    if (!picked) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(picked.type)) { setError('Choose a JPG, PNG, or WebP image.'); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked); setPreviewUrl(URL.createObjectURL(picked)); setError(null);
  };

  const publish = async () => {
    if (!file || !user || uploading) return;
    setUploading(true); setError(null);
    try {
      const path = await uploadStoryImage(file, user.id);
      await createStory(path, caption);
      resetDraft();
      try { await onPublished?.(); } catch { /* The story is already published; a refresh failure should not undo that. */ }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish the story. Please try again.');
    } finally { setUploading(false); }
  };

  if (!open) return null;
  return (
    <div className="nl-story-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeComposer(); }}>
      <section className="nl-story-modal" role="dialog" aria-modal="true" aria-labelledby="nl-story-modal-title">
        <div className="nl-story-modal-head">
          <div className="min-w-0">
            <span className="nl-story-modal-kicker"><Sparkles className="w-3.5 h-3.5" /> YOUR 24-HOUR STORY</span>
            <h2 id="nl-story-modal-title">Share a reading moment</h2>
            <p>Post a photo for your followers. It disappears after 24 hours.</p>
          </div>
          <button type="button" className="nl-story-modal-close" onClick={closeComposer} disabled={uploading} aria-label="Close story composer"><X className="w-5 h-5" /></button>
        </div>
        <div className="nl-story-modal-body">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickImage} className="hidden" id="nl-story-modal-file" />
          {previewUrl ? (
            <div className="nl-story-modal-preview"><img src={previewUrl} alt="Selected story preview" /><button type="button" onClick={() => document.getElementById('nl-story-modal-file')?.click()} disabled={uploading}><ImagePlus className="w-4 h-4" /> Change photo</button></div>
          ) : (
            <button type="button" className="nl-story-modal-drop" onClick={() => document.getElementById('nl-story-modal-file')?.click()} disabled={uploading}>
              <span className="nl-story-modal-drop-icon"><ImagePlus className="w-7 h-7" /></span>
              <strong>Choose a photo</strong>
              <span>JPG, PNG or WebP · portrait preview · other sizes get black bars</span>
            </button>
          )}
          <label className="nl-story-caption-label" htmlFor="nl-story-caption"><Clock3 className="w-4 h-4" /> Caption <span>Optional · up to 240 characters</span></label>
          <textarea id="nl-story-caption" value={caption} onChange={(event) => setCaption(event.target.value.slice(0, 240))} placeholder="What's the reading moment?" rows={2} maxLength={240} disabled={uploading} />
          {error && <p className="nl-story-modal-error" role="alert">{error}</p>}
        </div>
        <div className="nl-story-modal-foot">
          <button type="button" className="nl-story-modal-cancel" onClick={closeComposer} disabled={uploading}>Cancel</button>
          <button type="button" className="nl-story-modal-publish" onClick={() => void publish()} disabled={!file || uploading}>
            {uploading ? <><span className="nl-story-spinner" /> Sharing…</> : <><Upload className="w-4 h-4" /> Share story</>}
          </button>
        </div>
      </section>
    </div>
  );
}
