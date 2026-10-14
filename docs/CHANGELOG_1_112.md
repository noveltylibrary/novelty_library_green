# Novelty Library v1.112.0

- Profile cards now use the published Community Reviews poster first and fetch matched Blogger poster artwork as a fallback when legacy published rows have no `poster_url` saved.
- Review numbers are normalized when connecting published profile entries to community publication metadata, including leading-zero variants.
- Removed forced anonymous-CORS mode from the profile-card shelf image so Blogger-hosted images can display even when their server does not send permissive CORS headers. Book covers remain the fallback.
- Applied the Blogger poster fallback to both the downloadable owner profile card and public profile card, and to published-review shelf cards.
- No database or SQL changes.
