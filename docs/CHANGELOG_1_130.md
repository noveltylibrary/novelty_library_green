# v1.130 – "Currently Reading" rewired (UI only)
- Editor: "Currently Reading" moves from Advanced Reader to the END of the tier before it (Basic Reader). UI-only re-tiering (`moveCurrentlyReadingToBasic`); the database question is untouched.
- It is now a book block: book name + optional cover upload (5 MB, JPEG/PNG/WebP, stored with the existing profile-question-images bucket).
- Saved inside the existing answer (plain text, or `{ value, cover }` when a cover exists) so visitors receive it through the existing public-profile function. answerText() already reads both forms.
- Profile (own + public) shows a new "Currently reading" panel with the cover under the card. The profile card itself is unchanged.
- No SQL / Supabase changes.
