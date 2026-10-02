# Couple moments Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement each owned task. Steps use checkbox syntax.

**Goal:** Deliver all eight couple features, synced and integrated into version 1.3.0.
**Architecture:** Separate bond feature data/domain and UI from existing content and navigation. Android accesses an authenticated minimal companion endpoint.
**Tech Stack:** Vanilla JS, Node SQLite, Supabase Postgres/Storage, Java Android WorkManager.
**Spec:** docs/superpowers/specs/2026-10-02-couple-moments.md

## Global constraints
Keep existing auth, content, mobility and safe-area design. Sources read-only. No public private media. No compulsory streaks. Device operations require existing encrypted token. Versions 1.3.0/code4.

## Review focus
Hidden game answer at storage boundary; version conflicts don't overwrite shared notes; microphone denied/cancel releases recording tracks; slow background requests don't block navigation; revoked Android token clears private caches.

### Task 1: Data/domain/cloud/local APIs
Files app/public/bond-domain.js, app/bond-store.mjs, app/server.mjs, app/cloud/adapter.js, supabase migration/schema, tests/bond*. Interfaces exactly spec.
- [x] Read spec, create failing domain/API tests.
- [x] Implement validated storage and RPC privacy, audio signed routes, garden and export.
- [x] Verify local tests and supply migration for root deployment.

### Task 2: Web UI
Files app/public/bond-ui.js, bond.css, app.js, index.html, build-pages/install/sw packaging, tests/bond-ui*. Consume spec APIs and bond-domain.
- [x] Create failing UI/domain integration checks.
- [x] Integrate gestures/garden/quiz/weekly ritual/notes/audio/date filters and widget photo picker.
- [x] Responsive verification, avoid blocking existing app startup.

### Task 3: Android + edge
Files android/**, supabase/functions/android-companion/index.ts, workflow metadata, tests/android moments*. Consume spec device actions.
- [x] Create useful Android unit tests for gesture dedup/calendar.
- [x] Implement widget, worker notifications, authenticated edge moments/gesture.
- [x] Verify Java compilation via CI and XML resources; bump signed update metadata.

### Task 4: Integrate and release
- [x] Review all diffs, full tests/build, SQL migration/advisors/RLS probes.
- [ ] CI signed build and PR merge (edge deployed, browser verified).
- [ ] Verify live modules/update metadata/APK hash and provide links plus actual screenshots.

Validation ledger: Node suite61 tests; SQL migration deployed and rollback membership/privacy/version probes passed. Reviewer approved cache privacy and conflict fixes. Local actual browser uploaded/played generated1s MP3, saved ritual, two-profile game reveal, saved date and widget photo. 320px no horizontal overflow. Native JUnit4 passed; XML parsed. Microphone hardware, real widget and OS notification delivery require device verification. SQL advisor warnings are intentional guarded RPC-only access; preexisting Auth leaked-password setting unchanged.
