# RLS Smoke Test Checklist — ProjectOps360°

> **Task:** 0.14 — Create RLS smoke tests  
> **Last updated:** 2026-06-07  
> **Related migration:** `20260611000000_enable_rls_business_tables.sql`

---

## How to Run These Tests

1. **SQL tests:** Open the Supabase SQL Editor and run `supabase/tests/rls_smoke_test.sql` — it sets up test data, runs all checks, and cleans up automatically. Each test outputs a row with `test_name`, `expected`, `actual`, and `passed` (boolean).

2. **Manual verification:** Use the checklist below to confirm results visually.

3. **Pre-requisites:** The RLS migration (`20260611000000`) must already be applied.

---

## Checklist

### 1. Infrastructure Verification

- [ ] **1.1** RLS is enabled on all 12 tables  
  _Run: see Part 1 in SQL script — all 12 tables should show `rowsecurity = true`_

- [ ] **1.2** `is_org_member()` function exists and is `SECURITY DEFINER`  
  _Run: see Part 3 — `prosecdef = true`, `proconfig` includes `search_path=public`_

- [ ] **1.3** `protect_profile_org_id` trigger exists on `profiles`  
  _Run: see Part 4 — trigger with `BEFORE UPDATE` timing_

- [ ] **1.4** Policy counts are correct per table  
  _Run: see Part 2 — organizations: 3, profiles: 4, organization_members: 4, 9 business tables: 5 each_

### 2. Helper Function Tests

- [ ] **2.1** `is_org_member()` returns TRUE for user's own org  
  _Test as Alice → `is_org_member(org_alpha_id)` returns `true`_

- [ ] **2.2** `is_org_member()` returns FALSE for a different org  
  _Test as Alice → `is_org_member(org_beta_id)` returns `false`_

- [ ] **2.3** `is_org_member()` returns FALSE for a nonexistent org  
  _Test as Alice → `is_org_member('00000000-0000-0000-0000-000000000000')` returns `false`_

### 3. Own-Org Access (Positive Tests)

_Authenticated user CAN access data in their own organization._

- [ ] **3.1** SELECT own org's projects → returns ≥ 1 row  
- [ ] **3.2** INSERT a project in own org → succeeds  
- [ ] **3.3** UPDATE a project in own org → 1 row updated  
- [ ] **3.4** DELETE a project in own org (soft delete) → 1 row updated  
- [ ] **3.5** SELECT own org's stakeholders → returns ≥ 1 row  
- [ ] **3.6** SELECT own org's meetings → returns ≥ 1 row  
- [ ] **3.7** SELECT own org's decisions → returns ≥ 1 row  
- [ ] **3.8** SELECT own org's communication_items → returns ≥ 1 row  
- [ ] **3.9** SELECT own org's documents → returns ≥ 1 row  
- [ ] **3.10** SELECT own org's traceability_links → returns ≥ 1 row  
- [ ] **3.11** SELECT own org's ai_runs → returns ≥ 1 row  
- [ ] **3.12** SELECT own org's action_items → returns ≥ 1 row  
- [ ] **3.13** SELECT own profile → 1 row (own data only)  
- [ ] **3.14** UPDATE own profile (display_name, locale) → succeeds  
- [ ] **3.15** SELECT own organization → 1 row  
- [ ] **3.16** UPDATE own organization (name) → 1 row updated  
- [ ] **3.17** SELECT own org's organization_members → shows all members in the org (not just own row)  

### 4. Cross-Org Blocking (Negative Tests)

_Authenticated user CANNOT access data from another organization._

- [ ] **4.1** SELECT projects from other org → 0 rows  
- [ ] **4.2** INSERT project in other org → ERROR (WITH CHECK policy violation)  
- [ ] **4.3** UPDATE project in other org → 0 rows updated  
- [ ] **4.4** DELETE project in other org → 0 rows deleted  
- [ ] **4.5** UPDATE own project to move it to other org (change organization_id) → ERROR or 0 rows updated (WITH CHECK blocks)  
- [ ] **4.6** SELECT other org's stakeholders → 0 rows  
- [ ] **4.7** SELECT other org's meetings → 0 rows  
- [ ] **4.8** SELECT other org's decisions → 0 rows  
- [ ] **4.9** SELECT other org's communication_items → 0 rows  
- [ ] **4.10** SELECT other org's documents → 0 rows  
- [ ] **4.11** SELECT other org's traceability_links → 0 rows  
- [ ] **4.12** SELECT other org's ai_runs → 0 rows  
- [ ] **4.13** SELECT other org's action_items → 0 rows  
- [ ] **4.14** SELECT other org's organization → 0 rows  
- [ ] **4.15** SELECT other org's organization_members → 0 rows  
- [ ] **4.16** SELECT other user's profile → 0 rows  

