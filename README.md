# BunaLens

**AI-assisted visual coffee quality screening for Jimma, Ethiopia.**

BunaLens is a cross-platform Expo / React Native application for coffee washing stations, cooperative intake teams and coffee producers. It supports red coffee cherries (Buna Diimaa) and green coffee beans (Buna Qullaa), with Jimma Zone as the initial operating geography.

> **Assessment disclaimer:** Camera-based assessments are preliminary visual screening, not official ECX grades, laboratory results, export approvals or Q-Grader certificates. Market values are indicative estimates based on dated benchmark records. They are not confirmed buyer offers.

## Implemented product capabilities

- Expo Router navigation, TypeScript strict mode, NativeWind and reusable React Native components.
- English / Afaan Oromo labels.
- Camera and gallery capture, contextual camera permission and optional GPS tagging.
- Jimma woreda selection and user-entered lot weight.
- Authenticated Gemini 2.5 Flash Edge Function with structured JSON output validation; the Gemini key stays server-side.
- Local demo presets that are clearly labelled and never presented as actual image inference.
- Indicative ETB pricing from configurable benchmark data, using 1 Feresula = 17 kg.
- AsyncStorage persistence for station and batch metadata.
- Persistent image-file queue, connectivity detection, manual and reconnect-triggered sync.
- Supabase email/password sign-in, station registration, private sample-image storage and batch persistence.
- QR certificate identifiers and a public-safe verification Edge Function.
- PNG sharing and PDF certificate export.
- Chapa hosted checkout initialization and server-side transaction verification contract.
- Local payment sandbox that does not charge money.

## Technology baseline

The repository currently targets **Expo SDK 54 / React Native 0.81 / React 19.1**. SDK 54 is intentionally retained as the Expo Go-compatible baseline for this project; moving to a newer SDK must be treated as a coordinated Expo, React Native and native-module upgrade. Expo Go itself only supports the SDK bundled in the installed Expo Go client.

Core Expo modules (camera, image picker, location, haptics, file system, print and web browser) are selected for Expo Go compatibility where their SDK 54 versions are available. `react-native-view-shot` is a third-party native module and requires a custom development build for its certificate-image capture path. Use the EAS development profile for that feature.

## Requirements

- Node.js 20.19+ (Node 22 LTS recommended)
- npm 10+
- Expo Go compatible with SDK 54 for the Expo Go demonstration path
- EAS CLI for Android APK/AAB and iOS IPA builds
- Supabase project for authentication, cloud persistence, Edge Functions and Storage
- Gemini API key stored only as a Supabase Edge Function secret
- Chapa merchant secret stored only as a Supabase Edge Function secret

## Run locally

```bash
git clone https://github.com/NewazNezif/BunaLens.git
cd BunaLens
npm install
cp .env.example .env
npx expo start
```

Scan the QR code with an SDK 54-compatible Expo Go client. Camera capture, gallery selection and local demonstration flows are intended to work without Supabase credentials. Real-image AI grading and cloud services require a signed-in account and configured backend.

## Environment variables

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon / publishable key only |
| `EXPO_PUBLIC_GEMINI_PROXY_URL` | `https://<project>.supabase.co/functions/v1/gemini-grade` |
| `EXPO_PUBLIC_BUNALENS_SYNC_URL` | `https://<project>.supabase.co/functions/v1/coffee-sync` |
| `EXPO_PUBLIC_CHAPA_INITIALIZE_URL` | `https://<project>.supabase.co/functions/v1/chapa-initialize` |
| `EXPO_PUBLIC_CERTIFICATE_VERIFY_BASE_URL` | `https://<project>.supabase.co/functions/v1/certificate-verify` |
| `EXPO_PUBLIC_APP_ENV` | `demo` or `production` |

Never put `GEMINI_API_KEY`, `CHAPA_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or any private credential in an `EXPO_PUBLIC_*` variable.

## Supabase setup

1. Create a Supabase project and configure email/password Auth.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Apply all files in `supabase/migrations/` in chronological order. These add payment records, benchmark data, certificate identifiers, Pro expiry, idempotency and transactional credit functions.
4. Configure the private `coffee-samples` Storage bucket. The base schema creates it with a 10 MB file limit.
5. Add the project URL and public anon / publishable key to the mobile `.env`.
6. Set Edge Function secrets:
   - `GEMINI_API_KEY`
   - `CHAPA_SECRET_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Optional `CHAPA_CALLBACK_URL` and `CHAPA_RETURN_URL`
7. Deploy the Edge Functions listed below.
8. Register a station from the app's Station tab → Sign in / Register station.

The app stores local station and batch data when cloud credentials are absent. Cloud operations require a signed-in user and an owned station UUID. RLS policies scope station and batch access to the authenticated owner.

### Edge Functions

