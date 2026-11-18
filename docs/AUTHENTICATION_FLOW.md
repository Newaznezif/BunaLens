# BunaLens Authentication-First Navigation

## Expected route behavior

- A user without a valid Supabase session is routed to `/auth` before application screens are exposed.
- The existing auth screen provides Sign In and Create Account modes.
- A user with a persisted valid Supabase session can enter the tab application.
- Signing out invalidates the session; the root route guard returns the user to `/auth`.
- The guard covers the tabs, batch details, settings, and other app routes.

## Backend dependency

This change does not create or simulate user accounts. Real registration and sign-in require valid Supabase project URL and publishable/anon client key in the app environment, plus Supabase Auth configuration.

The existing auth screen also provisions or retrieves a washing-station record after sign-in. That database operation will only work after the required schema and Row Level Security policies are deployed. Configure those separately before treating onboarding as production-ready.

## Local verification

1. Configure the Supabase client environment variables using the project publishable key. Never place a service-role key in the Expo client.
2. Run `npm run typecheck`.
3. With no valid session, launch the app and verify that the auth screen is shown and direct navigation to tabs/settings/batch detail returns to auth.
4. Sign in with a test account and verify that the tabs become accessible.
5. Sign out from Settings and verify that the app returns to auth.
6. Test app restart with a persisted session and with a cleared session.

## Scope

This change only adds root-level session restoration and route protection. It does not change Supabase schema, Edge Functions, scan/grading, offline queue, credits, Chapa, or station data logic.
