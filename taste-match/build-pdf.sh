#!/bin/sh
# Rebuilds the PDFs from the Markdown files (needs pandoc and a Chromium/Chrome). Run from this folder.
set -e
for f in TASTE_MATCH_ARCHITECTURE TASTE_MATCH_QUERY_CATALOG; do
  pandoc "$f.md" -f gfm -t html5 -s --metadata pagetitle="$f" -c pdf.css -o "$f.html" --embed-resources 2>/dev/null || pandoc "$f.md" -f gfm -t html5 -s --metadata pagetitle="$f" -c pdf.css -o "$f.html"
  "${CHROME:-chromium}" --headless --no-sandbox --print-to-pdf="$f.pdf" --no-pdf-header-footer "$f.html"
  rm -f "$f.html"
done
