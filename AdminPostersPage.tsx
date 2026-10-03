import { ArrowLeft, FolderOpen, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const DRIVE_URL = 'https://drive.google.com/drive/folders/1PooINi_XfWbbDGDxnJDbnbMolo_tQBKm';
const DRIVE_EMBED = 'https://drive.google.com/embeddedfolderview?id=1PooINi_XfWbbDGDxnJDbnbMolo_tQBKm#grid';

interface PostersPageProps {
  navigate: (path: string) => void;
  embedded?: boolean;
}

export function AdminPostersPage({ navigate, embedded = false }: PostersPageProps) {
  const { isAdmin, loading: authLoading } = useAuth();

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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          {!embedded && (
            <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-1.5 text-sm mb-3 transition-colors" style={{ color: 'var(--color-text-muted)' }}>
              <ArrowLeft className="w-4 h-4" /> Admin Dashboard
            </button>
          )}
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" style={{ color: 'var(--color-teal-dark)' }} />
            <h1 className="font-serif text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>Posters Folder</h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Google Drive folder for review poster images</p>
        </div>
        <a href={DRIVE_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm">
          <ExternalLink className="w-4 h-4" /> Open in Google Drive
        </a>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <ImageIcon className="w-4 h-4" style={{ color: 'var(--color-teal-dark)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Poster Images</span>
        </div>
        <div style={{ height: '70vh' }}>
          <iframe
            src={DRIVE_EMBED}
            title="Posters Folder"
            className="w-full h-full"
            style={{ border: 'none' }}
            allowFullScreen
          />
        </div>
      </div>

      <p className="text-xs mt-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
        If the folder doesn't load, it may need to be set to "Anyone with the link can view" in Google Drive settings.
      </p>
    </div>
  );
}
