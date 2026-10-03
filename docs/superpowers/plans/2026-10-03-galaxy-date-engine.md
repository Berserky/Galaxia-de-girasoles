# Galaxy Date Engine — Mega Update 3.0

Branch: `aegiron/mega-update-3.0`
Base for Galaxy 2: `de130340f20ee9640125c5b5a2a92fc2691cd1cb`
Production: untouched.

## Goal

Create one deterministic contextual engine for daily questions, question decks, favorites, Date Mode, pending-plan roulette, Surprise Date 2.0, sequential date planning, and plan categories.

Conceptual pipeline:

`DateContext -> Constraints -> Candidate Plans -> Score -> Experience`

Galaxy Insights remains intact and may be consumed as context, but Date Engine does not duplicate its statistics.

## Architecture

### Pure engine
New `supabase/functions/android-companion/date-engine.ts` exposes pure functions for:
- question catalog/decks;
- contextual question selection with repetition penalty;
- constraints normalization;
- legacy plan-category normalization;
- candidate construction from built-in ideas, saved/frequent places, pending plans and completed plans;
- deterministic candidate scoring;
- reproducible roulette;
- Surprise Date 2.0;
- sequential planner;
- Date Mode recap references.

No generative AI.

### Stable daily question assignment
Add `galaxy_daily_questions`:
- `day` primary key;
- `question_id`;
- `deck`;
- `context_kind`;
- `favorite`;
- optional `memory_id` reference to an existing memory;
- created timestamp.

It stores no answer text. Answers remain only in `galaxy_daily` and keep the current reveal-only-after-both-answer behavior.

### Backend service
One action: `date-engine` with operations:
- `context`
- `question`
- `favorite`
- `favorite-memory`
- `surprise`
- `roulette`
- `planner`
- `date-recap-save`

The server gathers existing items, places, frequent-place evidence, locations, trip/encounter history and daily history, then feeds the pure engine.

### Date Mode
Ephemeral client session:
- session id;
- start time;
- current plan reference;
- selected question ids;
- photo paths;
- current song reference;
- optional place/location context;
- elapsed time.

Nothing is persisted until “Guardar esta noche”. Saving creates one memory containing references/metadata, never copies the plan/photo/song records.

### Plan categories
Canonical values:
- `this-week`
- `when-possible`
- `someday`
- `travel`
- `home`

Legacy free-text `category` remains supported. New plans add `planCategory`; old plans are normalized at read/scoring time.

## QA

Pure tests:
- 0/low/high budget;
- 30 minutes / several hours;
- home/out;
- GPS/no GPS;
- motorcycle/transit;
- frequent places/no frequent places;
- no pending plans;
- deterministic roulette;
- repetition avoidance;
- anniversary/memory/trip context;
- plan category compatibility;
- recap references without duplicated source bodies.

Contract tests:
- `date-engine` allowed end-to-end;
- stable question assignment table exists;
- responses remain masked;
- favorite-memory requires both answers before copying them into one explicit memory;
- repeated recap save is idempotent by session id;
- Date Mode UI has music/question/photo/current plan/timer/location/save controls;
- camera path is native;
- reduced-motion roulette.

Final verification:
- full Node suite;
- mobile QA;
- Android JUnit/Lint/assembleDebug;
- signing/release jobs skipped on PR;
- no merge, no deployment.
