# Changelog 1.90

## Publishing Queue — Auto-Match is now a dropdown
- **Drive, then blog** (tries the Drive folder, falls back to the blog), **From Drive folder**, **From blog**.
- Blog matching finds the review's post by "Review No. N" in the post (title or opening text) or by book title, and uses the post's first image as the poster. The notice names the matched post; always check the preview.
- Instant Publish and Batch Publish now use "Drive, then blog" automatically.

## Compression on upload
- Every upload is scaled and re-encoded as WebP (JPEG fallback) before it reaches Supabase: posters 1000px, covers 900px, avatars 512px, profile headers/question images ≤1600px, stories 1080px. If compression would not make a file smaller, the original is kept.
- Poster upload notice shows the saving, e.g. "compressed 2.4 MB → 140 KB".

## Faster posters
- Drive posters are requested at 800px (was 1600) and Blogger posters at 1000px (was 1600).
