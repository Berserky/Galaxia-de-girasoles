# Galaxy Chat 4.0 · SUPERNOVA Phase 2 — Scroll Engine & Position Memory

Base: `main` after Phase 0 and Phase 1. Branch: `fix/chat-4-phase-2-scroll-engine`.

## Anchoring model

Galaxy Chat keeps one scroll container and one Scroll Engine. Visual position is represented by:

- stable message identifier;
- message offset relative to the chat viewport;
- up to two adjacent fallback anchors for deletion/reconciliation races;
- bottom-state flag and minimal navigation context.

No message body, attachment URL, coordinates or other sensitive content is persisted for restoration.

## Autoscroll policy

| State | Incoming message | Own send | Explicit jump/search |
| --- | --- | --- | --- |
| At bottom | Stay anchored to bottom | Go to sent message/bottom | Navigate to target |
| Reading history | Preserve anchor; increment “↓ X mensajes nuevos” | Explicit send goes to present | Navigate to target |
| Historical/search context | Preserve target/context | Explicit send may leave context | Target remains authoritative |

Bottom state is computed only by `GalaxyScrollEngine.isAtBottom()` with a 110 px tolerance.

## Restoration policy

- History prepend: restore message anchor + viewport offset.
- Virtual-window rotation/spacer remeasurement: capture and restore the same anchor.
- Late image, video, Galaxy Card or composer resize: ResizeObserver stabilizes current anchor or bottom.
- Keyboard/VisualViewport/orientation resize: preserve history anchor; users already at bottom remain at bottom.
- Background/foreground and temporary navigation away: session-only anchor memory is restored.
- Deliberate fresh chat open clears previous position memory and opens with normal latest behavior.
- Search/deep/context jumps use the centralized target-scroll path.

## Virtualization interaction

Phase 1 Message Engine remains authoritative for the loaded cache and 84-row render window. Phase 2 does not introduce another chat, list, cache or scroll container. Window shifts capture an anchor before recycling rows and restore it after the window changes. Message-height measurements can change virtual spacer estimates without changing the user’s visual position.

## Main technical decisions

- All chat programmatic movement routes through `GalaxyScrollEngine`.
- `scrollTop` writes are isolated inside the engine; message components do not independently call `scrollIntoView`.
- Programmatic movement records a privacy-safe origin and delta in `GalaxyChatPerf`.
- Layout-shift observation is added to the existing opt-in performance instrumentation.
- Known media dimensions reserve aspect ratio before decode when metadata is available.
- Reduced-motion preference disables smooth target movement.

## Verification / benchmark

Commands:

```bash
npm test
npm run bench:chat4:phase1 -- qa-artifacts/chat-4-phase1-node.json
npm run bench:chat4:phase2 -- qa-artifacts/chat-4-phase2-node.json
bash scripts/qa-phase5-emulator.sh
```

Phase 2 benchmark verifies repeated 50-message prepends with <1 px anchor drift and retains the Phase 1 20,000-message bounded render contract (<=84 rendered messages). Android instrumentation covers real WebView prepend, Realtime while reading history, composer resize, bottom-state jump, and navigation return.

Production stable is not promoted by this phase.
