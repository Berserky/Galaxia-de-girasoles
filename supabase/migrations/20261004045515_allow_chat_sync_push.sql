-- Production hotfix: Galaxy Chat silent synchronization is a valid push event.
alter table public.galaxy_push_subscriptions
  drop constraint if exists galaxy_push_subscriptions_event_type_check;

alter table public.galaxy_push_subscriptions
  add constraint galaxy_push_subscriptions_event_type_check
  check(event_type in (
    'gesture','arrived_safe','nearby','capsule','note','reminder',
    'chat_message','chat_sync','status_changed','mood_changed','daily_answer',
    'goal_update','memory_shared','plan_update'
  ));

alter table public.galaxy_push_events
  drop constraint if exists galaxy_push_events_event_type_check;

alter table public.galaxy_push_events
  add constraint galaxy_push_events_event_type_check
  check(event_type in (
    'gesture','arrived_safe','nearby','capsule','note','reminder',
    'chat_message','chat_sync','status_changed','mood_changed','daily_answer',
    'goal_update','memory_shared','plan_update'
  ));
