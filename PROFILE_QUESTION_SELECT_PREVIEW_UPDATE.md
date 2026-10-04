# Profile Question Select + Card Preview Update

- Added `select_single` and `select_multiple` profile-question answer types.
- Legacy `select` values remain compatible and normalize to single-select when saved.
- Multiple-select answers use a mobile-friendly dropdown with checkboxes and optional Other text.
- ProfileCard renders multiple selections as compact chips.
- Public profile preserves multi-select arrays so the card can render them correctly.
- Admin question editor shows a live Profile Card appearance preview directly below the question input.
- No new SQL is required because the existing `profile_questions.type` field already stores text values.
