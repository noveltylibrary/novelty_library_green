# Changelog 1.93

## Admin can blacklist any user
- **Admin → Users & Accounts**: every row (and the user detail window) has a **Blacklist** button. A reason is required and is kept on record; admins cannot blacklist themselves.
- Blacklisted users show a red **Blacklisted** badge in the table and appear in the Blacklist panel with the reason and whether it was set by an admin or automatically (30+ reports).
- **Restore** (table, detail window or Blacklist panel) lifts the blacklist after confirmation.
- Blacklisted profiles keep showing the existing "blacklisted" flag on their public profile.
- **Run `sql/admin_blacklist_1_93.sql` once in Supabase.** It adds `admin_blacklist_user`, `admin_unblacklist_user`, the `blacklisted_by_admin` flag, and re-defines `admin_list_blacklisted_users` / `is_profile_blacklisted` to read the profile flags. All are admin-only (`is_admin()`).

## Notifications moved under Admins & Contacts
- The **Notify Users** composer (one reader / everyone) now lives at the bottom of **Admin → Admins & Contacts**.
- The separate "Notify Users" card is removed from the admin dashboard; the old `#/admin/notify` link redirects to Admins & Contacts.
- Component: `src/components/AdminNotifyPanel.tsx` (replaces `AdminNotifyPage.tsx`).

## Blog link + About button
- Footer → Explore now has **Blog** (opens noveltylibrary.blogspot.com in a new tab).
- About → "Read the Review Guide" button stays on a single line on phones (text and padding scale with screen width).

## Blog & Instagram shortcuts
- **Home**: the shortcut buttons are now a swipeable row (phones and desktop). Reviews, Submit, About and Analytics show first; **Blog** is the fifth, one swipe away. Desktop also gets arrow buttons; two dots show the position.
- **Analytics**: "Read our Blog" button added to the share row at the bottom (animated icon and shimmer).
- **About**: **Blog** and **Follow on Instagram** buttons sit above the closing "Got a book that hit different?" card.
- Shared URLs live in `src/lib/links.ts` (blog and Instagram `@novelty.lib`).

## Blog link in the Publishing Queue → "View in Blog" on reviews
- **Run `sql/blog_url_1_93.sql` once in Supabase** (adds `community_reviews.blog_url`). Until then the app works as before; saving a blog link needs the column.
- **Publishing Queue**: every review has a **Blog post link** box (table and card views) plus a **Blog** open-link button. It is saved with Save / Publish / RePublish and survives republishing.
- **Auto-Match picks up the link**: "From blog" saves the matched post's poster *and* link; "Drive, then blog" takes the poster from Drive and still attaches the blog link. Instant Publish and Batch Publish do the same (existing links are never overwritten; the summary reports how many links were attached). A blog post without an image still gives the link.
- **Review page**: a **View in Blog** button appears under Buy Now whenever a blog link is set.

## Home shortcut row polish
- Arrows moved out of the cards into a small pager under the row (‹ dots ›): glass-white circles that fill teal on hover, the next arrow nudges to invite a click. Hidden on touch screens, which swipe as before.
- Desktop: a slice of the **Blog** card peeks in at the right edge with a soft fade, so it is obvious there is more. Phones are unchanged (four tiles, swipe for Blog).
- Card shadows and hover lift are no longer clipped into a visible box behind the row.
- Fix: the pager's ‹ button could not be clicked because the row's shadow padding sat on top of it; the pager now sits above the row.
- Phones now also show a sliver of the **Blog** tile at the right edge (desktop shows a bigger slice).
