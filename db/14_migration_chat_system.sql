-- ============================================================================
-- CHAT SYSTEM MIGRATION
-- Full-scale chatting system with rooms, permissions, voting, and access control
-- Created: 2026-08-25
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════
-- CHAT ROOMS
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists chat_rooms (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  room_type        text not null default 'chat',  -- 'chat' | 'voting'

  -- Access control
  access_level     text not null default 'all',    -- 'all' | 'members' | 'executives' | 'custom'
  is_active        boolean default true,

  -- Room settings
  allow_anonymous_read boolean default false,      -- Allow non-members to read (for public announcements)
  require_approval boolean default false,           -- Require admin approval to join

  -- Voting-specific settings (only for room_type='voting')
  voting_enabled   boolean default false,
  voting_question  text,                            -- The voting question
  voting_options   jsonb default '[]',              -- Array of voting options
  voting_ends_at   timestamptz,                     -- When voting closes
  allow_multiple   boolean default false,           -- Allow multiple vote selections
  show_results     boolean default false,           -- Show live results
  anonymous_voting boolean default false,           -- Hide voter identity

  -- Metadata
  created_by       uuid references members(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index idx_chat_rooms_active on chat_rooms(is_active);
create index idx_chat_rooms_type on chat_rooms(room_type);
create index idx_chat_rooms_created_at on chat_rooms(created_at desc);

-- ══════════════════════════════════════════════════════════════════════════
-- ROOM PARTICIPANTS & PERMISSIONS
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists chat_room_participants (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,

  -- Permission levels
  role            text not null default 'participant',  -- 'admin' | 'moderator' | 'participant' | 'viewer' | 'voter'
  can_send        boolean default true,                 -- Can send messages
  can_read        boolean default true,                 -- Can read messages
  can_vote        boolean default false,                -- Can vote (for voting rooms)
  is_muted        boolean default false,                -- Temporarily muted

  -- Tracking
  joined_at       timestamptz default now(),
  last_read_at    timestamptz,                          -- Last time they read messages

  unique(room_id, member_id)
);

create index idx_room_participants_room on chat_room_participants(room_id);
create index idx_room_participants_member on chat_room_participants(member_id);
create index idx_room_participants_role on chat_room_participants(room_id, role);

-- ══════════════════════════════════════════════════════════════════════════
-- MESSAGES
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists chat_messages (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  sender_id       uuid not null references members(id) on delete cascade,

  -- Message content
  message         text not null,
  message_type    text default 'text',                  -- 'text' | 'system' | 'announcement'

  -- Message flags
  is_important    boolean default false,                -- Marked as important (bolded, pinned)
  is_pinned       boolean default false,                -- Pinned to top of room
  is_deleted      boolean default false,                -- Soft delete

  -- Metadata
  reply_to_id     uuid references chat_messages(id),    -- For threaded replies
  edited_at       timestamptz,
  created_at      timestamptz default now()
);

create index idx_chat_messages_room on chat_messages(room_id, created_at desc);
create index idx_chat_messages_sender on chat_messages(sender_id);
create index idx_chat_messages_important on chat_messages(room_id, is_important) where is_important = true;
create index idx_chat_messages_pinned on chat_messages(room_id, is_pinned) where is_pinned = true;
create index idx_chat_messages_not_deleted on chat_messages(room_id) where is_deleted = false;

-- ══════════════════════════════════════════════════════════════════════════
-- MESSAGE REACTIONS
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists chat_message_reactions (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references chat_messages(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  emoji           text not null,                        -- Emoji reaction
  created_at      timestamptz default now(),

  unique(message_id, member_id, emoji)
);

create index idx_message_reactions_message on chat_message_reactions(message_id);

-- ══════════════════════════════════════════════════════════════════════════
-- VOTES (for voting rooms)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists chat_votes (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,

  -- Vote data
  option_index    integer not null,                     -- Index in voting_options array
  option_text     text,                                 -- Cached option text

  -- Metadata
  voted_at        timestamptz default now(),

  -- Constraint: one vote per member per room (or multiple if allow_multiple is true)
  unique(room_id, member_id, option_index)
);

create index idx_chat_votes_room on chat_votes(room_id);
create index idx_chat_votes_member on chat_votes(member_id);
create index idx_chat_votes_option on chat_votes(room_id, option_index);

-- ══════════════════════════════════════════════════════════════════════════
-- ROOM INVITATIONS (for custom access rooms)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists chat_room_invitations (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  invited_by      uuid references members(id),

  status          text default 'pending',               -- 'pending' | 'accepted' | 'declined'
  invited_at      timestamptz default now(),
  responded_at    timestamptz,

  unique(room_id, member_id)
);

create index idx_room_invitations_member on chat_room_invitations(member_id, status);
create index idx_room_invitations_room on chat_room_invitations(room_id);

-- ══════════════════════════════════════════════════════════════════════════
-- BLOCKED MEMBERS (room-specific blocks)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists chat_room_blocks (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  blocked_by      uuid references members(id),
  reason          text,
  blocked_at      timestamptz default now(),

  unique(room_id, member_id)
);

create index idx_room_blocks_room on chat_room_blocks(room_id);
create index idx_room_blocks_member on chat_room_blocks(member_id);

-- ══════════════════════════════════════════════════════════════════════════
-- TYPING INDICATORS (ephemeral, can be cleaned up periodically)
-- ══════════════════════════════════════════════════════════════════════════
create table if not exists chat_typing_indicators (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references chat_rooms(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  started_at      timestamptz default now(),

  unique(room_id, member_id)
);

create index idx_typing_room on chat_typing_indicators(room_id);

-- ══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════

-- Update updated_at timestamp
create or replace function update_chat_room_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger chat_rooms_updated_at
  before update on chat_rooms
  for each row
  execute function update_chat_room_updated_at();

-- Auto-cleanup old typing indicators (older than 30 seconds)
create or replace function cleanup_old_typing_indicators()
returns void as $$
begin
  delete from chat_typing_indicators
  where started_at < now() - interval '30 seconds';
end;
$$ language plpgsql;

-- ══════════════════════════════════════════════════════════════════════════
-- VIEWS FOR EASIER QUERIES
-- ══════════════════════════════════════════════════════════════════════════

-- View: Room with participant count and last message
create or replace view chat_rooms_with_stats as
select
  r.*,
  count(distinct p.member_id) as participant_count,
  (
    select json_build_object(
      'message', m.message,
      'sender_id', m.sender_id,
      'sender_name', mem.full_name,
      'created_at', m.created_at
    )
    from chat_messages m
    left join members mem on mem.id = m.sender_id
    where m.room_id = r.id and m.is_deleted = false
    order by m.created_at desc
    limit 1
  ) as last_message,
  (
    select count(*)
    from chat_messages m
    where m.room_id = r.id and m.is_deleted = false
  ) as message_count,
  (
    select count(*)
    from chat_votes v
    where v.room_id = r.id
  ) as vote_count
from chat_rooms r
left join chat_room_participants p on p.room_id = r.id
group by r.id;

-- ══════════════════════════════════════════════════════════════════════════
-- SAMPLE DATA (optional, for testing)
-- ══════════════════════════════════════════════════════════════════════════

-- Note: Uncomment below to insert sample rooms for testing
-- This assumes you have at least one member in the members table

/*
-- Sample general chat room
insert into chat_rooms (name, description, room_type, access_level, is_active)
values
  ('General Discussion', 'Open discussion for all verified members', 'chat', 'members', true),
  ('Executives Only', 'Private channel for executive committee', 'chat', 'executives', true),
  ('Announcements', 'Official announcements from the club', 'chat', 'all', true);

-- Sample voting room
insert into chat_rooms (
  name, description, room_type, access_level,
  voting_enabled, voting_question, voting_options,
  voting_ends_at, show_results, is_active
)
values (
  'Next Event Poll',
  'Vote for our next club event',
  'voting',
  'members',
  true,
  'What should be our next event?',
  '["Workshop on AI", "Science Fair", "Star Gazing Night", "Lab Tour"]'::jsonb,
  now() + interval '7 days',
  false,
  true
);
*/

-- ══════════════════════════════════════════════════════════════════════════
-- NOTES
-- ══════════════════════════════════════════════════════════════════════════
--
-- ACCESS LEVELS:
--   - 'all': Anyone with an account can join (if enabled)
--   - 'members': Only verified members (is_verified = true)
--   - 'executives': Only executive members (is_executive = true)
--   - 'custom': Specific members via chat_room_participants or invitations
--
-- ROLES:
--   - 'admin': Full control (usually room creator or club admin)
--   - 'moderator': Can pin/unpin messages, mute users
--   - 'participant': Can send and read messages
--   - 'viewer': Can only read messages (watcher)
--   - 'voter': Can vote but not chat (for voting rooms)
--
-- ROOM TYPES:
--   - 'chat': Regular chat room with messages
--   - 'voting': Room for polling/voting with optional discussion
--
