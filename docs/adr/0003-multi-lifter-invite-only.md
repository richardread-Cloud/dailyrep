# Multi-Lifter from day one, with invite-only sign-up

Although the first and only Lifter is the author, every record is owned by a Lifter and isolated with Supabase Row Level Security from the start, because retrofitting ownership onto an existing schema and data is far more painful than paying for it now. Sign-up uses Google sign-in restricted to an email allowlist, so the app stays effectively private until someone is invited; there are no admin or social features.

## Consequences

- Exercises are split into a shared read-only Built-in library and per-Lifter Custom Exercises; the weight unit (kg or lb) is a per-Lifter setting. (Bar and plate settings were dropped on 2026-10-08 along with the plate breakdown.)
- Google OAuth in an iOS home-screen web app can bounce to Safari and lose the session; this must be verified on a real iPhone first, with email + password as the fallback.
