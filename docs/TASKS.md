# Novelty Library WebApp — Task Backlog

**Baseline:** `NL_WA_1_34`

Legend:
- `[x]` = implemented in the inspected codebase.
- `[ ]` = follow-up / verification / improvement.

## P0 — Production integrity

### Build and deployment
- [ ] Run `npm run typecheck` on the exact deployment commit.
- [ ] Run `npm run lint` and resolve all production-relevant warnings/errors.
- [ ] Run `npm run build` and smoke-test the generated app.
- [ ] Verify all required Vite environment variables are configured in deployment.
- [ ] Verify Supabase redirect URLs match the production origin.
- [ ] Verify Vercel/static-host routing and hash deep links.

### Backend/security
- [ ] Audit RLS policies for every public/private/admin table referenced by the client.
- [ ] Confirm `is_admin()` cannot be spoofed by client state.
- [ ] Confirm all admin RPCs enforce authorization server-side.
- [ ] Confirm public analytics RPC exposes no private user information.
- [ ] Confirm storage policies for avatars/covers/stories/profile-question-images.
- [ ] Confirm profile-question image upload constraints are enforced server-side where required.

### Review lifecycle
- [ ] Verify pending → approved/declined → published transitions end-to-end.
- [ ] Verify publication creates/updates `master_list` and `community_reviews` consistently.
- [ ] Verify unpublishing cannot leave stale public records.
- [ ] Verify poster metadata remains synchronized with published review state.
- [ ] Verify duplicate/reservation checks cover the intended title normalization rules.

## P1 — Profile system

### Current implementation
- [x] Configurable profile questions.
- [x] Question sections.
- [x] Core field overrides.
- [x] Core field ordering.
- [x] Profile section layout.
- [x] Multi-select maximum-selection support.
- [x] A-Z sorting support.
- [x] Image question support.
- [x] Profile-card tag/Q+A/answer-only modes.
- [x] Public profile view.
- [x] Profile-card export formats.

### Next improvements
- [ ] Establish an explicit product-level cap for profile-card tag questions.
- [ ] Establish explicit display caps for multi-select answers on public cards.
- [ ] Add backend validation for `max_selections` and answer shape.
- [ ] Add migration/version metadata for profile-question configuration.
- [ ] Add a safe question-key rename/migration workflow.
- [ ] Add admin preview using representative long/short answers.
- [ ] Test profile cards with extreme names, 20+ tags, long answers and missing images.
- [ ] Verify the public profile honors every `profile_visibility` flag.

## P1 — Review experience

- [x] Published review shelf.
- [x] Review detail pages.
- [x] R/W star visual representation.
- [x] Community NL Rating calculation.
- [x] Community feedback.
- [x] Comments.
- [x] Like interaction.
- [ ] Add automated tests for NL Rating semantics.
- [ ] Add regression test proving reviewer R/W rating is excluded from NL Rating.
- [ ] Verify rating rounding/display consistency across home, shelf, detail and profile cards.
- [ ] Verify broken poster/cover URLs degrade gracefully.

## P1 — Submission workflow

- [x] Required-field progress.
- [x] Open Library search.
- [x] Cover upload.
- [x] Duplicate warning.
- [x] Draft saving/loading.
- [x] Honeypot.
- [x] Quality tips.
- [x] Reservation workflow.
- [x] Five-minute post-submit edit state.
- [ ] Add automated validation tests for all required fields.
- [ ] Verify browser autofill synchronization in Chrome/Edge/mobile Safari.
- [ ] Verify post-submit edit expiry after refresh/navigation.
- [ ] Verify draft privacy/RLS.
- [ ] Verify uploaded covers have predictable storage lifecycle.

## P1 — Community/social

- [x] Stories.
- [x] Story likes.
- [x] Story reposts.
- [x] Follow/unfollow.
- [x] Connection privacy.
- [x] Notifications.
- [x] Community review likes/ratings/reviews.
- [ ] Test story expiry and signed URL behavior at scale.
- [ ] Verify repost permissions and notification semantics.
- [ ] Verify hidden followers/following never leak through alternate RPCs.

## P1 — Admin

