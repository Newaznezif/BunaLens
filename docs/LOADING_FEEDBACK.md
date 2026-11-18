# BunaLens loading and progress feedback

Reusable components live in `components/feedback/Loading.tsx`. They use React Native primitives and the existing BunaLens theme; no dependency or backend change is required.

## Components

- `Spinner`: short indeterminate actions and button states.
- `SkeletonBlock`, `SkeletonText`, `SkeletonCard`, `SkeletonList`: content placeholders while data is genuinely loading.
- `ProgressBar`: determinate progress, only when the operation reports a real percentage.
- `IndeterminateProgress`: longer work where progress cannot be measured.
- `ProcessingLoader`: combined spinner, status text, and indeterminate progress.
- `LoadingOverlay`: blocks interaction on a specific surface while a critical operation is running.

## Usage examples

```tsx
import {
  Spinner,
  SkeletonCard,
  SkeletonList,
  ProgressBar,
  ProcessingLoader,
} from '@/components/feedback/Loading';

// Button content
{busy ? <Spinner color="#FFFFFF" /> : <Text>Submit</Text>}

// While a dashboard request is pending
{loading ? <SkeletonCard /> : <DashboardMetrics />}

// While a batch history request is pending
{loading ? <SkeletonList count={5} /> : <BatchList batches={batches} />}

// Only when upload progress is reported by the upload implementation
<ProgressBar progress={uploadPercent} showPercentage />

// Gemini grading has no trustworthy percentage; use indeterminate feedback
{grading ? <ProcessingLoader title="Assessing sample" description="Please wait" /> : null}
```

## Integration rules

1. Keep loading state tied to the operation that owns it.
2. Clear loading state in `finally` blocks and handle errors separately.
3. Disable repeat submissions while the same operation is in flight.
4. Do not invent progress percentages or imply Gemini is at a specific percentage.
5. Prefer skeletons only when a screen is waiting for remote or persisted data. BunaLens currently hydrates station and batch data from local AsyncStorage; do not show a skeleton over the existing demo/cache content unless the screen exposes a real hydration state.
6. Keep cached content visible during background refresh where possible.
7. Never display payment success until the server confirms the payment.

## Current integration in this branch

The coffee scan submission now uses the shared spinner in its submit button and the shared processing loader while grading is in progress. The remaining components are provided as reusable building blocks for screens with explicit loading states; this change intentionally does not alter local persistence, payment, authentication, offline queue, Supabase, or Gemini service logic.
