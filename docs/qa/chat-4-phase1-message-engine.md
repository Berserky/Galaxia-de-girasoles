# Galaxy Chat 4.0 · SUPERNOVA Phase 1 — Message Engine 2.0

Base: `main` after Phase 0 / Galaxy Chat Universe 3.5.1. Branch: `perf/chat-4-phase-1-message-engine`.

## Architecture

The existing Galaxy Chat remains the only chat system. Message flow is now:

`server_seq cursor -> bounded loaded cache -> measured render window -> viewport`

- Initial page: 60 messages.
- Historical page: 60 messages using `server_seq < beforeSeq`.
- Forward page: 60 messages using `server_seq > afterSeq` when a contextual/history window must catch up.
- Search/deep result: existing `aroundId` path, hydrated around the target sequence.
- Native `chat-sync`: exact existing message is hydrated by ID and reconciled into the current cache instead of reloading the whole visible state.
- Ordering: `server_seq` is primary for confirmed messages. Optimistic rows stay local until reconciliation by `client_id`.
- No offset pagination was introduced.

## Window and memory policy

| Control | Value | Reason |
| --- | ---: | --- |
| Server page | 60 messages | Reuses the established 3.5.1 initial-page contract and keeps request/hydration work bounded. |
| Loaded cache | 420 messages | Enough context for several adjacent pages while preventing unbounded growth during long historical navigation. |
| Render window | 84 messages | Keeps the DOM bounded while retaining viewport buffer above/below. |
| Window step | 28 messages | Rotates before the viewport reaches a hard edge. |
| Preload threshold | ~1100 px | Starts older/newer loading before the user reaches the boundary. |

Messages retain variable height. Rendered rows are measured with `ResizeObserver`; measured heights feed upper/lower virtual spacers. The engine does not assume one fixed message height for text, replies, media, cards, locations, system messages, or content that resizes after load.

Only the message list is replaced for message-state updates. Header, composer and the rest of the chat shell are not reconstructed for a normal incoming/confirmed message.

## Phase 0 → Phase 1 comparison

| Metric/behavior | Phase 0 baseline | Phase 1 |
| --- | --- | --- |
| Initial messages requested | 60 | 60 |
| Dependency on total history at open | Initial request already bounded | Remains bounded; 100 / 500 / 5,000 / 20,000+ all open from the recent page |
| Loaded history after repeated backward paging | Grew with navigation | Capped at 420 |
| Message DOM after repeated paging | Grew with loaded history | Capped to the 84-row render window |
| Ordinary message refresh | Could rebuild the chat view | Incremental message-list reconciliation |
| Native `chat-sync` | Emitted by Android, not consumed by JS | Consumed and reconciled by message ID |
| Old search result | Context query existed | Context query retained and opens a focused virtual window |
| Order | `server_seq` already available | `server_seq` enforced as primary confirmed-message order |

Reproducible commands:

```bash
npm test
npm run bench:chat4:phase0 -- qa-artifacts/chat-4-phase0-node.json
npm run bench:chat4:phase1 -- qa-artifacts/chat-4-phase1-node.json
bash scripts/qa-phase5-emulator.sh
```

The Phase 1 benchmark asserts: initial retrieval <= 60, loaded cache <= 420, rendered messages <= 84, and the same bounded-open contract at 20,000 messages. Android instrumentation emits WebView windowing, PSS, CPU and anchor metrics without message content.

## Concurrency and reconciliation

- Page results are deduplicated by message ID/client ID and sorted deterministically.
- A server confirmation replaces the optimistic row with the same `client_id`.
- A native sync received while reading old history does not force the user to the present; a new-message indicator is shown instead.
- Directional cursors are independent, so an old contextual window can page backward and later catch up forward.
- Obsolete/overlapping UI loads remain serialized through the existing queued-load mechanism.

## Compatibility and security

Text, replies, reactions, photos, video, audio, Galaxy Cards, locations, visible capsules, system messages, search, pinned/saved jumps and existing deep-link behavior continue through the same renderers and services.

RLS, Storage, attachment validation, capsule filtering, location limits and the 3.5.1 privacy boundary are unchanged. Benchmarks record counts/timings only; no message bodies, coordinates or attachment URLs are logged.

## Known boundary

This phase implements only the anchoring required for virtualization. Full scroll semantics, keyboard/IME scroll policy and advanced auto-scroll behavior remain Phase 2 work. No production-stable promotion is part of Phase 1.
