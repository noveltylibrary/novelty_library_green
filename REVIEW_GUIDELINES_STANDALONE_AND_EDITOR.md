# Review Guidelines: standalone page + editable sections

- `/review-guidelines` is a full native web-app page, not a popup and not a Blogger iframe.
- Submit Reviews -> Review Guidelines now navigates to that page.
- Admin -> Pages Moderation -> Editor -> Review Guidelines opens a section editor.
- Admin can select a section from the dropdown, rename it, edit its context/content HTML, preview it, show/hide it, add sections, and delete sections.
- Public readers see active sections as branded accordions with a jump-to-section dropdown.
- Run `supabase/migrations/20261016_review_guideline_sections.sql` once.
