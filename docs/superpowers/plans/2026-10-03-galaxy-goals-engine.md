# Galaxy Goals Engine — Mega Update 3.0

Branch: `aegiron/mega-update-3.0`
Production: untouched.

## Goal

Separate:
- existing plans (`galaxy_items.kind = plan`);
- existing wishes (`galaxy_items.kind = wish`);
- shared goals;
- manual savings goals.

No bank accounts, financial providers, credentials, balances, transaction imports, or financial advice.

## Relational model

### galaxy_goals
One aggregate root per goal:
- kind: `goal | savings`
- title / description / category
- optional target_date
- status: `active | paused | completed | archived`
- optional target_amount (required only for savings)
- created_by
- optimistic-lock version
- created_at / updated_at / completed_at

### galaxy_goal_participants
Many-to-one membership for persons 0/1.

### galaxy_goal_steps
Ordered steps with completion metadata. Progress is derived, never duplicated.

### galaxy_goal_links
Links a goal to an existing `galaxy_items` row:
- note
- memory
- plan
- source-plan
- source-wish

Existing content remains the source of truth.

### galaxy_goal_contributions
Manual positive contributions:
- amount
- contribution_date
- note
- contributor
- created_at

Accumulated savings and percentage are derived from the contribution ledger.

## API

One allowlisted action: `goals-engine`.

Operations:
- list
- create
- update
- delete
- step-add
- step-toggle
- step-reorder
- contribution-add
- contribution-delete
- link-add
- link-delete
- convert-item

All mutations use the goal version as an optimistic concurrency token.

## Conversions

Plan/Wish -> Goal:
- source item remains by default;
- goal stores only a relational source link;
- optional explicit `keepOriginal=false` may remove the source only after goal creation succeeds;
- failures prefer duplicated source over data loss.

## Insights adapter

Goals produces generic insight metrics:
- goals completed in period;
- savings goals achieved in period;
- manual contribution amount in period;
- current progress of active goals;
- annual monthly series.

Insights consumes this summary without querying Goal tables itself.

## Date adapter

Goals produces generic date suggestions only for active travel goals.
Date Engine accepts generic `goalSuggestions`; it does not import Goals Engine or query Goal tables.

## Security

The Android client only talks to the authenticated device Edge Function.
New public-schema tables:
- RLS enabled;
- direct anon/authenticated table grants revoked;
- service_role receives only required table/sequence access.

No Goals migration is executed against production during this Galaxy.

## QA

- pure validation/progress/conversion/date-hint/insight tests;
- relational schema contract;
- optimistic concurrency;
- invalid/zero/negative/too-large money values;
- create/edit/delete;
- step add/toggle/reorder;
- contribution add/delete/history;
- source preservation;
- backup/restore;
- privacy/RLS;
- Insights adapter;
- Date adapter;
- theme and reduced-motion UI;
- full Node + Android CI.
