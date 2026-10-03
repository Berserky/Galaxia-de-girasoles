# Galaxy Insights Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single reusable insights engine for week, month, year, anniversary, relationship clock, emotions, and derived achievements without duplicating source data or deploying to production.

**Architecture:** Introduce a pure period/domain module shared by tests and UI, add one backend range aggregator behind a new `insights-summary` action, preserve `monthly-summary` as a compatibility adapter, and render week/month/year/anniversary/emotion/achievement surfaces from the same response contract. Data stays in current Supabase tables; no derived persistence is added in Galaxy 1.

**Tech Stack:** Node 24 test runner, vanilla JS/HTML/CSS Android WebView UI, Java 17 Android bridge, Supabase Edge Functions + supabase-js 2.117.2, PostgreSQL/Supabase Storage.

**Spec:** `docs/superpowers/specs/2026-10-03-galaxy-insights-engine-design.md`

## Global Constraints

- Branch: `aegiron/mega-update-3.0`; never merge to `main` or publish stable artifacts in this phase.
- Time zone for all relationship/calendar boundaries: `America/Bogota`.
- Existing `monthly-summary`, `today-history`, and `encounter-stats` contracts must remain compatible.
- No generative AI and no new persistent derived-statistics tables.
- No raw GPS coordinates in Insights responses.
- Keep Lucide, semantic theme tokens, accessibility, responsive behavior, and `prefers-reduced-motion`.
- Source tables remain the source of truth.
- Wrapped must be one aggregate backend request, not twelve monthly UI requests.

## Review Focus

- A week that crosses December/January must produce correct Bogotá start/end dates.
- An anniversary configured on the 29th/30th/31st must clamp to the last valid day when needed.
- An open encounter must be clipped to both `now` and the requested period.
- A current partial period must not be compared misleadingly with a complete prior period.
- Surprise/locked content must never become visible through highlights/photos/insight summaries.

---

### Task 1: Pure Insights Period Domain

**Files:**
- Create: `android/app/src/main/assets/mobile/insights.js`
- Create: `tests/android-insights.test.mjs`
- Modify: `android/app/src/main/assets/mobile/index.html`

**Interfaces:**
- Consumes: ISO days/months/years and `startDate`.
- Produces: `GalaxyInsights.periodFor(kind,key,today)`, `shiftPeriod(period,delta)`, `relationshipClock(startDate,nowIso)`, `anniversaryDay(startDate,month)`, `compareMetrics(current,previous)`, `compatibleMood(a,b)`.

- [ ] **Step 1: Write failing period-domain tests**
  Cover week crossing year, leap February, anniversary day 31 clamping, real-calendar relationship clock, metric comparison, compatible moods, and invalid/future ranges.

- [ ] **Step 2: Run `npm test -- tests/android-insights.test.mjs` and verify RED**
  Expected: FAIL because `mobile/insights.js` does not exist.

- [ ] **Step 3: Implement the pure domain module**
  Keep it dependency-free and export through CommonJS for Node tests plus `globalThis.GalaxyInsights` for the Android WebView.

- [ ] **Step 4: Run targeted and full Node tests**
  Expected: new tests PASS; existing suite remains green.

- [ ] **Step 5: Commit**
  `feat(insights): add reusable period domain`

---

### Task 2: Range Aggregator and Backward-Compatible API

**Files:**
- Modify: `supabase/functions/android-companion/index.ts`
- Modify: `android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java`
- Create: `tests/android-insights-contract.test.mjs`
- Modify: `scripts/qa-android-mobile.mjs`

**Interfaces:**
- Consumes: period object from request body, existing `galaxy_items`, `galaxy_trip_history`, `galaxy_encounters`, `galaxy_daily`, `galaxy_bond`, `galaxy_bond_participation`, `galaxy_place_events`, `galaxy_places`, and Storage object metadata.
- Produces: action `insights-summary` with `{period,counts,trips,encounters,places,connection,moods,questions,bond,highlights,photos,achievements,comparison,relationship}`.
- Compatibility: `monthly-summary` delegates to the same aggregator and returns all legacy fields unchanged.

- [ ] **Step 1: Write failing contract tests**
  Assert the new action is allowed end-to-end, `monthly-summary` remains present, range queries clip encounters, locations return names only, locked surprises are excluded, and Wrapped aggregation is one backend action.

- [ ] **Step 2: Verify RED with Node tests**
  Expected: FAIL because `insights-summary` and the shared aggregator do not exist.

- [ ] **Step 3: Extract reusable backend helpers**
  Add validation/range helpers, content effective-date helper, privacy-safe item filter, interval clipping, mood aggregation, achievements catalog/evaluator, and photo-candidate selection by trustworthy temporal metadata only.

- [ ] **Step 4: Implement `aggregateInsights` and `insightsSummary`**
  Query tables by range wherever indexed columns permit. Keep coordinates out of response payloads. For storage photos use only metadata/timestamps that exist; do not fabricate associations.

