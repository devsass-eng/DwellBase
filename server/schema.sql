-- DwellBase PostgreSQL Schema
-- Run once to initialize the database

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Super Admins (Platform Super Administrators) ───────────────────────────
CREATE TABLE IF NOT EXISTS super_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Landlords (Admin Accounts) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS landlords (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name                   TEXT NOT NULL,
  email                       TEXT NOT NULL UNIQUE,
  password_hash               TEXT NOT NULL,
  phone                       TEXT,
  property_name               TEXT DEFAULT ''::TEXT,
  property_address            TEXT DEFAULT ''::TEXT,
  subscription_plan           TEXT DEFAULT 'Standard' CHECK (subscription_plan IN ('Starter','Standard','Pro','Enterprise')),
  subscription_duration_months INTEGER DEFAULT 12,
  subscription_start_date     DATE DEFAULT CURRENT_DATE,
  subscription_end_date       DATE DEFAULT (CURRENT_DATE + INTERVAL '12 months'),
  account_status              TEXT DEFAULT 'Active' CHECK (account_status IN ('Active','Suspended','Expired','Pending Activation')),
  reset_token                 TEXT,
  reset_token_expires_at      TIMESTAMPTZ,
  momo_network                TEXT DEFAULT ''::TEXT,
  momo_name                   TEXT DEFAULT ''::TEXT,
  momo_number                 TEXT DEFAULT ''::TEXT,
  payment_instructions        TEXT DEFAULT ''::TEXT,
  notif_new_tenant            BOOLEAN DEFAULT TRUE,
  notif_manual_momo           BOOLEAN DEFAULT TRUE,
  notif_confirmed_payment     BOOLEAN DEFAULT TRUE,
  notif_upcoming_charges      BOOLEAN DEFAULT FALSE,
  notif_overdue_charges       BOOLEAN DEFAULT TRUE,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ??? Rooms ???????????????????????????????????????????????????????????????????
CREATE TABLE IF NOT EXISTS rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id     UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  room_number     TEXT NOT NULL,
  room_code       TEXT NOT NULL,
  monthly_rent    NUMERIC(12,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Vacant' CHECK (status IN ('Vacant','Occupied','Maintenance')),
  archived        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(landlord_id, room_code)
);

-- ??? Tenants ?????????????????????????????????????????????????????????????????
CREATE TABLE IF NOT EXISTS tenants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id             UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  tenant_id               TEXT NOT NULL,  -- human-readable e.g. TENT-01
  full_name               TEXT NOT NULL,
  phone                   TEXT,
  email                   TEXT,
  password_hash           TEXT,           -- for tenant portal login
  room_id                 UUID REFERENCES rooms(id),
  room_number             TEXT,
  room_code               TEXT,
  monthly_rent            NUMERIC(12,2),
  start_date              DATE,
  duration_months         INTEGER,
  end_date                DATE,
  total_contractual_rent  NUMERIC(12,2) DEFAULT 0,
  amount_paid             NUMERIC(12,2) DEFAULT 0,
  outstanding_balance     NUMERIC(12,2) DEFAULT 0,
  tenancy_status          TEXT DEFAULT 'Upcoming' CHECK (tenancy_status IN ('Upcoming','Active','Expiring Soon','Expired','Ended')),
  account_status          TEXT DEFAULT 'Not Set Up' CHECK (account_status IN ('Not Set Up','Invitation Pending','Active','Suspended')),
  notif_payment_confirmations BOOLEAN DEFAULT TRUE,
  notif_manual_momo           BOOLEAN DEFAULT TRUE,
  notif_upcoming_bills        BOOLEAN DEFAULT FALSE,
  notif_overdue_charges       BOOLEAN DEFAULT TRUE,
  notif_new_regulations       BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(landlord_id, tenant_id)
);

