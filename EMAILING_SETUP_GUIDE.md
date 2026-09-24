# Mass-Emailing System - Setup & Usage Guide

## Overview

A complete multi-account Brevo-based mass-emailing system has been added to the NDSC admin panel. This system allows sending bulk emails to members and/or non-member users with advanced audience filtering, daily quota management across multiple Brevo accounts, and detailed delivery tracking.

---

## 🎯 What Was Built

### Database Tables (Migration 26)
- **email_accounts** - Multiple Brevo sender accounts with encrypted API keys
- **email_campaigns** - Campaign metadata, status, and statistics
- **email_campaign_recipients** - Per-recipient delivery log

### Core Features
1. **Multi-Account Management** - Round-robin sending across multiple Brevo free-tier accounts (~300 emails/day each)
2. **Advanced Audience Builder** - Filter by batch, department, verification status, organizer/executive flags, college affiliation
3. **Send Now or Schedule** - Immediate or scheduled campaign execution
4. **Automated Quota Management** - Daily resets at Asia/Dhaka midnight
5. **Delivery Tracking** - Per-recipient status, errors, and timestamps
6. **Concurrency-Safe** - Processing locks prevent duplicate sends

---

## 📋 Prerequisites & Setup

### 1. Set Environment Variables in Vercel

Add this to your Vercel project settings:

```
CRON_SECRET=<any secure random string, e.g., a UUID>
```

**Optional but Recommended:**
```
EMAIL_ENCRYPTION_KEY=<32-byte base64 key, generate with: openssl rand -base64 32>
```

**Note:** The system includes a hardcoded fallback encryption key, so it will work even if `EMAIL_ENCRYPTION_KEY` is not set. However, for maximum security in production, you should set your own `EMAIL_ENCRYPTION_KEY` to override the fallback.

### 3. Apply Database Migration

Run this SQL in your Supabase SQL editor:

```sql
-- Copy the contents of db/26_migration_emailing_system.sql
-- Or run the entire db/00_UNIFIED_MASTER_SCHEMA.sql (it's idempotent)
```

The migration creates three tables:
- `email_accounts`
- `email_campaigns`
- `email_campaign_recipients`

### 4. Register Brevo Accounts

You'll need multiple Brevo accounts to scale beyond 300 emails/day:

1. Go to https://www.brevo.com/
2. Sign up with different Gmail addresses (e.g., ndsc.mail1@gmail.com, ndsc.mail2@gmail.com)
3. Verify each sender email in Brevo's settings
4. Get API keys from https://app.brevo.com/settings/keys/api
5. Keep these API keys safe - you'll add them in the admin panel

**Tip:** Each free Brevo account supports ~300 emails/day. Plan your accounts based on volume needs.

---

## 🚀 Using the System

### Access the Admin Panel

Navigate to: `/admin/emailing`

You'll see three tabs:

---

### Tab 1: Accounts

**Purpose:** Manage your Brevo sender accounts

**Actions:**
- **Add Account** - Click "Add Account" button
  - Label: Give it a name (e.g., "Gmail #1 - Outreach")
  - Gmail Address: The Gmail used to register this Brevo account (informational)
  - Sender Name: Display name in emails (e.g., "NDSC Team")
  - Sender Email: Must be verified in that Brevo account
  - Brevo API Key: From Brevo settings (verified on save)
  - Daily Limit: Default 300 (Brevo free tier)

- **View Quota** - Each account shows a progress bar:
  - Green: Normal usage
  - Red: Quota exhausted (resets at midnight Asia/Dhaka)
  
- **Toggle Active/Inactive** - Temporarily disable an account without deleting it

- **Delete Account** - Permanent removal (be careful!)

**Example Setup:**
```
Account 1: "Gmail #1 - General"     → 120/300 sent today
Account 2: "Gmail #2 - Campaigns"   → 85/300 sent today
Account 3: "Gmail #3 - Outreach"    → 0/300 sent today (just added)
```

---

### Tab 2: New Campaign

**Purpose:** Create and send/schedule campaigns

#### Campaign Details
- **Campaign Name:** Internal label (e.g., "Week 1 Newsletter")
- **Subject:** Email subject line
- **Body (HTML):** Email content in HTML format

