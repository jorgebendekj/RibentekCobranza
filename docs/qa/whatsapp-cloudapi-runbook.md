# WhatsApp Cloud API QA Runbook (Staging)

## 1) Setup
- Start backend:
  - `cd server`
  - `node index.js`
- Ensure `server/.env` has valid:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Optional root `.env.local`:
  - `VITE_ADMIN_SERVER_URL=http://localhost:3001`

## 2) Smoke Script Execution
From repository root:

```bash
node --env-file server/.env scripts/qa-whatsapp-smoke.mjs
```

Expected:
- Health check pass
- Webhook verify valid token pass
- Webhook verify invalid token pass (`403`)
- Inbound webhook simulation returns `200`

## 3) Postman Execution (Protected Endpoints)
Import:
- `qa/postman/whatsapp-cloudapi.postman_collection.json`
- `qa/postman/whatsapp-cloudapi.staging.postman_environment.json`

Set environment variables:
- `auth_token` (JWT from Admin/Superadmin user session)
- `tenant_id`
- `tenant_id_wrong` (different tenant)
- `target_phone_number`
- `thread_id` (optional)
- `verify_token`
- `meta_id`, `waba_id`, `phone_number_id`, `meta_token`

Run in this order:
1. Health
2. Webhook Verify - Valid Token
3. Webhook Verify - Invalid Token
4. Send Message - Missing Phone Number
5. Tenant Isolation - Wrong Tenant Header
6. Send Message - Positive
7. Upsert Meta Configuration
8. Create Meta Template
9. Sync Meta Templates

## 4) Bandeja E2E Checklist

### E2E-01 Send from existing thread (P0)
- Open `Bandeja`.
- Select an existing conversation with valid `contacts.phone_number`.
- Send message from composer.
- Verify:
  - message appears in UI
  - message stored as outbound in `whatsapp_messages`
  - thread `last_message` updated

### E2E-02 Start chat from contact search (P0)
- Switch to `Nuevo chat`.
- Search a contact by name/phone.
- Start chat and send first message.
- Verify thread is created/reused correctly.

### E2E-03 Receive inbound message (P0)
- Trigger inbound webhook from Meta or test harness.
- Keep `Bandeja` open in selected thread.
- Verify UI updates in realtime (new inbound bubble).

### E2E-04 Read state propagation (P1)
- Send outbound message.
- Trigger status webhook with `status=read`.
- Verify outbound shows read state.

### E2E-05 Error handling (P1)
- Force Meta failure (invalid token or permissions).
- Verify UI toast shows error and message is not reported as successful.

## 5) DB Evidence Queries
Run in Supabase SQL Editor:

```sql
select id, tenant_id, phone_number_id, verify_token
from public.whatsapp_configurations
where deleted_at is null;
```

```sql
select id, whatsapp_thread_id, incoming, read, message_text, sent_at, created_at
from public.whatsapp_messages
order by created_at desc
limit 50;
```

```sql
select id, tenant_id, contact_id, last_message, last_interaction, updated_at
from public.whatsapp_threads
where deleted_at is null
order by updated_at desc
limit 20;
```

## 6) Execution Log Template

Use this structure in test evidence:

| Case | Result | Evidence | Notes |
|---|---|---|---|
| TC-001 Send valid | PASS/FAIL | API response + DB row id | |
| TC-003 Tenant isolation | PASS/FAIL | HTTP 403 response | |
| E2E-03 Realtime inbound | PASS/FAIL | UI screenshot + DB row | |

## 7) Go/No-Go Rules
- Go:
  - All P0 pass.
  - No cross-tenant security issue.
  - No data integrity issue in threads/messages.
- No-Go:
  - Any P0 fails.
  - Any unauthorized cross-tenant action succeeds.
  - Message send reports success but DB/UI inconsistent.

