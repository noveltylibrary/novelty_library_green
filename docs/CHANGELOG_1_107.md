# Version 1.107

- Blogger affiliate-link matching now considers outbound product URLs in separate Buy Now / Amazon / Flipkart buttons, explicit affiliate redirects, sponsored links, and links attached to poster images instead of relying only on tracking query parameters or poster-wrapped anchors.
- Metadata matching falls back to an accepted review's existing purchase link only when the matched Blogger post does not expose a usable outbound link.
- All Auto-Match source selections continue to retrieve Blogger post URL, published date, and affiliate link when a Blogger match is available, including when the poster itself is sourced from Drive.
- No database schema or SQL changes.
