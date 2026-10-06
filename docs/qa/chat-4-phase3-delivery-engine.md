# Galaxy Chat 4.0 · SUPERNOVA Phase 3 — Realtime & Delivery Engine

Base: `main` after Phase 0, Phase 1 and Phase 2. Branch: `perf/chat-4-phase-3-delivery`.

## Delivery state machine

The existing chat remains the only message system. The local outbox is still the persisted queue and the server remains authoritative.

`PENDING -> SENDING -> SENT`

Transient failure:

`SENDING -> FAILED -> PENDING/SENDING -> SENT`

Offline interruption:

`SENDING -> PENDING`

Permanent validation/permission failure:

`SENDING -> FAILED`

`SENT` is a confirmation event, not a second local copy: the outbox row is removed and the confirmed row is reconciled into Message Engine by `client_id`. Existing server-backed `DELIVERED` / `READ` values are rendered only when those fields are actually present.

## Optimistic send and source of truth

1. Create a stable UUID `client_id`.
2. Persist the outbox row before transport.
3. Render it immediately as `PENDING`.
4. Serialize transport through Delivery Engine.
5. Mark the row `SENDING`.
6. Reconcile the confirmed server message by `client_id`.
7. Adopt server `id` and `server_seq`.
8. Remove the local outbox row.
9. Message Engine keeps deterministic `server_seq` order; Scroll Engine owns viewport policy.

No message body, attachment URL or coordinates are written to delivery diagnostics.

## Idempotency and reconciliation

Server idempotency continues to use the existing database guarantee:

`unique(sender_person, client_id)`

The Edge function already resolves an existing row before insert on a retry. The database constraint remains the final protection against concurrent duplicate persistence. A race that loses the first insert can safely retry the same stable `client_id`; the next attempt converges on the persisted row.

Reconciliation behavior:

- API then `chat-sync`: API removes the optimistic row; repeated sync merges the same `id/client_id` and cannot create a second visible row.
- `chat-sync` then API: the sync state already hides/reconciles the optimistic row by `client_id`; late API confirmation is idempotent.
- timeout after server persistence: the row stays recoverable and retry uses the same `client_id`.
- offline/restart: outbox survives; a recovered `SENDING` row becomes `PENDING` and resumes safely.

Native `chat-sync` remains the existing realtime path. Phase 3 adds short-lived in-flight/recent-event deduplication; it does not create another subscription/channel.

## Offline queue, retry and backpressure

The existing app-private WebView storage remains the queue store. It is capped at 120 rows.

- Queue survives background/foreground and process restart.
- In-flight `SENDING` is recovered as `PENDING`.
- Offline work is retained without a transport attempt.
- Transient failures use bounded exponential backoff: 0.9 s, 1.8 s, 3.6 s, 7.2 s, 14.4 s, capped at 30 s.
- Maximum automatic retry count: 8.
- Authorization, permission and validation failures remain `FAILED` and do not loop automatically.
- Manual **Reintentar** keeps the original `client_id`.
- Manual **Eliminar** removes only the failed/pending local operation.
- Message sends are serialized at concurrency 1; attachment uploads stay in the existing pre-message upload pipeline.

## Lifecycle

- foreground: recover interrupted rows and resume queue;
- background: persisted queue remains untouched;
- killed/restart: interrupted `SENDING` becomes `PENDING`;
- offline: queue remains local and visible;
- reconnect / Wi-Fi-data transitions: existing online lifecycle kicks the queue;
- native repeated `chat-sync`: duplicate event IDs are ignored during the short dedup window;
- state refresh/pagination: server rows continue through Message Engine and `server_seq`.

Scroll behavior is unchanged from Phase 2. Optimistic user sends retain the established explicit-to-bottom UX; later state/confirmation updates preserve the current anchor when the user has moved away.

## Validation matrix

Automated Phase 3 coverage includes:

1. successful send;
2. optimistic visibility before confirmation;
3. API before Realtime;
4. Realtime before API;
5. timeout after persistence;
6. timeout without persistence;
7. manual retry;
8. offline before send;
9. connection loss during send;
10. reconnect;
11. kill with pending/in-flight work;
12. restart with pending work;
13. stable idempotency key;
14. duplicate Realtime;
15. out-of-order events;
16. 20-message burst;
17. simultaneous two-user sends;
18. attachment failure;
19. authorization failure;
20. pagination while Realtime arrives;
21. 50 repeated/out-of-order realtime events;
22. bounded backoff and permanent-failure stop.

Commands:

```bash
npm test
npm run bench:chat4:phase0
npm run bench:chat4:phase1
npm run bench:chat4:phase2
npm run bench:chat4:phase3 -- qa-artifacts/chat-4-phase3-delivery-node.json
bash scripts/qa-phase5-emulator.sh
```

## Phase 0–2 comparison

| Behavior | Before Phase 3 | Phase 3 |
| --- | --- | --- |
| optimistic local row | existing outbox | centralized state machine |
| retry | manual/lifecycle retry, all errors treated alike | classified + bounded backoff + manual retry |
| restart | read path converted `SENDING` opportunistically | explicit recovery contract |
| timeout-after-persist | safe only after later retry/refresh | stable-key convergence encoded and tested |
| duplicate Realtime | Message Engine dedup | event dedup + Message Engine dedup + outbox reconciliation |
| burst backpressure | sequential loop | explicit engine-level serialized transport |
| global message render | already removed by Phase 1 | remains message-list only |
| scroll ownership | Phase 2 Scroll Engine | unchanged |

Phase 3 does not redesign composer, camera, recorder, attachment sheet, global visual language or animations. It does not deploy or promote a stable production version.
