# taste-match/

Admin reference for **Taste Match SE**. Documentation only: nothing here is imported by the app, compiled by Vite or served to readers, so it cannot affect how the web app works.

| File | What it is |
|---|---|
| `TASTE_MATCH_ARCHITECTURE.md` / `.pdf` | How Taste Match works end to end: data in, scoring, the 40 metrics, searches, web lookups, privacy, source map |
| `TASTE_MATCH_QUERY_CATALOG.md` / `.pdf` | Every query that runs (database reads, in-browser searches, public-web lookups) and which feature triggers it |

The same material, shorter, is in the admin panel: Admin → Control Settings → Taste Match → "Behind the scenes". The code lives in `src/lib/tmai40Engine.ts`, `src/lib/rankingSearch.ts`, `src/lib/rememberedSearch.ts`, `src/lib/authorBio.ts` and `src/components/RankingFinder.tsx`.

Update these files whenever Taste Match changes. Generated PDFs: see `build-pdf.sh`.
