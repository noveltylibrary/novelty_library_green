# Novelty Library 1.82 — Profile Card and Export Improvements

## Profile-card layout
- Standardized the heights of the Advanced Reader information blocks so titles and descriptions align consistently.
- Limited About/Bio text to 140 characters.
- For 16:9 cards, placed the Bio line and profile tags in a right-aligned area beside the identity block, leaving the body available for the card fields.
- Tightened spacing between the 16:9 content columns to help the shelf and bottom question fields fit without clipping.

## Download dialog
- Replaced the simple download menu with a modal that shows each card layout and its exact pixel dimensions.
- PNG exports download directly at the selected layout dimensions.
- PDF export opens the browser print sheet with the card prepared; choose “Save as PDF” there.
- Animated video export creates a 2.5-second animated card. MP4 is used if supported by the browser; otherwise WebM is used.

## Notes
- Browser support affects whether MP4 recording is available. WebM is the fallback for browsers that do not expose MP4 recording.
- PDF creation uses the browser print-to-PDF flow rather than a bundled PDF library.
- A full application build still requires installing the dependencies listed in `package.json`.
