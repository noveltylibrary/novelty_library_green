# Profile Question Answer Features — 2026-10-11

- Dropdown options are edited one per row in Admin Pages Moderation, with Add option and remove controls.
- Select questions have an `Other` toggle enabled by default. Admins can remove it.
- Added `image_upload` question type with per-question image count (1–6) and max size (1–5 MB per image).
- Users can upload answer images from Onboarding and Profile, including configured number of image slots.
- Image answers are stored as public URLs in `profiles.profile_answers` and rendered on profile cards when visible.
- The existing guest onboarding Step 1 remains the pre-signup screen; it continues to respect `nl_onboarding_dismissed`.
