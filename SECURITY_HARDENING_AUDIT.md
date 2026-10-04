# Novelty Library — Full-Stack Security Hardening

## Audit scope
Audited the uploaded React + Vite + TypeScript PWA, including:
- `ReviewComments.tsx`
- `CommunityReviewCard.tsx`
- `ReviewPage.tsx`
- `PublicProfilePage.tsx`
- Supabase client/auth/review/comment/engagement/storage helpers
- admin configuration and admin management paths
- Vercel security headers

## Findings
### XSS / user-generated content
- No `dangerouslySetInnerHTML`, `innerHTML`, or direct HTML mounting was found in the requested review/profile surfaces.
- Normal JSX text rendering already escapes HTML.
- Added DOMPurify defense-in-depth helpers in `src/lib/sanitize.ts`.
- User-generated review/comment/profile strings are sanitized before rendering and before selected client writes.
- Added HTTPS-only URL validation for profile links and review purchase links.
- Rich HTML is not enabled by default. If a future feature needs HTML/Markdown, use `sanitizeRichTextHtml()` immediately before mounting HTML.

### Supabase client secrets
- The audited client uses only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- No service-role key reference was found in the frontend source.
- `createClient()` is centralized in `src/lib/supabase.ts`.

### Admin boundary
The previous frontend admin check used `admin_emails`. This is now replaced by the server-authoritative `is_admin()` RPC backed by immutable Auth user IDs in `admin_users`.

Admin writes remain protected at the database layer even if a user bypasses the React admin UI.

### Profile privilege escalation
`updateProfile()` now uses an explicit writable-field allow-list and does not forward arbitrary profile objects. The SQL hardening trigger also blocks changes to `role` / `is_admin` if such columns exist.

### Review moderation escalation
Owners may edit their own review content, but the SQL trigger prevents non-admin changes to ownership, status, publication state, admin notes, and publication numbering.

### Storage
Client image preparation now targets a 5 MB maximum and JPEG/PNG/WebP only. SQL additionally configures bucket limits and Storage RLS policies. SVG is rejected to avoid stored-XSS risks.

## Important deployment step
Run the separate `novelty_library_security_hardening.sql` file in the Supabase SQL Editor as a project owner.

The SQL is intentionally **not embedded in this frontend package**.

## Dependency
Run:

`npm install`

This installs DOMPurify from `package.json`.

## Admin bootstrap
The SQL migrates existing `admin_emails` entries to `admin_users` only when a matching Supabase Auth account already exists.

After migration, the admin UI can add/remove admins through protected RPCs. New admin grants require the account to already exist.

## Verification
After deployment:
1. Sign in as an existing admin and confirm the Admin page loads.
2. Confirm a normal user cannot read `master_list`, unpublished `community_reviews`, `finance_modules` marked inactive, or admin tables.
3. Confirm a normal user cannot change review `status`, `is_published`, `admin_notes`, `user_id`, or review numbering.
4. Confirm a normal user cannot modify profile role/admin fields if those columns exist.
5. Confirm avatar/cover uploads over 5 MB or non-JPEG/PNG/WebP are rejected by Storage.
6. Confirm poster uploads remain admin-only under `covers/posters/...`.
7. Run `npm run typecheck` and `npm run build` after `npm install`.
