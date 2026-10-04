create index if not exists galaxy_chat_messages_reply_to_idx
  on public.galaxy_chat_messages(reply_to)
  where reply_to is not null;

create index if not exists galaxy_chat_read_state_last_message_idx
  on public.galaxy_chat_read_state(last_read_message_id)
  where last_read_message_id is not null;