### 5. Profile Protection Tests

- [ ] **5.1** Changing `organization_id` on own profile → RAISE EXCEPTION  
  _Error message: "Cannot change profiles.organization_id — use organization transfer instead"_

- [ ] **5.2** Changing `display_name` on own profile → succeeds  
- [ ] **5.3** Changing `locale` on own profile → succeeds  
- [ ] **5.4** Changing `avatar_url` on own profile → succeeds  
- [ ] **5.5** Updating another user's profile → 0 rows updated (RLS blocks)  

### 6. Anonymous Access Blocking

_Unauthenticated (anon key) users CANNOT access any protected data._

- [ ] **6.1** `SELECT * FROM projects` → 0 rows  
- [ ] **6.2** `SELECT * FROM organizations` → 0 rows  
- [ ] **6.3** `SELECT * FROM organization_members` → 0 rows  
- [ ] **6.4** `SELECT * FROM profiles` → 0 rows  
- [ ] **6.5** `SELECT * FROM stakeholders` → 0 rows  
- [ ] **6.6** `INSERT INTO projects (...)` → ERROR  
- [ ] **6.7** `UPDATE projects SET ...` → 0 rows updated  
- [ ] **6.8** `DELETE FROM projects` → 0 rows deleted  

### 7. Service Role Bypass

_Service role (admin client) has full access to all data across all orgs._

- [ ] **7.1** Service role can SELECT all projects across all orgs  
- [ ] **7.2** Service role can INSERT a project in any org  
- [ ] **7.3** Service role can UPDATE any project  
- [ ] **7.4** Service role can DELETE any project  
- [ ] **7.5** Service role can change `profiles.organization_id` (bypasses trigger via RLS bypass)  
- [ ] **7.6** Service role can read all organization_members across all orgs  

---

## Future Automation Recommendations

### Short-term (Sprint 3-4)

1. **Supabase CLI test runner:** Write a script that uses `supabase test` or a custom Node.js script with the Supabase client to run these tests programmatically.

2. **pgTAP extension:** If Supabase enables the `pgtap` extension, write RLS tests as database unit tests that run in CI.

### Medium-term (Post-MVP)

3. **Integration test suite:** Create a test file like `tests/rls-isolation.test.ts` that:
   - Creates two Supabase clients (one per test user)
   - Runs each test case programmatically
   - Asserts expected results
   - Cleans up test data

4. **CI pipeline:** Run the RLS test suite on every PR that modifies migrations or RLS policies using GitHub Actions.

### Suggested test framework stack

```bash
npm install --save-dev vitest @supabase/supabase-js dotenv
```

```typescript
// tests/rls-isolation.test.ts
import { createClient } from "@supabase/supabase-js";

// Create clients for Alice (Org Alpha) and Bob (Org Beta)
const aliceClient = createClient(SUPABASE_URL, ANON_KEY, { ... });
const bobClient = createClient(SUPABASE_URL, ANON_KEY, { ... });

// Sign in as Alice, then as Bob
// Run assertions like:
// expect((await aliceClient.from("projects").select()).data).toHaveLength(1);
// expect((await aliceClient.from("projects").select().eq("organization_id", orgBId)).data).toHaveLength(0);
```

---

## Test Data Reference

The SQL test script creates the following test data:

| Entity | ID | Notes |
|--------|-----|-------|
| Org Alpha | `a0000000-0000-0000-0000-000000000001` | Alice's organization |
| Org Beta | `b0000000-0000-0000-0000-000000000002` | Bob's organization |
| Alice | `a0000000-0000-0000-0000-000000000010` | Member of Org Alpha (owner) |
| Bob | `b0000000-0000-0000-0000-000000000020` | Member of Org Beta (owner) |
| Project Alpha | `p0a00000-0000-0000-0000-000000000001` | Belongs to Org Alpha |
| Project Beta | `p0b00000-0000-0000-0000-000000000002` | Belongs to Org Beta |

All test data is cleaned up at the end of the script.