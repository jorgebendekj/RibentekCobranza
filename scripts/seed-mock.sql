-- Seed mock data (run AFTER /setup/init has created first tenant + superadmin)
-- Idempotent-ish: clears tenant-scoped data for the first tenant found.
--
-- Prioriza el perfil de carlosrichterhurtado@gmail.com como actor (created_by / notificaciones).
-- Incluye un contacto con +59169160323 y deuda pendiente para pruebas de envío masivo.

DO $$
DECLARE
  t_id uuid;
  actor_id uuid;
  v_email text := 'carlosrichterhurtado@gmail.com';
  e_id uuid;
  juan_id uuid;
  maria_id uuid;
  bolivia_id uuid;
  d_id uuid;
BEGIN
  SELECT id INTO t_id FROM public.tenants WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;
  IF t_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found. Run /setup/init first.';
  END IF;

  SELECT id INTO actor_id
  FROM public.users
  WHERE deleted_at IS NULL AND lower(email) = lower(v_email)
  LIMIT 1;

  IF actor_id IS NULL THEN
    SELECT id INTO actor_id
    FROM public.users
    WHERE deleted_at IS NULL AND enabled = true AND role = 'Superadmin'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'No user profile for % nor Superadmin. Run bootstrap or /setup/init first.', v_email;
  END IF;

  -- Clear tenant data (keep memberships for actor_id)
  UPDATE public.tenant_invites SET deleted_at = now() WHERE tenant_id = t_id AND deleted_at IS NULL;
  UPDATE public.tenant_members
  SET deleted_at = now(), enabled = false
  WHERE tenant_id = t_id AND user_id <> actor_id AND deleted_at IS NULL;

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

  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE tenant_id = t_id AND deleted_at IS NULL) THEN
    INSERT INTO public.subscriptions (subscription_plan_id, tenant_id, price, expiration_date, enable, created_by, updated_by)
    SELECT sp.id, t_id, sp.price, (current_date + 3650), true, actor_id, actor_id
    FROM public.subscription_plans sp
    WHERE sp.deleted_at IS NULL
    ORDER BY sp.price ASC
    LIMIT 1;
  END IF;

  -- Mock contacts (+59169160323 para envío masivo)
  INSERT INTO public.contacts (tenant_id, name, phone_number, email, created_by, updated_by)
  VALUES (t_id, 'Juan Perez', '+573001112233', 'juan.perez@example.com', actor_id, actor_id)
  RETURNING id INTO juan_id;

  INSERT INTO public.contacts (tenant_id, name, phone_number, email, created_by, updated_by)
  VALUES (t_id, 'Maria Gomez', '+573004445566', 'maria.gomez@example.com', actor_id, actor_id)
  RETURNING id INTO maria_id;

  -- Teléfono en formato E.164 solo dígitos (recomendado por Meta para el campo `to`)
  INSERT INTO public.contacts (tenant_id, name, phone_number, email, created_by, updated_by)
  VALUES (t_id, 'Cliente Bolivia (envío masivo)', '59169160323', 'cliente.bolivia@example.com', actor_id, actor_id)
  RETURNING id INTO bolivia_id;

  -- Deudas: fila agregada + detalle (dispara recalc_debts_aggregate)
  INSERT INTO public.debts (tenant_id, contact_id, created_by, updated_by)
  VALUES (t_id, juan_id, actor_id, actor_id)
  RETURNING id INTO d_id;

  INSERT INTO public.debt_details (
    contact_id, debt_id, debt_amount, debt_description, penalty_amount, total, expiration_date, debt_status, created_by, updated_by
  ) VALUES (
    juan_id, d_id, 500000, 'Factura mock Juan', 0, 500000, (current_date - 40), 'Active', actor_id, actor_id
  );

  INSERT INTO public.debts (tenant_id, contact_id, created_by, updated_by)
  VALUES (t_id, maria_id, actor_id, actor_id)
  RETURNING id INTO d_id;

  INSERT INTO public.debt_details (
    contact_id, debt_id, debt_amount, debt_description, penalty_amount, total, expiration_date, debt_status, created_by, updated_by
  ) VALUES (
    maria_id, d_id, 320000, 'Factura mock Maria', 0, 320000, (current_date - 15), 'Active', actor_id, actor_id
  );

  INSERT INTO public.debts (tenant_id, contact_id, created_by, updated_by)
  VALUES (t_id, bolivia_id, actor_id, actor_id)
  RETURNING id INTO d_id;

  INSERT INTO public.debt_details (
    contact_id, debt_id, debt_amount, debt_description, penalty_amount, total, expiration_date, debt_status, created_by, updated_by
  ) VALUES (
    bolivia_id, d_id, 850000, 'Deuda mock envío masivo +591', 0, 850000, (current_date - 35), 'Active', actor_id, actor_id
  );

  -- Mock WhatsApp config + hilo en el contacto de envío masivo
  INSERT INTO public.whatsapp_configurations (tenant_id, meta_id, waba_id, token, phone_number_id, verify_token, channel_name, created_by, updated_by)
  VALUES (t_id, 'mock_meta', 'mock_waba', 'mock_token', 'mock_phone', 'mock_verify', 'Mock Channel', actor_id, actor_id)
  ON CONFLICT (tenant_id) DO UPDATE SET updated_at = now();

  INSERT INTO public.whatsapp_threads (tenant_id, contact_id, last_message, last_interaction, created_by, updated_by)
  VALUES (t_id, bolivia_id, 'Hola! Contacto listo para prueba de envío masivo.', now(), actor_id, actor_id);

  -- Notifications mock (no afectar el resto del seed si falla)
  BEGIN
    INSERT INTO public.notification_events (tenant_id, event_type, payload, created_by, updated_by)
    VALUES (t_id, 'mock.event', jsonb_build_object('seed', 'mock', 'for_email', v_email), actor_id, actor_id)
    RETURNING id INTO e_id;

    INSERT INTO public.notifications (tenant_id, user_id, event_id, title, body, severity, action_url, created_by, updated_by)
    VALUES (t_id, actor_id, e_id, 'Data mock', 'Contactos y deudas de prueba cargados (incl. +59169160323).', 'info', '/configuracion', actor_id, actor_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'seed-mock: notificaciones omitidas: %', SQLERRM;
  END;
END $$;