**Simple HTML Example:**
```html
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #0066cc;">Welcome to NDSC!</h2>
  <p>Dear member,</p>
  <p>We're excited to announce...</p>
  <p style="margin-top: 20px;">
    <a href="https://ndsc.edu.bd" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
      Visit Our Website
    </a>
  </p>
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
  <p style="font-size: 12px; color: #888;">
    Notre Dame Science Club<br>
    Notre Dame College, Dhaka
  </p>
</div>
```

#### Audience Builder

**Source Selection:**
- **Members only** - NDSC members from `members` table
- **Non-member users only** - Event participants from `users` table
- **Both** - Combined audience (de-duplicated by email)

**Member Filters:**
- ☑️ Verified members only
- ☑️ Organizers only
- ☑️ Executives only
- **Departments:** Administration, Project, Publication, ICT, LWS, Quiz, R&D
- **Batches:** Select specific batches

**User Filters:**
- ☑️ Active users only
- **College:**
  - Any college
  - Notre Dame only
  - Excluding Notre Dame
- **Batches:** Select specific batches

**Custom IDs:**
- Manually specify member/user IDs (OR'd with other filters)

**Live Preview:**
- As you adjust filters, the system shows: "**N recipients match**"
- This updates automatically (debounced)

#### Schedule

**Option 1: Send Now**
- Campaign starts immediately
- Processes in batches (max 300 per cron run)
- Large campaigns continue across multiple cron cycles

**Option 2: Schedule for Later**
- Pick date/time (your local timezone)
- Campaign stays "scheduled" until that time
- Cron job picks it up and starts sending

---

### Tab 3: History

**Purpose:** View past and active campaigns

**Campaign List View:**
- Name, subject, audience source
- Status badge (color-coded)
- Sent/failed counts
- Scheduled/sent timestamps

**Status Types:**
- 🟦 **draft** - Created but not sent/scheduled
- 🟧 **scheduled** - Waiting for scheduled time
- 🔵 **sending** - Currently processing
- 🟢 **sent** - All recipients processed successfully
- 🟡 **partially_sent** - Some recipients failed
- 🔴 **failed** - Campaign failed entirely
- ⚪ **cancelled** - Manually cancelled

**Campaign Detail View:**
- Click any campaign to see recipient log
- Per-recipient status:
  - ✅ **sent** - Delivered successfully
  - ❌ **failed** - Delivery failed (error shown)
  - 🕐 **pending** - Waiting to be sent

**Example Campaign Detail:**
```
Campaign: "Welcome Email - Batch 2024"
Subject: Welcome to NDSC 2024-25 Session
Status: sent
120 / 120 sent • 0 failed

Recipients:
✅ john@example.com (John Doe) • member • Sent 5 min ago
✅ jane@example.com (Jane Smith) • member • Sent 5 min ago
❌ invalid@domain (Test User) • user • Failed: Brevo API returned 400
```

---

## 🔄 How Sending Works

### Immediate Send ("Send Now")

1. Campaign created with status `sending`
2. Recipients inserted as `pending`
3. First batch processed synchronously (up to 300 recipients)
4. Remaining recipients processed by cron job every 5 minutes

### Scheduled Send

1. Campaign created with status `scheduled`
2. Recipients inserted as `pending`
3. Cron job checks every 5 minutes
4. When `scheduled_at` time arrives, status changes to `sending`
5. Processing begins as above

### Quota Management

**Per Account:**
- Each account tracks `sent_today` and `quota_date`
- At Asia/Dhaka midnight, all accounts reset to `sent_today = 0`

**Round-Robin Distribution:**
1. System fetches all active accounts with remaining quota
2. Sorts by `sent_today` ascending (accounts with lowest usage first)
3. Distributes pending recipients across available accounts
4. Skips accounts that hit their daily limit
5. Resumes next day when quotas reset

**Example Distribution:**
```
Campaign: 500 recipients

Account 1: 200/300 quota → sends 100 (now 300/300)
Account 2: 50/300 quota  → sends 250 (now 300/300)
Account 3: 0/300 quota   → sends 150 (now 150/300)

All 500 sent across 3 accounts
```

### Concurrency Safety

- Uses `processing_lock_at` timestamp to prevent duplicate processing
- Lock expires after 2 minutes (in case of crashes)
- Multiple cron invocations won't overlap on the same campaign

---

## 🛠️ Technical Architecture

### File Structure

```
lib/
├── crypto.ts                          # AES-256-GCM encryption for API keys
├── email/
│   ├── brevo.ts                       # Brevo API integration
│   ├── audience.ts                    # Audience resolution
│   └── campaign-runner.ts             # Sending engine

app/
├── admin/emailing/page.tsx            # Admin UI (3 tabs)
└── api/
    ├── cron/process-email-queue/      # Vercel cron handler
    └── admin/emailing/
        ├── accounts/                  # CRUD for accounts
        ├── campaigns/                 # Campaign management
        │   └── [id]/
        │       ├── route.ts           # Campaign detail
        │       └── cancel/route.ts    # Cancel campaign
        └── audience-preview/          # Live recipient count

db/
├── 26_migration_emailing_system.sql   # New migration
└── 00_UNIFIED_MASTER_SCHEMA.sql       # Updated unified schema
```

### API Endpoints

**Accounts:**
- `GET /api/admin/emailing/accounts` - List accounts
- `POST /api/admin/emailing/accounts` - Create account
- `PATCH /api/admin/emailing/accounts` - Update account
- `DELETE /api/admin/emailing/accounts?id=<uuid>` - Delete account

**Campaigns:**
- `GET /api/admin/emailing/campaigns` - List campaigns (paginated)
- `POST /api/admin/emailing/campaigns` - Create campaign
- `GET /api/admin/emailing/campaigns/[id]` - Campaign detail + recipients
- `POST /api/admin/emailing/campaigns/[id]/cancel` - Cancel draft/scheduled

**Utilities:**
- `POST /api/admin/emailing/audience-preview` - Live recipient count
- `GET /api/cron/process-email-queue` - Cron handler (protected by `CRON_SECRET`)

### Cron Job

**Vercel Cron Configuration** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/process-email-queue",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Runs every 5 minutes, processes all active campaigns.

---

## 🔐 Security Notes

### API Key Storage
- Brevo API keys are encrypted using AES-256-GCM
- Encryption key stored in `EMAIL_ENCRYPTION_KEY` env var
- Never exposed in API responses (only masked version shown)
- Decryption only happens server-side when sending

### Cron Authentication
- Vercel Cron sends: `Authorization: Bearer <CRON_SECRET>`
- Endpoint validates this header before processing
- Returns 401 if header missing or incorrect

### Admin Protection
- All routes use `requireAdmin()` guard
- Checks for admin session cookie
- Returns 401 if not authenticated

---

## 📊 Monitoring & Troubleshooting

### Check Campaign Status

**Via UI:** Go to History tab, click campaign name

**Via Database:**
```sql
SELECT 
  id, name, status, total_recipients, 
  sent_count, failed_count, scheduled_at, sent_at
FROM email_campaigns
ORDER BY created_at DESC
LIMIT 10;
```

### Check Account Quotas

**Via UI:** Accounts tab shows progress bars

**Via Database:**
```sql
SELECT 
  label, sent_today, daily_limit, 
  quota_date, is_active
FROM email_accounts
ORDER BY sent_today DESC;
```

### Check Failed Recipients

**Via UI:** Click campaign in History tab, look for ❌ icons

**Via Database:**
```sql
SELECT 
  email, name, error, created_at
FROM email_campaign_recipients
WHERE campaign_id = '<campaign-uuid>'
  AND status = 'failed'
ORDER BY created_at DESC;
```

### Common Issues

**Issue:** "No recipients match"
- **Cause:** Filters too restrictive or no data in database
- **Fix:** Broaden filters or verify members/users exist

**Issue:** Campaign stuck in "sending" status
- **Cause:** All accounts out of quota
- **Fix:** Wait for daily reset (midnight Asia/Dhaka) or add more accounts

**Issue:** High failure rate
- **Cause:** Invalid email addresses or Brevo API issues
- **Fix:** Check error messages in recipient log, verify sender email is confirmed in Brevo

**Issue:** Cron not processing
- **Cause:** `CRON_SECRET` not set or incorrect
- **Fix:** Verify env var in Vercel, check cron logs

---

## 🎨 UI Styling

The admin panel follows the existing NDSC admin design system:
- CSS variables: `--bg2`, `--bg3`, `--border`, `--blue`, `--muted`, `--white`, `--success`, `--danger`, `--warning`
- Inline styles matching other admin pages
- No external UI libraries
- Fully responsive (mobile-friendly)

---

## 🚦 Best Practices

### Email Content
1. **Keep HTML simple** - Not all clients support complex CSS
2. **Test before sending** - Send to yourself first
3. **Include unsubscribe info** - Good practice (though not enforced)
4. **Use semantic HTML** - Better deliverability

### Account Management
1. **Rotate accounts** - Don't burn out one account
2. **Monitor quotas** - Add accounts before hitting limits
3. **Verify sender emails** - Brevo requires sender verification
4. **Keep API keys secure** - Don't share screenshots

### Campaign Planning
1. **Preview counts** - Always check recipient count before sending
2. **Schedule large campaigns** - Spread sends across multiple days if needed
3. **Test filters** - Send to a small test group first
4. **Monitor failures** - Check History tab after sends

---

## 📈 Scaling Tips

### Current Limits (Per Free Brevo Account)
- ~300 emails/day
- 9,000 emails/month
- Sender verification required

### Scaling Strategy

**Small Scale (< 300/day):**
- 1 Brevo account sufficient

**Medium Scale (300-1500/day):**
- 3-5 Brevo accounts
- Stagger campaigns across the day

**Large Scale (1500+/day):**
- 6+ Brevo accounts
- Consider upgrading some accounts to Brevo paid tiers
- Schedule campaigns to spread load

**Enterprise:**
- Upgrade to Brevo paid plans (higher daily limits)
- Or migrate to dedicated SMTP service

---

## 🔮 Future Enhancements (Not Implemented Yet)

These could be added later:

1. **Email Templates** - Pre-built HTML templates
2. **Personalization Tokens** - `{{full_name}}`, `{{college}}` replacements
3. **A/B Testing** - Split campaigns for subject line testing
4. **Analytics** - Open rates, click tracking (requires Brevo webhooks)
5. **Recurring Campaigns** - Auto-send weekly/monthly
6. **Segment Management** - Save audience filters as reusable segments
7. **Survey Integration** - Migrate existing survey email system to use multi-account sender

---

## 📞 Support & Maintenance

### Where Things Live

**Database:** Supabase (tables prefixed with `email_`)
**Admin UI:** `/admin/emailing`
**Cron:** Vercel Cron (every 5 min)
**Logs:** Vercel deployment logs

### Health Checks

Run these periodically:

```sql
-- Check for stuck campaigns (sending for > 1 hour)
SELECT id, name, status, created_at
FROM email_campaigns
WHERE status = 'sending'
  AND created_at < NOW() - INTERVAL '1 hour';

-- Check quota usage
SELECT SUM(sent_today) as total_sent_today, 
       SUM(daily_limit) as total_limit
FROM email_accounts
WHERE is_active = true;
```

---

## ✅ Quick Start Checklist

- [ ] Set `CRON_SECRET` env var in Vercel (required)
- [ ] Optionally set `EMAIL_ENCRYPTION_KEY` in Vercel (recommended for production)
- [ ] Applied database migration (`26_migration_emailing_system.sql`)
- [ ] Registered at least 1 Brevo account
- [ ] Verified sender email in Brevo
- [ ] Got API key from Brevo settings
- [ ] Added account in admin panel (`/admin/emailing`)
- [ ] Tested with small campaign to yourself
- [ ] Verified cron is running (check Vercel logs)

---

## 🎉 You're Ready!

The mass-emailing system is now fully operational. Start by adding your first Brevo account, then create a test campaign to yourself to verify everything works.

For questions or issues, check the troubleshooting section above or inspect the campaign detail view for specific error messages.

Happy emailing! 📧
