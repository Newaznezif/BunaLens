# BunaLens

**Instant Coffee Quality Vision for Jimma & Beyond**

BunaLens is an Expo / React Native mobile application for AI-assisted visual screening of Arabica coffee cherries and export-ready green beans at washing stations and cooperative intake points in Jimma Zone, Ethiopia.

> **Grading and pricing disclaimer:** Camera-based results are preliminary visual estimates. They are not official Ethiopian Commodity Exchange (ECX) grades, laboratory results, export approvals or certified Q-Grader assessments. ETB prices are illustrative benchmarks, not live market quotations. Validate thresholds and price assumptions with qualified local graders and current market data before commercial use.

## Features

- Expo Router navigation: Home, Scan Buna, Batches and Station.
- TypeScript strict mode and NativeWind styling with a Jimma coffee palette.
- English / Afaan Oromo labels with persistent language selection.
- Camera capture and gallery selection for red cherry and green bean samples.
- Gemini 2.5 Flash JSON grading adapter with response validation; deterministic demo fixtures without a key.
- Jimma woreda tagging and optional GPS origin capture.
- Defect composition, indicative ETB per 17 kg Feresula and estimated lot value.
- Local station and batch persistence plus a queued-capture foundation.
- QR-enabled batch certificate component and shareable batch summary.
- Supabase client and owner-scoped PostgreSQL / private Storage schema.
- Chapa checkout through a trusted server endpoint, with a local sandbox fallback.

## Requirements

- Node.js 20.19+ (Node 22 LTS recommended)
- npm 10+
- Expo Go compatible with Expo SDK 54 on Android or iOS
- Optional Gemini API key, Supabase project and Chapa backend endpoint

## Run locally

```bash
git clone https://github.com/Newaznezif/BunaLens.git
cd BunaLens
npm install
cp .env.example .env
npx expo start
```

Scan the Expo Go QR code with the Expo Go app. Press `a` for a configured Android emulator or `i` on macOS with an iOS simulator.

## Environment variables

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_GEMINI_PROXY_URL` | HTTPS server endpoint that securely calls Gemini and returns a validated grading JSON object. |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable / anon key. Never use service-role here. |
| `EXPO_PUBLIC_CHAPA_INITIALIZE_URL` | Trusted backend endpoint that initializes Chapa checkout and returns `checkout_url`. |
| `EXPO_PUBLIC_APP_ENV` | `demo` by default |

Never put a Gemini API key, Chapa secret key or Supabase service-role key in an Expo public environment variable. Chapa initialization and payment verification must happen server-side.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Configure Supabase Auth and create a station row owned by the signed-in user.
4. Add the project URL and publishable/anon key to `.env`.
5. Keep RLS enabled and test policies with a non-owner account.

The `coffee-samples` Storage bucket is private. Store objects under the station UUID folder, e.g. `<station-uuid>/<batch-id>.jpg`. The bundled seeded station is demo-only; production cloud writes must use a real authenticated station UUID. Supabase persistence is not yet wired into the mobile batch workflow.

## AI grading and demo mode

Without a Gemini key, deterministic local fixtures keep the pitch demo usable. With a configured proxy, `services/geminiVision.ts` sends the sample, MIME type, sample category and woreda to your server; the server calls `gemini-2.5-flash` and returns a validated JSON result. Without the proxy, real-photo grading fails explicitly rather than silently returning a fabricated demo grade. Use the built-in demo presets only when presenting sample results. The schema is an application screening contract, not an official ECX standard. A production rollout requires a secured inference proxy, curated Jimma training/evaluation images, confidence calibration, human review and audit logs.

## Offline behavior

Station profile and batch history persist in AsyncStorage. When the device is offline, selected sample images are added to a local queue and are not presented as graded batches. Automatic queue processing, server upload, retry/backoff and reconciliation are not yet implemented. A locally queued record is not a cloud-verified certificate.

## Payments

`services/chapaService.ts` expects a trusted backend endpoint. The backend must create a unique transaction reference, verify Chapa callbacks/webhooks server-side and only then credit the station. The local sandbox adds demo credits only; it never charges a payment method.

## Quality checks

```bash
npm run typecheck
npx expo-doctor
npx expo start --clear
```

## Repository layout

```text
app/                 Expo Router screens and layouts
components/          Camera, logo, scorecard and certificate UI
constants/           Jimma woreda data, labels and demo fixtures
contexts/            Language and station providers
services/            Gemini, Supabase, Chapa and offline queue adapters
supabase/schema.sql  Database and Storage policies
types/               Strict domain interfaces
```

## Production roadmap

- Deploy and monitor the secured Gemini inference API configured by `EXPO_PUBLIC_GEMINI_PROXY_URL`.
- Complete authenticated station onboarding and ownership-safe cloud persistence.
- Implement a durable background sync worker with retry/backoff and image upload.
- Implement Chapa webhook verification and an idempotent credit ledger.
- Validate grading thresholds, defect taxonomy and price benchmarks with ECX / local Q-graders.
- Add real-device tests, model evaluation, accessibility checks, privacy disclosures and a public certificate verification endpoint.

## License

All rights reserved unless a license is added by the repository owner.
