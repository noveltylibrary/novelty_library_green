# Novelty Library 1.106

- Publishing Queue Blogger matching now searches explicit affiliate/tracking URLs before falling back to a poster's outbound image link. HTML entities and common affiliate network/short links are handled more reliably.
- Instant Publish and Batch Publish now preserve discovered affiliate/Buy Now links as well as poster URLs.
- Individual review pages now derive the Blogger post URL at runtime using the same Review No./title matcher, so “View in Blog” does not depend on an optional `blog_url` database column. Missing affiliate links on older published rows can also be hydrated from the Blogger feed. No database migration is needed.
- “Sync Now” sends a cache-busting, no-store request to the existing Supabase `sheet-proxy` import function so cached GET responses cannot hide recent sheet edits. The server-side `sheet-proxy` implementation is deployed separately and is not present in this project ZIP; field reconciliation logic there remains dependent on the deployed function.
