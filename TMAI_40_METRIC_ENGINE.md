# Taste Match AI — 40-metric Live Rankings integration

## Where it runs

`src/lib/tmai40Engine.ts` contains the browser-native TMAI-40 ranking engine. `src/components/RankingFinder.tsx` calls `rankTmai40()` from the Taste Match panel. `src/pages/LiveRankingsPage.tsx` already mounts that panel below the published NL/RW ranking lists, so the new engine runs in the correct Live Rankings location as readers change their query or preferences.

This is a Vite/React static web app, so the engine is implemented in TypeScript and runs over the published review records already loaded by the page. It does not add a Python server or expose a new endpoint.

## Matching inputs

- Free-text description of the desired read (up to 500 characters).
- Up to three existing mood choices.
- A book the reader liked, if provided.
- Optional language and reviewer-verdict filters.
- Existing public catalog information: title, author, genre, language, traits, review text, verdict and translated-in/series fields when present.

The engine uses TF-IDF-style lexical similarity plus metric-level matching. Metric weights live in `TMAI40_METRICS`; edit those weights in the engine rather than introducing one-off UI ranking constants.

## The 40 metrics

The `TMAI40_METRICS` registry follows the order and naming of the supplied Taste Match AI Fields document: Traits; Genre; Language; Pace; Writing Style; World Building; Character Complexity; Spice Level; POV; Ending Type; Timeline Format; Book Popularity Bias; User Recommendations; Hard Hitter Concept; Translated In; Intelligible Resonance; Emotional Resonance; Exposition Score; Dialogue Score; Regional Frequency Mapping Score; Atmosphere; Twist Predictibility; PPP Angle; Plot Structure; Storytelling; Nuanced Writing Input; Nuanced Wording Style; Proofread Demand; Rereadability Index; PQI; Per Capita Sales; Author Popularity Bias; SSR; Sensory Immersion Index; Velocity Shift; Narrative Draft Probe Score; Poetic Weight; Post-Read Hangover Index; AVT Optimization; Director's Seat.

Each catalog `SearchBook` can optionally provide a `metricValues` object keyed by these metric IDs. Numeric values must be normalized to `0..1`. When explicit numeric/text values are absent, only metrics with defined text cues may be estimated from the review text. The engine does not invent popularity, regional-frequency, sales, PQI or draft-probe data.

## Important limitation

The public review schema does not currently hold structured values for all 40 metrics. The live engine reports a catalog-evidence count and skips unobserved signals instead of penalizing books for missing data. Text-derived numeric estimates are lexical heuristics, not trained NLP predictions or editorially validated measurements. Rankings are relative scores, not probabilities of reader satisfaction.

For production calibration, add structured metric fields to the catalog and fill them through a reviewed admin workflow or validated inference pipeline. Do not treat reviewer stars, Goodreads ratings or Amazon ratings as sales/popularity counts, or as a substitute for PQI.
