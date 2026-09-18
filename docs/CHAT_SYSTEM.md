# Chat System Documentation

## Overview

A comprehensive full-scale chatting system with rooms, permissions, voting capabilities, and fine-grained access control. Built for the NDSC platform to facilitate communication between members, executives, and organizers.

## Features

### 🏠 Room Management
- **Room Types:**
  - **Chat Rooms**: Regular messaging with real-time updates
  - **Voting Rooms**: Poll/voting system with optional discussion
  
- **Access Levels:**
  - `all`: Anyone with an account can join
  - `members`: Only verified members
  - `executives`: Executive committee only
  - `custom`: Specific hand-picked members

### 👥 Flexible Permissions
- **Roles:**
  - `admin`: Full room control
  - `moderator`: Can pin messages, mute users
  - `participant`: Can send and read messages
  - `viewer`: Read-only (watcher mode)
  - `voter`: Can vote but not chat (voting rooms)

- **Per-Member Controls:**
  - `can_send`: Permission to send messages
  - `can_read`: Permission to read messages
  - `can_vote`: Permission to vote (voting rooms)
  - `is_muted`: Temporarily muted from sending

### 💬 Rich Messaging
- Real-time message delivery (3-second polling)
- Message reactions with emoji
- Edit and delete messages
- Pin important messages
- Mark messages as important (bold, highlighted)
- Reply threading
- Soft delete (keeps history)

### 🗳️ Voting System
- Multiple voting options (minimum 2)
- Single or multiple-choice voting
- Anonymous voting option
- Live results or hidden until end
- Voting deadlines
- Vote change/removal before deadline
- Vote count and percentage display
- Voter list (if not anonymous)

### 🔒 Security & Privacy
- Room-specific blocking
- Approval-required rooms
- Anonymous read mode for public announcements
- Typing indicators
- Last read tracking
- Unread message counts

## Installation

### 1. Database Setup

Run the migration to create all necessary tables:

```bash
# Apply the migration
psql -U your_user -d your_database -f db/migration_chat_system.sql

# Or via Supabase SQL Editor:
# Copy contents of db/migration_chat_system.sql and run
```

### 2. Verify Tables

The migration creates these tables:
- `chat_rooms`
- `chat_room_participants`
- `chat_messages`
- `chat_message_reactions`
- `chat_votes`
- `chat_room_invitations`
- `chat_room_blocks`
- `chat_typing_indicators`

### 3. Access the System

**Admin Panel:**
- Navigate to `/admin/chat`
- Create and manage rooms
- Set permissions and access levels
- View all rooms and statistics

**Member Portal:**
- Navigate to `/dashboard/chat`
- View accessible rooms
- Send messages and vote
- React to messages

## Usage Guide

### Creating a Chat Room (Admin)

1. Go to `/admin/chat`
2. Click "Create Room"
3. Fill in room details:
   - **Name**: Room display name
   - **Description**: Brief description
   - **Room Type**: Chat or Voting
   - **Access Level**: Who can access
   
4. **For Chat Rooms:**
   - Select access level
   - Optionally enable approval requirement
   - Choose custom members if needed

5. **For Voting Rooms:**
   - Enter voting question
   - Add voting options (minimum 2)
   - Set voting deadline (optional)
   - Configure voting settings:
     - Allow multiple selections
     - Show live results
     - Anonymous voting

6. **Custom Access Setup:**
   - Select specific members
   - Assign roles (admin, moderator, participant, viewer, voter)
   - Set individual permissions (can_send, can_read, can_vote)

### Managing Permissions

**Disable specific members from talking:**
```
1. Click "Manage Participants" on a room
2. Find the member
3. Uncheck "can_send" permission
4. They become viewers (read-only)
```

**Enable only a few to talk:**
```
1. Set room to "custom" access
2. Add selected members with "participant" role
3. All others with "viewer" role
4. Only participants can send messages
```

**Mute temporarily:**
```
1. Click on member in participants list
2. Toggle "is_muted"
3. They can't send until unmuted
```

### Voting Features

**Create a Poll:**
```
1. Create room with type "voting"
2. Enter question: "What should be our next event?"
3. Add options:
   - Workshop on AI
   - Science Fair
   - Star Gazing Night
4. Set deadline (e.g., 7 days from now)
5. Configure:
   - Allow multiple: No (single choice)
   - Show results: Yes (live results)
   - Anonymous: No (show voters)
```

**Voting Roles:**
- **Voters**: Can vote but cannot send messages
- **Participants**: Can both vote and discuss
- **Viewers**: Can only watch results

### Important Messages

Admins and moderators can:
- Mark messages as important (highlighted in yellow)
- Pin messages to top of room
- These appear prominently for all members

## API Endpoints

### Rooms
- `GET /api/chat/rooms?member_id={id}` - Get accessible rooms
- `POST /api/chat/rooms` - Create room
- `PATCH /api/chat/rooms` - Update room
- `DELETE /api/chat/rooms?room_id={id}` - Deactivate room