- [ ] **Step 5: Convert `monthlySummary` into an adapter**
  Preserve legacy `month/counts/trips/encounters/connection/bond/highlights` fields while sourcing them from the central engine.

- [ ] **Step 6: Register Android bridge action and QA assertions**
  Add `insights-summary` to the native allowlist and source-contract QA.

- [ ] **Step 7: Run targeted/full Node tests**
  Expected: all Node tests green.

- [ ] **Step 8: Commit**
  `feat(insights): centralize range aggregation`

---

### Task 3: Week, Month, Year/Wrapped, Anniversary, and Relationship Clock UI

**Files:**
- Modify: `android/app/src/main/assets/mobile/app.js`
- Modify: `android/app/src/main/assets/mobile/app.css`
- Modify: `android/app/src/main/assets/mobile/index.html`
- Modify: `tests/android-insights.test.mjs`
- Modify: `scripts/qa-android-mobile.mjs`

**Interfaces:**
- Consumes: `GalaxyInsights` and `api('insights-summary', {kind,key})`.
- Produces: teaser/actions `insights-week-open`, `insights-month-open`, `insights-year-open`, anniversary experience, and relationship clock card.

- [ ] **Step 1: Add failing UI/source-contract tests**
  Require week/year entry points, period navigation, a single yearly API call, anniversary gated by configured `startDate`, relationship clock, and reduced-motion Wrapped styling.

- [ ] **Step 2: Verify RED**
  Expected: source-contract tests fail because the new experiences are absent.

- [ ] **Step 3: Add shared Insights UI renderer**
  Reuse metric/highlight primitives instead of cloning monthly markup.

- [ ] **Step 4: Implement Nuestra Semana**
  Monday-Sunday navigation, no future weeks, metrics/highlights/photos/places/emotions/questions/songs/gestures/events.

- [ ] **Step 5: Evolve Nuestro Mes**
  Switch it to `insights-summary`, display meaningful prior-month deltas, and preserve the existing teaser/action alias.

- [ ] **Step 6: Implement Nuestro Año / Galaxia Wrapped**
  Render animated cards with annual totals and monthly distribution from one response. Respect reduced motion and keep capture-friendly card boundaries.

- [ ] **Step 7: Implement anniversary experience and relationship clock**
  Show only when `startDate` exists and the anniversary condition applies; do not persist derived content.

- [ ] **Step 8: Run targeted/full Node tests**
  Expected: all Node tests green.

- [ ] **Step 9: Commit**
  `feat(insights): add week year anniversary experiences`

---

### Task 4: Emotional Calendar, Trends, and Achievements UI

**Files:**
- Modify: `android/app/src/main/assets/mobile/app.js`
- Modify: `android/app/src/main/assets/mobile/app.css`
- Modify: `tests/android-insights.test.mjs`
- Modify: `scripts/qa-android-mobile.mjs`

**Interfaces:**
- Consumes: `summary.moods`, `summary.connection`, `summary.comparison`, `summary.achievements`.
- Produces: accessible monthly emotional heatmap, per-person/joint views, neutral trend copy, coincidence display, achievement cards.

- [ ] **Step 1: Add failing tests for descriptive-only emotional copy**
  Assert no diagnostic/clinical scoring, legend exists independent of color, exact/compatible coincidence counts render, and empty/incomplete data is handled.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement emotional heatmap and coincidence view**
  Use semantic theme tokens and labels/tooltips/text so color is never the only signal.

- [ ] **Step 4: Implement neutral trends**
  Convert numeric deltas to descriptive copy only when sample thresholds are met.

- [ ] **Step 5: Implement achievements**
  Render catalog-derived badges with Lucide icons, progress where useful, and no new persistence.

- [ ] **Step 6: Run targeted/full Node tests**

- [ ] **Step 7: Commit**
  `feat(insights): add emotional trends and achievements`

---

### Task 5: Full QA and Branch Verification

**Files:**
- Modify only if verification exposes regressions: affected source/tests.
- Optional: create/update draft PR from `aegiron/mega-update-3.0` to `main` solely to run pull-request CI; do not merge.

**Interfaces:**
- Consumes: completed Galaxy 1 branch.
- Produces: fresh evidence for Node suite, mobile contract QA, Android JUnit, lint, and debug build.

- [ ] **Step 1: Run full Node suite**
  `npm test` → 0 failures.

- [ ] **Step 2: Run build/static QA**
  `npm run build` and `node scripts/qa-android-mobile.mjs` → exit 0.

- [ ] **Step 3: Run Android verification**
  `gradle -p android testDebugUnitTest lintDebug assembleDebug` through GitHub pull-request CI or an equivalent isolated runner. Release publication steps must not run.

- [ ] **Step 4: Inspect CI failures and fix using systematic debugging**
  Repeat until green or record a concrete external blocker.

- [ ] **Step 5: Compare branch to main**
  Verify only intended Galaxy 1/docs/QA changes exist; no version bump, signing changes, updater channel changes, or deployment changes.

- [ ] **Step 6: Final verification commit if required**
  `test(insights): close Galaxy 1 QA gaps`
