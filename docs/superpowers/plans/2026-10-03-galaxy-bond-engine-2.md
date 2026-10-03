# Galaxy Bond Engine 2.0 — Mega Update 3.0

Branch: `aegiron/mega-update-3.0`
Production: untouched. New SQL is versioned only; no remote migration is applied.

## Invariants

- Existing `galaxy_bond_participation` rows remain the source of earned garden days.
- Total joint days are never replaced by streak values.
- Streak calculations use America/Bogota calendar days.
- Location is never enabled by Bond Engine.
- Battery/song/location-derived widget values are emitted only when the existing sharing flags permit them.
- Plans, Date Engine, Goals Engine and Insights remain separate engines.

## Domain

### Bond progress
Derived from participation rows:
- totalDays: every distinct day where persons 0 and 1 participated;
- currentStreak: consecutive tail ending today or yesterday in Bogota;
- recordStreak: historical maximum consecutive run;
- garden stage/unlockables derived from totalDays.

Existing garden thresholds 1/7/14/30 are preserved and extended additively.

### Gesture catalog
Built-ins remain compatible:
- hug
- kiss
- miss

Bond 2.0 adds:
- tap (haptic-first);
- shared custom gestures with name, Lucide icon, text and behavior.

Allowed behaviors:
- message
- haptic
- message_haptic

History remains in `galaxy_bond`; custom definitions are relational and independent.

## Push event layer

Reusable event types:
- gesture
- arrived_safe
- nearby
- capsule
- note
- reminder

Tables:
- `galaxy_push_tokens`: one current FCM token per paired device;
- `galaxy_push_subscriptions`: explicit event opt-ins per device;
- `galaxy_push_events`: sanitized event envelope/audit row;
- `galaxy_push_deliveries`: per-device delivery result.

The Edge Function dispatches through FCM HTTP v1 using `FCM_SERVICE_ACCOUNT_JSON` from server-side environment only.
No service account/private key enters Android or repository source.

FCM client configuration uses non-secret build variables only. When Firebase client identifiers are absent, push stays unavailable without breaking polling/widget behavior.

## Android

- FirebaseMessagingService receives data events.
- onNewToken persists and syncs token after pairing.
- revoked/unpaired devices unregister push.
- haptic feedback has a dedicated local opt-in.
- blocked notification permission does not silently enable notifications.
- WorkManager remains fallback refresh/sync, not the instant transport.

## Widget 2.0

Per-widget local configuration:
- modules selected independently;
- textual modules can be ordered;
- compact/large widget adapts visible module count;
- photo and quick action remain optional.

Modules:
- photo
- date
- hug
- mood
- distance
- eta
- song
- plan
- garden

Server widget snapshot never exposes raw coordinates.

## Insights

Achievements receive generic Bond metrics:
- joint_days
- current_streak
- record_streak
- gestures

Insights does not own Bond persistence.

## QA

- Bogota midnight boundary;
- duplicate participation rows;
- missed day/current streak reset;
- historical record;
- legacy total days;
- custom gesture validation;
- push payload privacy;
- token rotation contract;
- revoked device cleanup;
- notifications blocked;
- haptic disabled/enabled;
- widget compact/large/no-data;
- theme/reduced-motion;
- regression suite, Android lint/test/assembleDebug.
