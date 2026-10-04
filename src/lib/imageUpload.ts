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

export async function prepareImageForUpload(file: File): Promise<File> {
  const lowerName = file.name.toLowerCase();
  if (file.type === 'image/svg+xml' || lowerName.endsWith('.svg') || !file.type.startsWith('image/')) {
    throw new Error('Please choose a JPEG, PNG or WebP image.');
  }

  // Already compliant -> upload untouched.
  if (isAllowed(file.type) && file.size <= MAX_UPLOAD_BYTES) return file;

  // Otherwise re-encode as WebP, shrinking until it fits.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That image format is not supported. Please use JPEG, PNG or WebP.');
  }

  let maxSide = 3000;
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
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
      maxSide = Math.round(maxSide * 0.75);
    }
  } finally {
    bitmap.close();
  }
  throw new Error('That image is larger than 5 MB and could not be compressed. Please pick a smaller one.');
}
