# Supabase Setup Guide

## Required Environment Variables

Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ADMIN_PASSWORD=your_admin_panel_password
```

## Required Supabase RLS Policies

Run these SQL commands in your Supabase SQL Editor:

### members table — allow users to read their own row
```sql
CREATE POLICY "Members can read own profile"
ON public.members
FOR SELECT
USING (auth.uid() = id);
```

### announcements — allow authenticated users to read
```sql
CREATE POLICY "Authenticated users can read announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (true);
```

### activities — allow authenticated users to read published
```sql
CREATE POLICY "Authenticated users can read published activities"
ON public.activities
FOR SELECT
TO authenticated
USING (is_published = true);
```

### publications — allow authenticated users to read published
```sql
CREATE POLICY "Authenticated users can read published publications"
ON public.publications
FOR SELECT
TO authenticated
USING (is_published = true);
```

### olympiads — allow authenticated users to read active
```sql
CREATE POLICY "Authenticated users can read active olympiads"
ON public.olympiads
FOR SELECT
TO authenticated
USING (is_active = true);
```

### admins table
```sql
CREATE POLICY "Service role only for admins"
ON public.admins
FOR ALL
TO service_role
USING (true);
```

## Admin Setup

1. Create an entry in your `admins` table:
```sql
INSERT INTO public.admins (email, role) VALUES ('your-admin@email.com', 'super_admin');
```

2. Set `ADMIN_PASSWORD` in your .env.local

## Member Verification

After a member registers, you need to verify them manually:
```sql
UPDATE public.members SET is_verified = true WHERE email = 'member@email.com';
```

Or build a UI in admin panel to do this (recommended future feature).
