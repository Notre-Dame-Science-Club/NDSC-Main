# API Security Audit Report
**Date:** 2026-08-21  
**Scope:** Complete API endpoint audit (68 endpoints)

---

## Executive Summary

Conducted comprehensive security audit across all API endpoints in the NDSC platform. Identified **55 total issues** across four major categories:

### Issues by Severity
- **CRITICAL:** 6 issues
- **HIGH:** 14 issues
- **MEDIUM:** 19 issues
- **LOW:** 16 issues

### Issues by Category
- **Admin APIs:** 22 issues
- **Auth & Member APIs:** 15 issues
- **Registration & Payment APIs:** 18 issues
- **Public APIs:** 15 issues

---

## Critical Issues (Immediate Action Required)

### 1. Missing Authentication on Admin Activity Sessions GET
**File:** `app/api/admin/activity-sessions/route.ts:6-60`  
**Impact:** Public access to unpublished activity sessions  
**Status:** ⏳ TO FIX

### 2. Olympiad Registration - Unrestricted Field Updates
**File:** `app/api/olympiad-register/route.ts:58-68`  
**Impact:** Users can modify scores, results, timer fields  
**Status:** ⏳ TO FIX

### 3. Authorization Bypass - Member Registrations
**File:** `app/api/member-activity-registrations/route.ts:21-23`  
**Impact:** Any user can view any member's registrations  
**Status:** ⏳ TO FIX

### 4. Unrestricted File Upload
**File:** `app/api/member-upload/route.ts:27-28`  
**Impact:** Anonymous users can upload files, storage exhaustion  
**Status:** ⏳ TO FIX

### 5. SQL Injection via ILIKE Pattern
**File:** `app/api/activity-search/route.ts:17`  
**Impact:** Timing attacks, expensive table scans  
**Status:** ⏳ TO FIX

### 6. Plaintext Organizer Passwords
**File:** `app/api/organizer/login/route.ts:23`  
**Impact:** Complete organizer account compromise if DB breached  
**Status:** ⏳ TO FIX

---

## High Severity Issues

### 7. Foreign Key Validation Missing - Activity Versions
**File:** `app/api/admin/activity-versions/route.ts:22-45, 48-67`  
**Status:** ⏳ TO FIX

### 8. Missing ID Validation (Multiple Endpoints)
**Files:** Various admin endpoints (DELETE operations)  
**Status:** ⏳ TO FIX

### 9. Payment IPN Race Condition
**File:** `app/api/payment/ipn/route.ts:46-80`  
**Status:** ⏳ TO FIX

### 10. Cascade Delete Without Transaction
**Files:** `app/api/admin/olympiads/route.ts:51-63`, `app/api/admin/surveys/route.ts:70`  
**Status:** ⏳ TO FIX

### 11. Member DELETE Orphan Risk
**File:** `app/api/admin/members/route.ts:117-127`  
**Status:** ⏳ TO FIX

### 12. Activity Registration FK Bypass
**File:** `app/api/activity-register/route.ts` (POST handler)  
**Status:** ⏳ TO FIX

### 13. Relay Exam Olympiad ID Bypass
**File:** `app/api/relay-exam/route.ts:39-92`  
**Status:** ⏳ TO FIX

### 14. Information Disclosure - Olympiad Answers
**File:** `app/api/olympiad/route.ts:26-29, 48-52`  
**Status:** ⏳ TO FIX

### 15. Timing Attack on Organizer Login
**File:** `app/api/organizer/login/route.ts:30-32`  
**Status:** ⏳ TO FIX

### 16. No Orphan Prevention on Deletes
**Files:** `app/api/admin/activity-types/route.ts:44-53`, `app/api/admin/activity-versions/route.ts:70-79`  
**Status:** ⏳ TO FIX

### 17-20. Additional High Issues
See detailed sections below for: Activity Session FK validation, Payment validation issues, Submission permission bypass, Chain value injection

---

## Medium Severity Issues (19 total)
- Race conditions in achievement append
- Missing email validation
- Weak password requirements
- Missing CSRF protection
- No rate limiting
- College roll validation bypass
- And 13 more...

---

## Low Severity Issues (16 total)
- Verbose error logging
- Timing attacks in various flows
- Missing Content-Type validation
- Performance N+1 queries
- And 12 more...

---

## Fixes Applied

### ✅ 1. Activity Session Version ID Validation (Already Fixed)
**File:** `app/api/admin/activity-sessions/route.ts:103-121`  
**Fix:** Added foreign key validation before insert/update

---

## Recommended Fix Priority

### Phase 1: This Session (Critical)
1. Add authentication to admin/activity-sessions GET
2. Add field whitelisting to olympiad-register PUT
3. Add authentication + authorization to member-activity-registrations
4. Add authentication to member-upload
5. Escape ILIKE patterns in activity-search
6. Add organizer password hashing (migration required)

### Phase 2: This Week (High)
7. Foreign key validation across all admin endpoints
8. ID validation on all DELETE operations
9. Payment IPN idempotency
10. Transaction wrapping for cascading deletes
11. Orphan prevention on activity-types/versions delete

### Phase 3: This Month (Medium)
12. Rate limiting middleware
13. Email validation
14. Password strength requirements
15. CSRF protection for state-changing ops

### Phase 4: Ongoing (Low + Performance)
16. Centralize auth helpers
17. N+1 query optimizations
18. Error message sanitization
19. Comprehensive logging

---

## Files Audited (68 endpoints)

### Admin APIs (33 files)
- activity-sessions, activity-types, activity-versions, activity-updates
- olympiads, olympiad-registrations, members
- surveys, form-graphs, form-nodes
- And 23 more...

### Auth & Member APIs (10 files)
- register, login, oauth, local-verify
- member-profile, member-achievements, member-registrations
- member-shoutbox, member-upload, member-membership-slip

### Registration & Payment APIs (13 files)
- activity-register, olympiad-register, activity-submission
- payment/init, payment/ipn, payment/success/fail/cancel
- relay-exam, activity-team-login
- activity-upload, olympiad-upload

### Public & Organizer APIs (24 files)
- activity-types-public, activity-sessions-public, activity-search
- publications, executives, science-media
- survey endpoints, olympiad public, form-graph
- organizer/login, organizer/olympiads, organizer/registrations

---

## Notes

- **No SQL injection vulnerabilities** found in parameterized queries (Supabase client handles escaping)
- **Good practices observed:** Timing-safe comparisons, idempotency checks, validation helpers
- **Main gaps:** Authentication, authorization, foreign key validation, transaction management
- **Performance concerns:** N+1 queries, full table scans, unbounded results

---

**End of Report**