### Messages
- `GET /api/chat/messages?room_id={id}&member_id={id}` - Get messages
- `POST /api/chat/messages` - Send message
- `PATCH /api/chat/messages` - Edit/pin message
- `DELETE /api/chat/messages?message_id={id}` - Delete message

### Participants
- `GET /api/chat/participants?room_id={id}` - Get participants
- `POST /api/chat/participants` - Add participant
- `PATCH /api/chat/participants` - Update permissions
- `DELETE /api/chat/participants?room_id={id}&member_id={id}` - Remove

### Reactions
- `POST /api/chat/reactions` - Add/toggle reaction
- `DELETE /api/chat/reactions?message_id={id}&emoji={emoji}` - Remove

### Voting
- `GET /api/chat/votes?room_id={id}&member_id={id}` - Get results
- `POST /api/chat/votes` - Submit vote
- `DELETE /api/chat/votes?room_id={id}&member_id={id}` - Remove vote

## Real-time Updates

The system uses polling (every 3 seconds) for real-time updates:
- New messages appear automatically
- Vote counts update live
- Unread counts refresh
- Room stats update

To improve performance, consider implementing:
- WebSocket connections
- Server-Sent Events (SSE)
- Supabase Realtime subscriptions

## Example Scenarios

### Executive-Only Discussion
```
Room Name: "Executive Committee"
Access Level: executives
Description: "Private discussions for exec committee"
→ Only members with is_executive=true can access
```

### Public Announcement Channel
```
Room Name: "Announcements"
Access Level: all
Allow Anonymous Read: true
Description: "Official club announcements"
→ Everyone can read, admins can post
```

### Event Planning Poll
```
Room Name: "Next Event Poll"
Room Type: voting
Voting Question: "What event should we organize next?"
Options: ["Workshop", "Fair", "Tour", "Competition"]
Access Level: members
Show Results: false
Voting Ends: 7 days
→ Members vote, results shown after deadline
```

### Project Team Chat
```
Room Name: "AI Project Team"
Access Level: custom
Selected Members: [Alice, Bob, Charlie, Dave]
Permissions:
  - Alice: admin (can manage)
  - Bob, Charlie: participant (can chat)
  - Dave: viewer (read-only)
→ Focused team communication
```

## Monitoring & Maintenance

### Cleanup Tasks

**Remove old typing indicators:**
```sql
-- Run periodically (e.g., hourly cron)
DELETE FROM chat_typing_indicators
WHERE started_at < now() - interval '30 seconds';
```

**Archive old messages:**
```sql
-- Archive messages older than 1 year
UPDATE chat_messages
SET is_deleted = true
WHERE created_at < now() - interval '1 year'
AND is_pinned = false;
```

### Statistics Queries

**Most active rooms:**
```sql
SELECT r.name, COUNT(m.id) as message_count
FROM chat_rooms r
LEFT JOIN chat_messages m ON m.room_id = r.id
WHERE m.is_deleted = false
GROUP BY r.id, r.name
ORDER BY message_count DESC
LIMIT 10;
```

**Vote participation rate:**
```sql
SELECT 
  r.name,
  COUNT(DISTINCT v.member_id) as voters,
  COUNT(DISTINCT p.member_id) as total_participants,
  ROUND(COUNT(DISTINCT v.member_id)::numeric / 
        NULLIF(COUNT(DISTINCT p.member_id), 0) * 100, 2) as participation_rate
FROM chat_rooms r
LEFT JOIN chat_votes v ON v.room_id = r.id
LEFT JOIN chat_room_participants p ON p.room_id = r.id
WHERE r.room_type = 'voting'
GROUP BY r.id, r.name;
```

## Troubleshooting

**Messages not appearing:**
- Check `can_read` permission
- Verify member is in `chat_room_participants`
- Check if room `is_active = true`

**Can't send messages:**
- Check `can_send` permission
- Verify not muted (`is_muted = false`)
- Confirm room access level

**Vote not working:**
- Check `can_vote` permission
- Verify voting hasn't ended
- Confirm `voting_enabled = true`

**Unread count stuck:**
- Check `last_read_at` timestamp
- Manually update: `UPDATE chat_room_participants SET last_read_at = now() WHERE ...`

## Future Enhancements

- [ ] WebSocket/SSE for true real-time
- [ ] File/image attachments
- [ ] Voice messages
- [ ] Video chat integration
- [ ] Message search
- [ ] Direct messages (1-on-1)
- [ ] Thread replies UI
- [ ] Rich text formatting
- [ ] @mentions with notifications
- [ ] Message translation
- [ ] Chat export (PDF, CSV)
- [ ] Mobile app support

## Security Considerations

1. **Input Validation**: All messages are sanitized on the backend
2. **SQL Injection**: Using parameterized queries throughout
3. **XSS Prevention**: React automatically escapes content
4. **Permission Checks**: Every API call verifies user permissions
5. **Rate Limiting**: Consider adding rate limits for message sending
6. **Content Moderation**: Add profanity filters and reporting system

## License

Part of the NDSC Platform © 2026
