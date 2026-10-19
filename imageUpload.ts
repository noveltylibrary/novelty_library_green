import { supabase } from '@/lib/supabase';
/**
 * Client-side image gate for Storage uploads (v3.1).
 *
 * The database/storage layer is the real enforcement (5 MB, JPEG/PNG/WebP
 * only — see the security_hardening migration). This helper keeps the UX
 * smooth: phone photos that are too big, or GIF/BMP/AVIF files, are quietly
 * converted to a compliant WebP instead of failing at upload time. SVG and
 * anything that is not a raster image is rejected outright (stored-XSS risk).
 */
export const MAX_UPLOAD_BYTES = 5_242_880; // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function extForImageType(type: string): string {
  return EXT_BY_TYPE[type] ?? 'jpg';
}

function isAllowed(type: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImageForUpload(file: File, maxWidth = 3000, maxHeight = 3000): Promise<File> {
  const lowerName = file.name.toLowerCase();
  if (file.type === 'image/svg+xml' || lowerName.endsWith('.svg') || !file.type.startsWith('image/')) {
    throw new Error('Please choose a JPEG, PNG or WebP image.');
  }

  // Keep compliant files untouched only when they already fit the configured resolution.
  if (isAllowed(file.type) && file.size <= MAX_UPLOAD_BYTES) {
    try {
      const bitmap = await createImageBitmap(file);
      const fitsResolution = bitmap.width <= maxWidth && bitmap.height <= maxHeight;
      bitmap.close();
      if (fitsResolution) return file;
    } catch {
      // Fall through to the normal conversion path.
    }
  }

  // Otherwise re-encode as WebP, shrinking until it fits.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image format is not supported. Please use JPEG, PNG or WebP.');
  }

  let maxW = Math.max(320, maxWidth);
  let maxH = Math.max(320, maxHeight);
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.9, 0.8, 0.7, 0.55]) {
        const blob = await canvasToBlob(canvas, 'image/webp', quality);
        if (blob && blob.type === 'image/webp' && blob.size <= MAX_UPLOAD_BYTES) {
          const base = file.name.replace(/\.[^.]+$/, '') || 'image';
          return new File([blob], `${base}.webp`, { type: 'image/webp' });
        }
      }
      maxW = Math.round(maxW * 0.75);
      maxH = Math.round(maxH * 0.75);
    }
  } finally {
    bitmap.close();
  }
  throw new Error('That image is larger than 5 MB and could not be compressed. Please pick a smaller one.');
}

/**
 * Always-on compression for uploads: scales the longest side down to `maxSide` and re-encodes as WebP
 * (JPEG where the browser cannot encode WebP). If that would not make the file smaller, the original is kept.
 * Typical result: a 2-4 MB phone/poster image becomes ~60-200 KB, which keeps Supabase storage and egress low.
 */
export async function compressImageForUpload(raw: File, maxSide: number, quality = 0.82): Promise<File> {
  const prepared = await prepareImageForUpload(raw); // validates type + enforces the 5 MB gate
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(prepared); } catch { return prepared; }
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return prepared;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = await canvasToBlob(canvas, 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') {
      // Browser cannot encode WebP: JPEG needs a solid background behind any transparency.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    }
    if (!blob || (scale === 1 && blob.size >= prepared.size)) return prepared;
    const base = prepared.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.${extForImageType(blob.type)}`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function uploadProfileQuestionImage(rawFile: File, userId: string, questionKey: string, limits?: { maxWidth?: number; maxHeight?: number }): Promise<{ path: string; publicUrl: string }> {
  const file = await compressImageForUpload(rawFile, Math.min(1600, Math.max(limits?.maxWidth ?? 1600, limits?.maxHeight ?? 1600)), 0.82);
  const safeQuestionKey = questionKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'question';
  const ext = extForImageType(file.type);
  // Stored in the existing public `covers` bucket (own-folder uploads allowed): a separate
  // `profile-question-images` bucket was never created on the project, which made every upload fail.
  const path = `${userId}/profile-questions/${safeQuestionKey}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('covers').upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('covers').getPublicUrl(path);
  return { path, publicUrl: urlData.publicUrl };
}
