# Novelty Library Onboarding Flow

Implemented in `src/components/OnboardingModal.tsx` and mounted from `src/App.tsx`.

- Starts after `SplashIntro` calls `onComplete`.
- Initial auto-open requires no authenticated user and `localStorage.nl_onboarding_dismissed !== 'true'`.
- Every step has the persistent accessible X button; steps 1–4 also have a visible Skip control and step 5 offers Explore Library as the dismiss option.
- Signup uses `supabase.auth.signUp()` with full_name/display_name metadata. Existing signed-in accounts can switch to Sign In from the same screen.
- Step 2 stores social connections in `public.profiles` through the existing `updateProfile()` helper.
- Step 3 stores reading journey fields in `public.profiles`.
- Step 4 loads active questions from `profile_questions`, lets the user select up to three, and uses the existing answer renderer including single/multiple select, Other, and image uploads.
- Step 5 presents a Novelty-styled profile-card preview and navigation buttons for Profile, Submit, or Explore Library.
- Background document scrolling is locked while the onboarding is open.
- `App.tsx` uses a lazy-loaded onboarding component wrapped in an error boundary so guest pages do not become blank if onboarding fails to load.