-- ??? Billing Categories ???????????????????????????????????????????????????????
CREATE TABLE IF NOT EXISTS billing_categories (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id             UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  description             TEXT DEFAULT '',
  billing_frequency       TEXT NOT NULL CHECK (billing_frequency IN ('monthly','yearly','custom')),
  custom_interval_months  INTEGER,
  default_amount          NUMERIC(12,2),
  is_default              BOOLEAN DEFAULT FALSE,
  status                  TEXT DEFAULT 'active' CHECK (status IN ('active','archived')),
  grace_period_days       INTEGER DEFAULT 7,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ??? Charges ?????????????????????????????????????????????????????????????????
CREATE TABLE IF NOT EXISTS charges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id      UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES billing_categories(id),
  category_name    TEXT NOT NULL,
  tenant_id        UUID REFERENCES tenants(id),
  tenant_name      TEXT NOT NULL,
  room_id          UUID REFERENCES rooms(id),
  room_number      TEXT NOT NULL,
  amount           NUMERIC(12,2) NOT NULL,
  amount_paid      NUMERIC(12,2) DEFAULT 0,
  remaining_balance NUMERIC(12,2) NOT NULL,
  issue_date       DATE NOT NULL,
  due_date         DATE NOT NULL,
  billing_period   TEXT NOT NULL,
  status           TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','pending','overdue','paid','partially_paid')),
  issued_by        TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ??? Payments ?????????????????????????????????????????????????????????????????
CREATE TABLE IF NOT EXISTS payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id      UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL UNIQUE,
  tenant_id        UUID REFERENCES tenants(id),
  tenant_name      TEXT NOT NULL,
  room_id          UUID REFERENCES rooms(id),
  room_number      TEXT NOT NULL,
  charge_id        UUID REFERENCES charges(id),
  category_id      UUID REFERENCES billing_categories(id),
  category_name    TEXT NOT NULL,
  billing_period   TEXT NOT NULL,
  amount           NUMERIC(12,2) NOT NULL,
  payment_method   TEXT NOT NULL CHECK (payment_method IN ('cash','momo')),
  momo_network     TEXT CHECK (momo_network IN ('mtn','telecel','at')),
  provider_ref     TEXT,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','successful','failed','reversed','pending_sync')),
  recorded_by      TEXT NOT NULL,
  payment_date     DATE NOT NULL,
  notes            TEXT,
  receipt_ref      TEXT,
  receipt_number   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ??? Regulations ?????????????????????????????????????????????????????????????
CREATE TABLE IF NOT EXISTS regulations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ??? Audit Logs ???????????????????????????????????????????????????????????????
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id     UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('payment','charge','tenant')),
  entity_id       UUID NOT NULL,
  field           TEXT NOT NULL,
  original_value  TEXT,
  corrected_value TEXT,
  actor           TEXT NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Super Admin Audit Logs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_admin_audit_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id    UUID REFERENCES super_admins(id) ON DELETE SET NULL,
  super_admin_name  TEXT NOT NULL,
  action            TEXT NOT NULL, -- e.g. CREATE_LANDLORD, ACTIVATE_ACCOUNT, SUSPEND_ACCOUNT, RENEW_SUBSCRIPTION, CHANGE_PLAN, RESET_ACCESS, EDIT_LANDLORD
  landlord_id       UUID REFERENCES landlords(id) ON DELETE CASCADE,
  landlord_name     TEXT NOT NULL,
  details           JSONB DEFAULT '{}'::JSONB,
  notes             TEXT DEFAULT '',
  ip_address        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rooms_landlord ON rooms(landlord_id);
CREATE INDEX IF NOT EXISTS idx_tenants_landlord ON tenants(landlord_id);
CREATE INDEX IF NOT EXISTS idx_tenants_room ON tenants(room_id);
CREATE INDEX IF NOT EXISTS idx_charges_landlord ON charges(landlord_id);
CREATE INDEX IF NOT EXISTS idx_charges_tenant ON charges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_landlord ON payments(landlord_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_charge ON payments(charge_id);
CREATE INDEX IF NOT EXISTS idx_regulations_landlord ON regulations(landlord_id);
CREATE INDEX IF NOT EXISTS idx_audit_landlord ON audit_logs(landlord_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_landlord ON super_admin_audit_logs(landlord_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_action ON super_admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_created ON super_admin_audit_logs(created_at DESC);
