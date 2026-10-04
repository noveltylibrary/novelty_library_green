# Novelty Library onboarding

`src/components/OnboardingModal.tsx` provides the five-step guest onboarding funnel and is mounted from `src/App.tsx`.

## Persistence and trigger

- Opens after `SplashIntro` calls `onComplete`.
- Only starts automatically for a guest and when `localStorage.getItem('nl_onboarding_dismissed') !== 'true'`.
- Every step exposes an `X` close control and a visible Skip/Explore option.
- Closing stores `nl_onboarding_dismissed=true`.
- During onboarding the body and document scrolling are locked.

## Existing profile storage

The current project already exposes profile fields used by `ProfilePage` and `updateProfile`, so this onboarding uses the existing profile storage rather than introducing a parallel schema:

- `name`, `email`, `instagram_id`, `social_links`, `website`
- `reading_since`, `books_read_this_month`, `total_books_read`
- `favorite_book`, `favorite_author`, `favorite_genre`
- `profile_answers`

The sign-up call also writes `full_name` and `display_name` into Supabase Auth user metadata for compatibility with account flows that inspect auth metadata.

## Step 4 questions

Questions are loaded from `fetchProfileQuestions()` and saved into the existing `profile_answers` JSON object. If the configured question table returns no active questions or fails to load, a small local fallback provides three reading-life prompts so the funnel remains usable.
