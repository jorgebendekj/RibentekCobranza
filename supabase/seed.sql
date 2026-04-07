# Seed Data para Desarrollo — Aicobranzas

-- Ejecutar en Supabase Dashboard > SQL Editor

-- 1. Crear tenant de prueba
INSERT INTO tenants (id, name, nit, address)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Empresa Demo S.R.L.',
  '12345678',
  'Av. Principal 123, La Paz'
);

-- 2. Crear usuario admin en auth (desde Supabase Dashboard > Auth > Users)
-- Email: admin@demo.com | Password: Admin1234!
-- Luego copiar el UUID generado y usarlo abajo:

-- 3. Insertar perfil del usuario (reemplazar UUID con el de Supabase Auth)
INSERT INTO users (id, name, email, role, tenant_id, enabled)
VALUES (
  'reemplazar-con-uuid-de-supabase-auth',
  'Administrador Demo',
  'admin@demo.com',
  'Admin',
  'a0000000-0000-0000-0000-000000000001',
  true
);

-- 4. Contactos de prueba
INSERT INTO contacts (name, phone_number, email, tenant_id) VALUES
  ('Juan Carlos Pérez', '+591 70012345', 'juan@email.com', 'a0000000-0000-0000-0000-000000000001'),
  ('María Fernández', '+591 71123456', 'maria@email.com', 'a0000000-0000-0000-0000-000000000001'),
  ('Roberto Mamani', '+591 72234567', 'roberto@email.com', 'a0000000-0000-0000-0000-000000000001');

-- 5. Debts y debt_details de prueba (referencia IDs de contactos creados arriba)
-- Obtener IDs: SELECT id, name FROM contacts WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';

-- Ejemplo (sustituir {CONTACT_ID} por el UUID real):
-- INSERT INTO debts (contact_id, debt_count, debt_paid_count, debt_pending_count, total_debt, total_paid, total_pending, debt_status, tenant_id)
-- VALUES ('{CONTACT_ID}', 2, 0, 2, 15000, 0, 15000, 'Pending', 'a0000000-0000-0000-0000-000000000001');