| Function | Access | Purpose |
|---|---|---|
| `gemini-grade` | Authenticated JWT | Verify station ownership, call Gemini 2.5 Flash, validate output and atomically debit one scan credit |
| `coffee-sync` | Authenticated JWT | Idempotently grade queued images, upload to private Storage and persist canonical batch records |
| `chapa-initialize` | Authenticated JWT | Create server-priced Chapa checkout and pending transaction |
| `chapa-webhook` | Public provider callback | Independently verify transaction with Chapa before applying credits or Pro entitlement |
| `certificate-verify` | Public read-only | Return minimal certificate verification details by QR identifier |

Deploy with the Supabase CLI after linking the project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy gemini-grade
supabase functions deploy coffee-sync
supabase functions deploy chapa-initialize
supabase functions deploy chapa-webhook
supabase functions deploy certificate-verify
```

Set secrets with the Supabase CLI or Dashboard. Do not commit a local `.env` containing secrets.

## AI vision and quality controls

The mobile app sends the image, MIME type, sample category, woreda, station ID and stable capture idempotency key to the authenticated `gemini-grade` Edge Function. The function verifies the user and station, invokes `gemini-2.5-flash`, validates the structured result and returns only visual assessment fields. Prices are never requested from Gemini.

A valid coffee assessment consumes one scan credit through an idempotent database function. A retry with the same capture key does not debit a second credit. Non-coffee images do not consume a credit. The local credit count is a UI cache; the database is authoritative.

The visual grade labels are application screening estimates, not an official ECX grading standard. Production use requires representative Jimma images, evaluation by qualified local graders, calibration, confidence thresholds, human review and auditability.

## Pricing and financial estimates

The app uses configurable dated benchmark records. One Feresula equals 17 kg. The initial values in `constants/marketBenchmarks.ts` and the matching database seed are demonstration values only. Replace them with documented local buyer quotations or an approved market-data feed before making commercial decisions.

Displayed values are estimates, not official quotations or guaranteed sale proceeds. A sorting scenario is an indicative calculation, not a promise of realized income.

## Offline behavior

- Batch metadata and station profile are stored in AsyncStorage.
- Captured images are copied to the app's document directory with expo-file-system; large image bytes are not stored in AsyncStorage.
- Pending captures retain a stable idempotency key.
- On reconnection, the app attempts sync automatically and also exposes a manual sync action.
- The authenticated `coffee-sync` function stores images in private Supabase Storage and returns a canonical batch.
- Local images are removed from the queue only after the server returns a valid saved batch.

Offline captures made before station registration are reassigned to the newly connected station during onboarding. Until a station is registered and signed in, queued captures remain local.

## Payments

The packages are fixed on the server:
- Starter Pack: 50 scans for 500 ETB.
- Washing Station Unlimited: 30 days for 2,500 ETB.
- New stations: 10 initial scans.

The mobile app never supplies an authoritative price. The backend verifies station ownership, initializes Chapa using its private key, and stores a pending payment. The callback function independently calls Chapa's transaction verification endpoint and checks transaction reference, amount and currency. Only then does an atomic database function grant credits or extend Pro access. A browser redirect alone never grants an entitlement.

If no Chapa initialization endpoint is configured, the app offers an explicitly labelled local demonstration sandbox. No money is collected in sandbox mode.

## EAS builds

The repository includes `eas.json` profiles for development, preview and production.

```bash
npm install
npx eas-cli login
npx eas-cli build --profile development --platform android
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile production --platform android
npx eas-cli build --profile production --platform ios
```

The preview Android profile produces an installable APK; production Android produces an AAB. iOS production requires an Apple Developer account and signing credentials. Run `eas init` once to attach the repository to an EAS project.

Use the development profile for `react-native-view-shot` and other native modules not included in Expo Go. Native module additions require a new development build.

## Quality checks

```bash
npm run typecheck
npx expo-doctor
npx expo start --clear
```

CI runs TypeScript validation and Expo Doctor on pushes and pull requests to `main`.

## Repository layout

```text
app/                    Expo Router screens and layouts
components/             Reusable UI and certificate components
constants/              Jimma woreda data, demo fixtures and benchmarks
contexts/               Language and station state
services/               AI, Supabase, persistence, payments and offline queue
supabase/functions/     Authenticated Edge Functions and public verification
supabase/migrations/    Database security and business-rule migrations
supabase/schema.sql     Base PostgreSQL schema and Storage policies
types/                  Domain interfaces
```

## Current limitations

- The repository contains the mobile client, SQL migrations and Edge Function source; they still need to be deployed and configured in the user's Supabase project.
- Live market benchmark data has not been connected. Seeded prices are labelled demonstration data.
- Physical-device camera, offline restart/recovery, real Chapa test transactions, and Android/iOS EAS builds must be exercised before production release.
- A visual model cannot certify coffee quality; qualified grading and lab workflows remain necessary.

## License

All rights reserved unless a license is added by the repository owner.