- [x] Admin hub.
- [x] Admin management.
- [x] User management.
- [x] Review management.
- [x] Master list.
- [x] Posters.
- [x] Reservations.
- [x] Page moderation.
- [x] Finance modules.
- [ ] Add audit log for sensitive admin mutations.
- [ ] Add explicit role model if multiple admin privilege levels are needed.
- [ ] Add bulk-action confirmation summaries.
- [ ] Add export/reporting for editorial operations.

## P2 — Analytics

- [x] Live aggregate analytics RPC.
- [x] Animated counters.
- [x] Contributor highlighting.
- [x] Language counts.
- [x] Community engagement metrics.
- [ ] Define a stable analytics schema/version.
- [ ] Add date-range analytics if required.
- [ ] Add monitoring for RPC latency/errors.
- [ ] Ensure analytics remains fast on large review datasets.

## P2 — Monetisation

- [x] Adsterra 300x250 placement component.
- [x] Sponsored label.
- [x] Finance module links.
- [ ] Verify the Adsterra unit key/configuration in production.
- [ ] Measure ad viewability without collecting unnecessary personal data.
- [ ] Document future payment provider integration boundary.
- [ ] Keep monetisation surfaces visually separated from editorial trust signals.

## P2 — Content management

- [x] Editable About sections.
- [x] Editable legal pages.
- [x] Editable cookie banner.
- [x] Editable review guidelines.
- [x] Editable profile configuration.
- [ ] Add content revision history.
- [ ] Add draft/publish state for public copy if multiple admins will edit.
- [ ] Add rollback for accidental content changes.

## P2 — Testing

- [ ] Add unit tests for `computeNlRating`.
- [ ] Add unit tests for review status transitions/helpers.
- [ ] Add tests for profile-question selection limits.
- [ ] Add tests for `answerText`/`decodeOtherAnswer` behavior.
- [ ] Add tests for URL sanitization.
- [ ] Add tests for profile-card overflow/fitting logic.
- [ ] Add end-to-end tests for auth → submit → admin → publish → public review.
- [ ] Add end-to-end tests for profile → public profile → export.
- [ ] Add accessibility smoke tests.

## P3 — Architecture improvements

- [ ] Introduce a formal schema/type generation strategy for Supabase data if the project grows.
- [ ] Separate domain services from presentation helpers more strictly as modules expand.
- [ ] Add central query/cache policy if data volume grows.
- [ ] Consider a formal router only if hash routing becomes a maintenance bottleneck.
- [ ] Add structured logging/observability for production errors.

## Definition of done

A feature is done when:
1. Product behavior is documented.
2. Authorization and data validation are verified.
3. Light/dark and mobile layouts are checked.
4. Loading/error/empty states exist.
5. Accessibility basics are satisfied.
6. `typecheck`, `lint` and `build` pass.
7. Relevant regression tests are added or updated.
8. `TASKS.md` is updated.

## 1.41

- [x] Built-in profile fields shown as editable, drag-sortable section columns in the profile admin.
- [x] Built-in fields can move between Reader identity and Reading journey (`section` override).
- [x] Section-tile drag hardening (Firefox button-in-draggable, gap drops, optimistic order, reload on failure).
- [ ] Verify in production: drag a built-in field across sections, reload the reader profile, confirm placement, saved values and card export.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build` (not run in the authoring sandbox: no network for `npm install`).

## 1.42

- [x] Reading Journey conversion into a real question section (admin button, idempotent).
- [x] Published-count card moved to Identity.
- [x] Reader/public profile bridge for converted reading questions.
- [ ] Verify in production: click Convert, check section + 6 questions appear, edit/drag one, confirm a reader's old answers still show on their profile and card, hide one question and confirm its card row disappears.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build` (not run in the authoring sandbox: no network for `npm install`).


## 1.60

- [x] Compulsory verdict question on the submit form (Perfection / Go for it / Timepass).
- [x] Verdict carried through submit -> accept (master_list) -> publish (community_reviews), written only when set.
- [x] Indigo/violet verdict banner with per-verdict SVG on review page, feed cards and submit preview.
- [x] `sql/verdict_column.sql` (idempotent, nullable, no default, NOT VALID CHECKs).
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build` (not run in the authoring sandbox: no network for `npm install`).
- [ ] Optional: backfill `master_list.verdict` for old reviews, then republish; add verdict to profile review RPCs.
