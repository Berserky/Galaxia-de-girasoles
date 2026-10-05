# Galaxy Chat 4.0 · Phase 0 baseline

Base: Galaxy Chat Universe 3.5.1 / Android versionCode 35. Branch: `perf/chat-4-phase-0-baseline`.
This phase only measures and characterizes. It does not optimize Chat and does not promote a stable build.

## Reproducible environments

- Deterministic: GitHub Actions Ubuntu + Node 24.
- Android runtime: existing QA Phase 5 device-closure job, Pixel 6 x86_64 / API 35 emulator, animations disabled, Java 17 and Gradle 9.4.1.
- Remote dual-user staging remains the existing optional QA job; it is not replaced or duplicated.
- Dataset: 100 / 500 / 5,000 / 20,000 mixed messages: text, replies, reactions, photo, video, audio, Galaxy Cards, location, system-like rows and combined content.

Commands:
```bash
npm test
npm run bench:chat4:phase0 -- qa-artifacts/chat-4-phase0-node.json
bash scripts/qa-phase5-emulator.sh
```

## Current message architecture

Initial UI request is 60 messages. Server clamps 20..100, orders by `server_seq`, over-fetches up to limit+50 to remove hidden/deleted/expired rows, trims to the requested limit and returns `nextBeforeSeq`. History prepends by merging IDs, sorting by `server_seq` and compensating `scrollHeight - oldHeight`.

Local sends enter an outbox immediately, use a synthetic local order, then reconcile by `client_id` with the server result. Delivery refresh uses native chat-sync/push paths plus a 25 s visible-chat fallback poll and a forced refresh on foreground. There is no second browser-side Supabase Realtime client.

Hydration already batches Galaxy Card domain reads and Storage URL signing from Phase 4; that mechanism is reused.

## Baseline findings

| Priority | Area | Finding | Future phase |
| --- | --- | --- | --- |
| P0 | Scroll | Chat replaces the full chat DOM on state changes. Ordinary refresh while the user is reading history has no anchor restoration unless it is a history prepend, an explicit jump, or the user was already near the bottom. This reproduces the spontaneous jump toward old/start content. | Scroll Engine |
| P1 | Message Engine | Loaded history accumulates in state and DOM. `content-visibility:auto` reduces paint/layout work but is not message virtualization/windowing. | Message Engine |
| P1 | Delivery | Incoming/foreground/poll refresh can trigger a whole-view render instead of an append/reconcile-only update. | Delivery/Realtime |
| P1 | Media | Images are lazy, but video/audio use `preload="metadata"`; off-viewport media still exists in the DOM and can perform metadata work. | Media Performance |
| P2 | Composer | Reply, optimistic send and several composer transitions call global render, increasing focus/IME and scroll sensitivity. | Composer |
| P2 | Android | WebView viewport resize, lifecycle resume and native bridge refreshes can coincide with full chat render. | Android Performance |
| P3 | Motion/Design | Motion and visual polish are not benchmark blockers in Phase 0. | Motion / Design System |

### P0 reproduction contract

1. Open a chat with enough messages to scroll.
2. Scroll into history so the viewport is not near bottom.
3. Trigger a normal state refresh (incoming message, native sync, foreground refresh or fallback poll).
4. Current code calls the global `render()`, creates a new `#chatMessages`, and does not restore the old anchor in the `!wasNear` normal-refresh branch.
5. The Phase 0 instrumentation records a `scroll-jump` when a history position is replaced by a near-zero scroll position.

Late image sizing, media metadata, keyboard/VisualViewport changes and the intrinsic-size estimate can further alter height after the one-time prepend compensation. Phase 0 records this; it deliberately does not fix it.

## Multimedia path

- Photo gallery: Android Photo Picker (`PickMultipleVisualMedia`) → native copy/normalization → bridge upload → JS draft/preview.
- Camera photo: Android camera intent + FileProvider cache → native validation/upload → JS message draft.
- Video: Android capture intent with native duration/size limits → upload → HTML video preview/playback.
- Voice: JS hold/modal controls → native `MediaRecorder` (AAC/MPEG-4, 44.1 kHz, 96 kbps, max 60 s / 5 MB) → upload → HTML audio player.
- WebView file access remains disabled. Existing signed-URL allowlists, MIME sniffing, HEIC/HEIF normalization, Storage privacy and RLS remain unchanged.

## Metrics and artifacts

`scripts/chat-4-phase0-baseline.mjs` writes deterministic render time, HTML size, approximate rendered nodes/media and reuses the existing Phase 4 server hydration/round-trip benchmark. The Android device-closure instrumentation emits runtime open/render/send, scroll FPS/jank, process PSS/CPU and repeated-render observations into CI artifacts.

Hardware-specific numbers are intentionally produced by CI artifacts rather than committed as universal constants. Compare later phases using the same commands and runner/device profile.

## Galaxy Chat 4.0 provisional UX contract

- warm open < 500 ms
- cold first messages visible < 1.2 s when network/environment allow
- scroll target ~60 FPS
- 0 spontaneous scroll jumps
- visual send response < 100 ms
- 0 perceptible UI blocks
- no global rerender for one incoming message
- 20,000+ functional history through incremental loading/windowing
- off-viewport multimedia must not trigger unnecessary heavy work

Targets may only move with measured technical evidence. No production/stable promotion is part of Phase 0.
