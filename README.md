# BunaLens

**Instant Coffee Quality Vision for Jimma & Beyond**

Expo + React Native + TypeScript mobile application for visual screening of Arabica coffee cherries and green beans at washing stations in Jimma Zone, Ethiopia.

## Important product limitation
BunaLens produces AI-assisted visual screening estimates only. It does not issue official ECX grades, laboratory results, export approvals, or certified Q-Grader assessments. Price values are indicative benchmarks, not live market quotations.

## Stack
- Expo SDK 54, Expo Router, React Native and strict TypeScript
- NativeWind, lucide-react-native and Expo native device APIs
- Gemini 2.5 Flash JSON grading adapter
- Supabase PostgreSQL and private Storage starter
- AsyncStorage offline persistence and local demo mode
- Chapa checkout through a trusted server endpoint; local sandbox fallback

## Run
```bash
npm install
cp .env.example .env
npx expo start
```
Scan the Expo Go QR code with an Android or iOS device. See `.env.example` for optional integrations.

## Security
Never ship Chapa secret keys or Supabase service-role keys in the mobile app. Gemini public client keys are exposed in the bundle; use a secured backend proxy for production. Configure Supabase Auth and row-level security before cloud writes.

## Jimma coverage
Gomma, Limmu Kossa, Mana, Seka Chekorsa, Gera, Kersa and Jimma Town.

## Status
Initial application scaffold. Production rollout still requires validated grading methodology, model evaluation, authenticated station onboarding, durable background sync, payment webhook verification and real-device testing.