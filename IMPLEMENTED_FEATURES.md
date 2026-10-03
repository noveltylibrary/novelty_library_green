# Novelty Library — requested feature pass

Implemented in this build:

- Publishing Queue now has a second, exact **Review No.** search field. It accepts only digits and returns only that exact review number; the existing search remains for book/author/reviewer/email text.
- Home hero **Active Sequence** stat replaced with **Reviewers Trust Novelty** and a trust progress bar.
- Home analytics area below the top contributor now contains a dedicated **Reviewers Trust Novelty** bar plus a **Community Activity** analytics block (likes, reader reviews, average reader rating).
- Existing R/W rating displays in Home/Analytics continue to use the shared star-rating component rather than numeric R/W badges.
- Hero CTA changed from **Browse Archive** to **Reviews**.
- Navigation now uses SVG-style Lucide icons for Home, Reviews, Submit, About, Profile, Accounts, Notifications and Admin.
- Logged-in navigation separates **Profile** from **Accounts** and adds a notification bell/unread count.
- New **Profile** page contains profile picture, public profile fields, reading-life questions, username display, user-since date, and accepted-review cards linked to the signed-in email.
- New **Accounts** page contains editable unique Novelty username, password change with fresh-password verification, and secure account deletion requiring password verification plus `DELETE` confirmation.
- Usernames are generated from the email local-part on signup and automatically collision-suffixed (`@noveltylibrary`, `@noveltylibrary_1`, etc.). Users can later change their username if the new ID is available.
- Admin Users directory now receives/stores the Novelty username and requested reading/profile fields through the protected admin RPC.
- New logged-in **Notifications** page. Admins receive notifications for new submissions; all registered users receive a notification when an admin publishes a review.
- New review **Comments** feature on published review pages. Logged-in users can post/delete their own comments; public readers can read comments. RLS protects writes.
- Existing reader **Rate & Review** functionality remains in place.
- Added protected `my_accepted_reviews()` RPC so a signed-in user can see their accepted reviews without exposing the private master-list table to the browser.
- Added account-deletion Edge Function using JWT verification and server-side Supabase Auth deletion; avatar files are removed while review cover uploads are retained so published reviews do not break.
- Added database constraints/RLS/indexes for usernames, notifications and comments, plus review ownership linking and account-safe cascades.

## Backend deployment

Apply all migrations in `supabase/migrations` and deploy:

```bash
supabase functions deploy delete-account
```

Do not put the Supabase service-role key in browser environment variables.

### 3.3 UI refinements
- Desktop profile navigation now displays the `Profile` label beside the user icon.
- Profile reading fields use strict numeric/year input; book counts have dedicated +/- controls.
- Profile placeholders now provide useful examples; Reading Since uses `2024` as the placeholder.
- Home hero/analytics trust labels now read `Trust Score`.
- Home analytics adds an exact `Total Users` panel beneath Community Activity.
- Supabase migration `20261002150000_profile_home_ui_updates.sql` adds numeric integrity constraints and exposes only the total-user count through the existing public analytics RPC.

## 3.4 Update — Review sharing + reviewer usernames

- Added Copy Link and Share controls to individual live review posts.
- Share menu supports Instagram (copies the review URL and opens Instagram), Facebook, and WhatsApp.
- Added editable Novelty Username field to the Publishing Queue and Accepted Reviews admin table.
- Existing accepted reviews with a reviewer email receive an automatic reviewer username; rows without an email remain blank.
- Published review snapshots carry the reviewer username.
- Individual published reviews display the reviewer @username beside the Instagram handle when available, linking to the public profile.
- Added public username profile routes and public profile shelves.
- Added a Published Reviews shelf below the Accepted Reviews shelf in the signed-in profile.
- Added account-created and username-updated notifications.
- Total Books Read placeholder is now `102`.


### 3.6 Update — Published purchase links + dynamic support contact

- Individual published reviews now show a **Buy Now** button when the Publishing Queue has an affiliate URL; it opens in a new tab and falls back to the existing book link when needed.
- Review metadata spacing is standardized, and the Novelty Library logo appears as a small whitish mark beside the reviewer `@username` link.
- Published-review cards in Profile and public profiles now redirect to the live published review when clicked.
- Home analytics now says **Follow @novelty.co.in**.
- Footer Connect now uses the current Support email and an Instagram **Reviews** link to `instagram.com/novelty.lib`.
- The old `noveltylibrary@gmail.com` address has been removed from the public frontend; support contact text is loaded dynamically.
- Admins & Contacts now includes a protected **Support** email setting. Updating it changes the contact address shown in the footer, About, Terms and Privacy pages without another code edit.
- Total Books Read remains automatically at least the number of accepted reviews associated with the reviewer's email; higher manual totals are preserved. Future accepted reviews update the minimum automatically.
- New migration: `20261002193000_support_email_and_review_count_automation.sql`.
