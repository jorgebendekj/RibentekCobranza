-- Seed mock data (run AFTER /setup/init has created first tenant + superadmin)
-- Idempotent-ish: clears tenant-scoped data for the first tenant found.

DO $$
DECLARE
  t_id uuid;
  su_id uuid;
  e_id uuid;
BEGIN
  SELECT id INTO t_id FROM public.tenants WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;
  IF t_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found. Run /setup/init first.';
  END IF;

  SELECT id INTO su_id FROM public.users WHERE deleted_at IS NULL AND enabled = true AND role = 'Superadmin' ORDER BY created_at ASC LIMIT 1;
  IF su_id IS NULL THEN
    RAISE EXCEPTION 'No Superadmin profile found. Run /setup/init first.';
  END IF;

  -- Clear tenant data
  UPDATE public.tenant_invites SET deleted_at = now() WHERE tenant_id = t_id AND deleted_at IS NULL;
  UPDATE public.tenant_members SET deleted_at = now(), enabled = false WHERE tenant_id = t_id AND user_id <> su_id AND deleted_at IS NULL;

  DELETE FROM public.notifications WHERE tenant_id = t_id;
  DELETE FROM public.notification_preferences WHERE tenant_id = t_id;
  DELETE FROM public.notification_events WHERE tenant_id = t_id;

  DELETE FROM public.whatsapp_mass_send_recipients WHERE mass_send_run_id IN (SELECT id FROM public.whatsapp_mass_send_runs WHERE tenant_id = t_id);
  DELETE FROM public.whatsapp_mass_send_runs WHERE tenant_id = t_id;
  DELETE FROM public.whatsapp_mass_send_schedules WHERE mass_send_id IN (SELECT id FROM public.whatsapp_mass_sends WHERE tenant_id = t_id);
  DELETE FROM public.whatsapp_mass_sends WHERE tenant_id = t_id;

  DELETE FROM public.whatsapp_messages WHERE whatsapp_thread_id IN (SELECT id FROM public.whatsapp_threads WHERE tenant_id = t_id);
  DELETE FROM public.whatsapp_threads WHERE tenant_id = t_id;
  DELETE FROM public.whatsapp_templates WHERE whatsapp_configuration_id IN (SELECT id FROM public.whatsapp_configurations WHERE tenant_id = t_id);
  DELETE FROM public.whatsapp_configurations WHERE tenant_id = t_id;

  DELETE FROM public.reminder_logs WHERE reminder_program_id IN (
    SELECT rp.id
    FROM public.reminder_programs rp
    JOIN public.reminders r ON r.id = rp.reminder_id
    JOIN public.debts d ON d.id = r.debt_id
    WHERE d.tenant_id = t_id
  );
  DELETE FROM public.reminder_programs WHERE reminder_id IN (
    SELECT r.id
    FROM public.reminders r
    JOIN public.debts d ON d.id = r.debt_id
    WHERE d.tenant_id = t_id
  );
  DELETE FROM public.reminders WHERE debt_id IN (SELECT id FROM public.debts WHERE tenant_id = t_id);

  DELETE FROM public.debt_detail_qrs WHERE debt_detail_id IN (
    SELECT dd.id
    FROM public.debt_details dd
    JOIN public.debts d ON d.id = dd.debt_id
    WHERE d.tenant_id = t_id
  );
  DELETE FROM public.debt_details WHERE debt_id IN (SELECT id FROM public.debts WHERE tenant_id = t_id);
  DELETE FROM public.debts WHERE tenant_id = t_id;
  DELETE FROM public.contacts WHERE tenant_id = t_id;

  -- Ensure at least one plan + subscription
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE deleted_at IS NULL) THEN
    INSERT INTO public.subscription_plans (name, description, price, duration_in_days, renewable)
    VALUES ('Starter', 'Plan inicial (mock)', 0, 3650, true);
  END IF;

  -- Upsert subscription for tenant
  INSERT INTO public.subscriptions (subscription_plan_id, tenant_id, price, expiration_date, enable, created_by, updated_by)
  SELECT sp.id, t_id, sp.price, (current_date + 3650), true, su_id, su_id
  FROM public.subscription_plans sp
  WHERE sp.deleted_at IS NULL
  ORDER BY sp.price ASC
  LIMIT 1
  ON CONFLICT DO NOTHING;

  -- Mock contacts
  INSERT INTO public.contacts (tenant_id, name, phone_number, email, created_by, updated_by)
  VALUES
    (t_id, 'Juan Perez', '+573001112233', 'juan.perez@example.com', su_id, su_id),
    (t_id, 'Maria Gomez', '+573004445566', 'maria.gomez@example.com', su_id, su_id)
  ON CONFLICT DO NOTHING;

  -- Mock debts
  INSERT INTO public.debts (tenant_id, contact_id, total_amount, due_date, status, created_by, updated_by)
  SELECT t_id, c.id, 1200000, (current_date - 30), 'pendiente', su_id, su_id
  FROM public.contacts c
  WHERE c.tenant_id = t_id
  ORDER BY c.created_at ASC
  LIMIT 1;

  -- Mock WhatsApp config + one thread/message
  INSERT INTO public.whatsapp_configurations (tenant_id, meta_id, waba_id, token, phone_number_id, verify_token, channel_name, created_by, updated_by)
  VALUES (t_id, 'mock_meta', 'mock_waba', 'mock_token', 'mock_phone', 'mock_verify', 'Mock Channel', su_id, su_id)
  ON CONFLICT (tenant_id) DO UPDATE SET updated_at = now();

  INSERT INTO public.whatsapp_threads (tenant_id, contact_id, last_message, last_interaction, created_by, updated_by)
  SELECT t_id, c.id, 'Hola! Esto es un mensaje mock.', now(), su_id, su_id
  FROM public.contacts c
  WHERE c.tenant_id = t_id
  ORDER BY c.created_at ASC
  LIMIT 1;

  -- Notifications mock
  INSERT INTO public.notification_events (tenant_id, event_type, payload, created_by, updated_by)
  VALUES (t_id, 'mock.event', jsonb_build_object('hello','world'), su_id, su_id)
  RETURNING id INTO e_id;

  INSERT INTO public.notifications (tenant_id, user_id, event_id, title, body, severity, action_url, created_by, updated_by)
  VALUES (t_id, su_id, e_id, 'Bienvenido', 'Sistema reiniciado con data mock.', 'info', '/cobranzas', su_id, su_id);
EXCEPTION
  WHEN OTHERS THEN
    -- ignore notification seed if table missing or constraints differ
    NULL;
END $$;