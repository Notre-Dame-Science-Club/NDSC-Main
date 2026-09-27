# Emailing System Documentation

## Overview

The NDSC emailing system is a self-processing, platform-agnostic campaign management system that doesn't depend on external cron jobs or specific hosting platforms. It uses Brevo as the email service provider.

## Architecture

### Self-Processing Design

The system is designed to continue processing automatically once a campaign is started:

1. When a campaign is created with "Send Now", the first batch starts immediately
2. After each batch completes, the system automatically schedules the next batch (1 second delay)
3. This continues until all recipients are processed or quota limits are reached
4. No external cron job is required for normal operation

### Components

- **Campaign Runner** (`lib/email/campaign-runner.ts`) - Core processing engine
- **Brevo Integration** (`lib/email/brevo.ts`) - Email sending via Brevo API
- **Audience Resolution** (`lib/email/audience.ts`) - Target audience filtering
- **Admin UI** (`app/admin/emailing/page.tsx`) - Management interface

## Features

### 1. Email Accounts Management

- Multiple Brevo API keys can be configured
- Each account has:
  - Label (for identification)
  - Sender name and email (must be verified in Brevo)
  - Daily sending limit
  - Active/inactive status
  - Daily quota tracking (resets at midnight Asia/Dhaka timezone)

### 2. Campaign Management

- Create campaigns with custom subject and HTML body
- Target audiences:
  - Members only
  - Non-member users only
  - Both members and users
- Advanced filtering:
  - By batch (year)
  - By department
  - By verification status
  - By role (organizers, executives)
  - By college (Notre Dame only, excluding Notre Dame, any)
- Send immediately or schedule for later
- Track sending progress in real-time

### 3. Quota Management

- Daily sending limits per account
- Round-robin distribution across accounts
- Automatic quota reset at midnight (Asia/Dhaka)
- Campaigns pause when quotas are exhausted

### 4. Concurrency Safety

- Processing locks prevent duplicate sends
- Lock expires after 2 minutes (handles crashed processes)
- Safe to call processing multiple times

## API Endpoints

### Campaign Management

- `POST /api/admin/emailing/campaigns` - Create and optionally start a campaign
- `GET /api/admin/emailing/campaigns` - List campaigns with pagination
- `GET /api/admin/emailing/campaigns/[id]` - Get campaign details with recipients
- `POST /api/admin/emailing/campaigns/[id]/cancel` - Cancel a campaign

### Account Management

- `GET /api/admin/emailing/accounts` - List all accounts (API keys masked)
- `POST /api/admin/emailing/accounts` - Create new account (validates API key)
- `PATCH /api/admin/emailing/accounts` - Update account
- `DELETE /api/admin/emailing/accounts` - Delete account

### Audience Preview

- `POST /api/admin/emailing/audience-preview` - Preview recipient count for filters

### Optional Cron Endpoint

- `GET /api/cron/process-email-queue` - Resume any stalled campaigns

## Database Schema

### email_accounts
```sql
id                  UUID PRIMARY KEY
label               TEXT NOT NULL
gmail_address       TEXT
sender_name         TEXT NOT NULL
sender_email        TEXT NOT NULL
api_key_encrypted   TEXT NOT NULL
daily_limit         INTEGER DEFAULT 300
sent_today          INTEGER DEFAULT 0
quota_date          TEXT
is_active           BOOLEAN DEFAULT true
created_at          TIMESTAMP
```

### email_campaigns
```sql
id                  UUID PRIMARY KEY
name                TEXT NOT NULL
subject             TEXT NOT NULL
body_html           TEXT NOT NULL
audience_source     TEXT NOT NULL (members|users|both)
audience_filters    JSONB
status              TEXT (draft|scheduled|sending|sent|partially_sent|failed|cancelled)
total_recipients    INTEGER
sent_count          INTEGER DEFAULT 0
failed_count        INTEGER DEFAULT 0
scheduled_at        TIMESTAMP
sent_at             TIMESTAMP
processing_lock_at  TIMESTAMP
created_at          TIMESTAMP
```

### email_campaign_recipients
```sql
id                  UUID PRIMARY KEY
campaign_id         UUID REFERENCES email_campaigns
email               TEXT NOT NULL
name                TEXT
source              TEXT (member|user)
source_id           UUID
status              TEXT (pending|sent|failed)
email_account_id    UUID REFERENCES email_accounts
error               TEXT
sent_at             TIMESTAMP
created_at          TIMESTAMP
```

## Configuration

### Required Environment Variables

None required for basic functionality. The system will work without any environment variables.

### Optional Environment Variables

- `CRON_SECRET` - If set, the cron endpoint requires `Authorization: Bearer $CRON_SECRET`
- `ENCRYPTION_KEY` - Used to encrypt API keys at rest (auto-generated if not set)

## Platform Compatibility

The system works on any Node.js hosting platform:

- **Vercel** - Works perfectly (cron is optional)
- **Netlify** - Works (no cron support, but not needed)
- **Railway** - Works
- **Render** - Works
- **Any VPS** - Works
- **Docker** - Works

### Optional Cron Job

A cron endpoint exists at `/api/cron/process-email-queue` that can be called:
- By Vercel Cron (configured in `vercel.json`)
- By external services (e.g., cron-job.org, EasyCron)
- Manually for testing

**Purpose:** Resume campaigns after server restarts. The system is self-processing, so this is only a backup.

## Usage

### 1. Set Up Email Accounts

1. Create a Brevo account at https://www.brevo.com
2. Verify your sender email in Brevo
3. Get an API key from https://app.brevo.com/settings/keys/api
4. In NDSC Admin → Mailing → Accounts tab:
   - Click "Add Account"
   - Enter label, sender name/email, and API key
   - Set daily limit (Brevo free tier: 300/day)
   - Save

### 2. Create a Campaign

1. Go to Admin → Mailing → New Campaign
2. Enter campaign name (internal) and email subject
3. Write email body (HTML supported)
4. Select audience and apply filters
5. Preview recipient count
6. Choose "Send Now" or schedule for later
7. Click "Create & Send Now"

### 3. Monitor Progress

1. Go to Admin → Mailing → History
2. Click a campaign to see:
   - Overall status
   - Sent/failed/pending counts
   - Individual recipient status
   - Error messages (if any)

## Troubleshooting

### Campaign Stuck in "sending" Status

**Cause:** Server restart or crash during processing

**Solution:** 
1. The next cron job run (if configured) will resume it
2. Or manually call `/api/cron/process-email-queue`
3. Or wait for the lock to expire (2 minutes) and it will auto-resume

### Emails Not Sending

**Check:**
1. Account is marked as "Active"
2. Daily quota not exhausted
3. API key is valid (test in Accounts tab)
4. Sender email is verified in Brevo

### Rate Limiting

**Brevo Limits:**
- Free tier: 300 emails/day
- Paid plans: Higher limits

**System Behavior:**
- Automatically stops when quotas exhausted
- Resumes next day after midnight (Asia/Dhaka)
- Distributes load across multiple accounts

## Security

- API keys encrypted at rest using `lib/crypto.ts`
- Only masked keys shown in UI
- Admin authentication required for all endpoints
- Optional CRON_SECRET for webhook protection

## Future Enhancements

- [ ] Email templates with variable substitution
- [ ] A/B testing support
- [ ] Open/click tracking integration
- [ ] Unsubscribe management
- [ ] Email preview before sending
- [ ] Retry failed emails
- [ ] Campaign duplication
