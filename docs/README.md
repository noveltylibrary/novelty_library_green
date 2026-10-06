# Novelty Library WebApp

Novelty Library is a React/Vite web application for book discovery, reader reviews, community engagement, reader profiles and editorial administration.

This documentation set was generated from the uploaded `NL_WA_1_35.zip` archive after inspecting the `NL_WA_1_34` application source.

## Documentation

- [`PRD.md`](./PRD.md) — product requirements, users, workflows, functional/non-functional requirements and success metrics.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — application structure, data flow, Supabase architecture, storage, RPCs and security boundaries.
- [`DESIGN.md`](./DESIGN.md) — visual language, color tokens, typography, component behavior, profile-card design and responsive rules.
- [`RULES.md`](./RULES.md) — engineering, product, security, data, UI and change-management invariants.
- [`TASKS.md`](./TASKS.md) — implementation baseline, production verification backlog and future work.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- Framer Motion
- Lucide React
- DOMPurify
- html-to-image
- Vite PWA

## Core product areas

### Public reading
- Home.
- Review shelf.
- Individual review pages.
- Analytics.
- About.
- Review guidelines.
- Legal/cookie pages.

### Reader accounts
- Email/password authentication.
- Google OAuth.
- Password recovery.
- Reader profiles.
- Configurable profile questions.
- Public profiles.
- Profile-card generation/download.
- Stories.
- Following/followers.
- Notifications.

### Review workflow

```text
Reader submission
      |
      v
   Pending
      |
      +------> Declined
      |
      v
   Approved
      |
      v
  Master List
      |
      v
Community Review
      |
      +--> Reader likes
      +--> Reader ratings
      +--> Reader reviews/comments
```

## Important rating distinction

The platform has two different concepts:

**R/W Rating** — the original reviewer's rating/opinion.

**NL Rating** — the cumulative average of reader ratings submitted on the community review post.

The current implementation intentionally does not include the R/W Rating in the NL Rating calculation.

## Local development

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Type-check:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Environment variables

The frontend expects at minimum:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Never place a Supabase service-role key in the frontend environment.

## Supabase requirements

The application expects a Supabase project containing the tables, storage buckets and RPC/database functions described in `ARCHITECTURE.md`.

The application uses **one Supabase client**. Do not add a second `createClient()` instance for a feature.

## Important source locations

```text
src/
├── App.tsx
├── components/
├── lib/
│   ├── auth.tsx
│   ├── reviews.ts
│   ├── engagement.ts
│   ├── profileQuestions.ts
│   ├── profileCoreFields.ts
│   ├── profileLayout.ts
│   ├── social.ts
│   ├── moderation.ts
│   └── supabase.ts
├── pages/
└── types/
```

## Main admin areas

Admin access is protected by the backend `is_admin()` function.

The current admin hub provides:
- Book Reviews.
- Admins & Contacts.
- Users & Accounts.
- Finances and Payments.
- WebApp Pages Moderation.
- Supabase Dashboard shortcut.

## Profile configuration

Admins can configure profile questions from the WebApp Pages Moderation area. Supported question types include:
- Short answer.
- Paragraph.
- Number.
- Year.
- URL.
- Single select.
- Multiple select.
- Image upload.

Multi-select questions can have a maximum-selection cap and optional A–Z sorting. Profile-card appearance can be configured as a tag, question + answer, or answer-only.

## Profile-card export

The current card supports:

| Format | Export size |
|---|---:|
| 9:16 | 1080 × 1920 |
| 16:9 | 1600 × 900 |
| 3:4 | 1200 × 1600 |
| 4:5 | 1080 × 1350 |
| 1:1 | 1080 × 1080 |

The profile-card renderer adapts its layout by aspect ratio and progressively fits content when necessary.

## Operational principles

1. Protect editorial trust.
2. Keep reviewer and community ratings separate.
3. Sanitize user-generated text.
4. Validate external URLs.
5. Enforce admin permissions server-side.
6. Keep non-critical integrations from breaking the reading experience.
7. Preserve light/dark accessibility and reduced-motion behavior.
8. Keep documentation synchronized with substantial product/architecture changes.

## Deployment checklist

Before production deployment:

```text
[ ] npm run typecheck
[ ] npm run lint
[ ] npm run build
[ ] Verify production environment variables
[ ] Verify Supabase OAuth redirects
[ ] Verify RLS and admin RPC authorization
[ ] Verify review submission/publish flow
[ ] Verify public review pages
[ ] Verify profile/public-profile privacy
[ ] Verify profile-card export
[ ] Verify community engagement
[ ] Verify Adsterra configuration
[ ] Verify mobile and dark theme
```

## Documentation maintenance

When behavior changes:
- Product changes → update `PRD.md`.
- Architecture/data changes → update `ARCHITECTURE.md`.
- Visual/UI changes → update `DESIGN.md`.
- New invariant/security rule → update `RULES.md`.
- Implementation status → update `TASKS.md`.
- Setup/deployment changes → update `README.md`.
