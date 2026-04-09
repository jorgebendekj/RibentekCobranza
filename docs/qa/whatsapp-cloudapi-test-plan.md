# QA Test Plan - WhatsApp Cloud API + Bandeja

## Scope
- Validate the end-to-end flow: `Bandeja -> Admin API -> Meta Cloud API -> Webhook -> Supabase -> Bandeja`.
- Cover critical parameters: `phone_number`, `thread_id`, `tenant_id`, `phone_number_id`, `Authorization`, `x-tenant-id`, `verify_token`.
- Cover positive, negative, and cross-tenant security cases in staging.

## System Under Test
- Frontend:
  - `src/app/pages/Bandeja.tsx`
  - `src/app/hooks/useThreads.ts`
  - `src/app/services/whatsapp.service.ts`
- Backend:
  - `server/index.js`
- Data model:
  - `contacts`
  - `whatsapp_threads`
  - `whatsapp_messages`
  - `whatsapp_configurations`
  - `whatsapp_templates`

## Preconditions (Staging)
- `server/.env` has valid `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- At least one active `whatsapp_configurations` row with:
  - `tenant_id`
  - `phone_number_id`
  - `token`
  - `verify_token`
- At least one authenticated Admin/Superadmin test user.
- Backend server reachable at `ADMIN_BASE_URL` (default `http://localhost:3001`).
- If webhook signature is enforced, `META_APP_SECRET` is configured.

## API Contract Inventory

### `POST /api/meta/messages/send`
- Auth: `Authorization: Bearer <jwt>`, `x-tenant-id: <uuid>`
- Body:
  - `phone_number` (required)
  - `message_text` (required)
  - `thread_id` (optional)
- Expected:
  - `201` on success, stores outbound message
  - `400` when missing required params or missing `phone_number_id` in config
  - `403` when tenant membership is invalid

### `POST /api/meta/configurations/upsert`
- Auth: Admin/Superadmin + `x-tenant-id`
- Body required fields:
  - `meta_id`, `waba_id`, `phone_number_id`, `token`, `verify_token`
- Expected:
  - Validates against Meta Graph before DB write
  - Returns `200` with `connection_check` payload on success

### `GET /webhooks/meta`
- Query required:
  - `hub.mode=subscribe`
  - `hub.verify_token`
  - `hub.challenge`
- Expected:
  - `200` with challenge for valid token
  - `403` for invalid token

### `POST /webhooks/meta`
- Body: Meta webhook payload (`entry[].changes[].value`)
- Uses `value.metadata.phone_number_id` to map tenant config
- Expected:
  - Inserts inbound message records and updates thread snapshot
  - Returns `200` always (by current server design)

### `POST /api/meta/templates/create`
- Auth: Admin/Superadmin + `x-tenant-id`
- Body required:
  - `name`, `category`, `components[]`
- Expected:
  - Creates template in Meta, then persists local template

### `GET /api/meta/templates/sync?mode=pending|all`
- Auth: Admin/Superadmin + `x-tenant-id`
- Expected:
  - Syncs status fields from Meta to local templates

## Test Matrix (P0/P1)

| ID | Priority | Area | Scenario | Expected |
|---|---|---|---|---|
| TC-001 | P0 | Send | Valid send from Bandeja with `phone_number` and active thread | `201`, outbound message saved, thread `last_message` updated |
| TC-002 | P0 | Send | Missing `phone_number` | `400` and readable validation error |
| TC-003 | P0 | Security | Valid JWT from tenant A with `x-tenant-id` tenant B | `403` |
| TC-004 | P0 | Config | Tenant has no `phone_number_id` | Send endpoint fails with controlled error |
| TC-005 | P0 | Webhook | Inbound webhook with valid `metadata.phone_number_id` | Contact/thread upsert + inbound message insert |
| TC-006 | P0 | Webhook | Inbound webhook with unknown `phone_number_id` | No tenant match, safe no-op, no crash |
| TC-007 | P1 | Webhook | Status webhook `read` for prior outbound message | Outbound unread messages become `read=true` |
| TC-008 | P1 | Config | Upsert with invalid `meta_id` or `token` | `400` with Graph validation error |
| TC-009 | P1 | Templates | Create template with valid payload | Meta + local DB record created |
| TC-010 | P1 | Templates | Sync templates in `pending` mode | `synced` count updated consistently |
| TC-011 | P1 | Realtime | New inbound message arrives while Bandeja open | UI updates without full refresh |
| TC-012 | P1 | UX/Error | Meta rejects send (expired token/permissions) | UI shows toast error and no fake success state |

## Data Validation Queries
- Verify config linkage:
  - `select id, tenant_id, phone_number_id, verify_token from public.whatsapp_configurations where deleted_at is null;`
- Verify threads:
  - `select id, tenant_id, contact_id, last_message, last_interaction from public.whatsapp_threads where deleted_at is null order by updated_at desc limit 20;`
- Verify messages:
  - `select id, whatsapp_thread_id, incoming, read, message_text, sent_at from public.whatsapp_messages order by created_at desc limit 50;`

## Exit Criteria
- All P0 cases pass.
- No critical tenant-isolation defect.
- No data integrity regression in `contacts/threads/messages`.
- P1 failures have owner + target fix date.

