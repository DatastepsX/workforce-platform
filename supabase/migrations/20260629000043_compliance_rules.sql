-- Compliance Rules
CREATE TABLE compliance_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT,
  country           TEXT,                      -- NULL = all countries (ISO 3166-1 alpha-2)
  contract_type     TEXT CHECK (contract_type IN ('perm','temp','contracting','sow')), -- NULL = all types
  cost_item_id      UUID REFERENCES cost_items(id) ON DELETE SET NULL,
  effective_from    DATE,
  effective_to      DATE,
  severity          TEXT NOT NULL CHECK (severity IN ('info','warning','error')) DEFAULT 'warning',
  threshold         NUMERIC,
  threshold_unit    TEXT,                      -- 'hours', 'days', 'eur', 'percentage', 'months'
  validation_logic  TEXT NOT NULL,             -- machine key: 'max_daily_hours', 'max_weekly_hours', etc.
  override_allowed  BOOLEAN DEFAULT FALSE,
  active            BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Per-tenant rule overrides — NULL = globally applies
CREATE TABLE compliance_rule_clients (
  rule_id   UUID REFERENCES compliance_rules(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, tenant_id)
);

-- Audit / Validation Log
CREATE TABLE compliance_validation_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id               UUID REFERENCES compliance_rules(id) ON DELETE SET NULL,
  rule_snapshot         JSONB,                -- copy of rule at time of validation
  entity_type           TEXT NOT NULL,        -- 'timesheet', 'expense', 'award', 'submission'
  entity_id             UUID,
  validation_result     TEXT NOT NULL CHECK (validation_result IN ('passed','warning','failed')),
  override_decision     BOOLEAN DEFAULT FALSE,
  override_reason       TEXT,
  override_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at          TIMESTAMPTZ DEFAULT NOW(),
  final_outcome         TEXT CHECK (final_outcome IN ('approved','rejected','pending'))
);

-- Triggers
CREATE OR REPLACE FUNCTION update_compliance_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_compliance_rules_updated_at
  BEFORE UPDATE ON compliance_rules
  FOR EACH ROW EXECUTE FUNCTION update_compliance_rules_updated_at();

-- RLS
ALTER TABLE compliance_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_rule_clients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_validation_logs  ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users (needed during timesheet/expense entry)
CREATE POLICY "cr_read"         ON compliance_rules            FOR SELECT TO authenticated USING (true);
CREATE POLICY "cr_cli_read"     ON compliance_rule_clients     FOR SELECT TO authenticated USING (true);
CREATE POLICY "cvl_read"        ON compliance_validation_logs  FOR SELECT TO authenticated USING (validated_by = auth.uid() OR get_my_role() IN ('admin','super_admin'));

-- Write: super_admin manages rules; any authenticated user can insert validation logs
CREATE POLICY "cr_write"        ON compliance_rules            FOR ALL TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "cr_cli_write"    ON compliance_rule_clients     FOR ALL TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "cvl_insert"      ON compliance_validation_logs  FOR INSERT TO authenticated WITH CHECK (validated_by = auth.uid());
CREATE POLICY "cvl_admin_write" ON compliance_validation_logs  FOR ALL TO authenticated USING (get_my_role() IN ('admin','super_admin'));

-- ─── Seed: Standard Compliance Rules ─────────────────────────────────────────
INSERT INTO compliance_rules (name, description, country, contract_type, severity, threshold, threshold_unit, validation_logic, override_allowed, effective_from) VALUES
  -- Working Time Directive (EU/Germany)
  ('Maximum Daily Hours',          'Worker must not exceed the statutory maximum daily working hours.',    'DE', 'temp',        'error',   10,   'hours',      'max_daily_hours',      false, '2020-01-01'),
  ('Maximum Weekly Hours',         'Worker must not exceed 48 hours per week (EU Working Time Directive).','DE', 'temp',        'error',   48,   'hours',      'max_weekly_hours',     false, '2020-01-01'),
  ('Warning: Approaching 40h',     'Early warning before the 48h statutory limit is reached.',            'DE', 'temp',        'warning', 40,   'hours',      'max_weekly_hours',     true,  '2020-01-01'),
  ('Minimum Daily Rest Period',    'Minimum 11 consecutive hours of rest between shifts.',                'DE', 'temp',        'error',   11,   'hours',      'min_rest_period',      false, '2020-01-01'),
  ('Sunday Work Restriction',      'Sunday work requires prior regulatory approval in Germany.',          'DE', 'temp',        'warning', NULL, NULL,         'sunday_restriction',   true,  '2020-01-01'),
  ('Public Holiday Restriction',   'Confirm public holiday approval before logging hours.',              'DE', 'temp',        'warning', NULL, NULL,         'public_holiday',       true,  '2020-01-01'),

  -- Minimum Wage (Germany)
  ('German Minimum Wage',          'Effective hourly rate must meet the statutory Mindestlohn.',          'DE', 'temp',        'error',  12.82, 'eur',       'min_wage_hourly',      false, '2024-01-01'),

  -- AÜG (German Temporary Staffing Act)
  ('AÜG Equal Pay Threshold',      'Equal pay applies after 9 months on the same assignment (AÜG §8).',  'DE', 'temp',        'warning',  9,   'months',     'aug_equal_pay',        false, '2017-04-01'),
  ('AÜG Maximum Assignment Duration','Temporary assignments must not exceed 18 months (AÜG §1 Abs. 1b).','DE', 'temp',       'error',   18,   'months',     'aug_max_duration',     false, '2017-04-01'),
  ('AÜG Tariff Agreement Required','BAP/iGZ collective agreement must be in place for AÜG compliance.',  'DE', 'temp',        'error',  NULL, NULL,         'aug_tariff_required',  false, '2017-04-01'),

  -- Contracting compliance
  ('IR35 Status Required',         'IR35 determination must be completed before contractor engagement.',  'GB', 'contracting', 'error',  NULL, NULL,         'ir35_status',          false, '2021-04-06'),
  ('Scheinselbst. Check Required', 'False self-employment assessment required under §611a BGB.',         'DE', 'contracting', 'error',  NULL, NULL,         'scheinselbst_status',  false, '2020-01-01'),
  ('Contractor Max Weekly Hours',  'Contractors should not exceed 48 hours per week.',                   'DE', 'contracting', 'warning', 48,  'hours',      'max_weekly_hours',     true,  '2020-01-01'),

  -- Expense Policies (global)
  ('Maximum Per Diem',             'Daily subsistence must not exceed the approved per-diem cap.',        NULL, NULL,          'warning', 60,  'eur',        'max_per_diem',         true,  '2020-01-01'),
  ('Mileage Rate Cap',             'Mileage must be claimed at no more than the approved rate.',          NULL, 'temp',        'warning', 0.30,'eur',        'max_mileage_rate',     true,  '2020-01-01'),
  ('Receipt Required Threshold',   'Receipts are mandatory for any single expense above this threshold.', NULL, NULL,          'warning', 25,  'eur',        'receipt_required',     false, '2020-01-01'),

  -- Protected Groups
  ('Minor Worker Hours Limit',     'Workers under 18 must not exceed 8 hours per day.',                  'DE', 'temp',        'error',    8,  'hours',      'minor_worker_hours',   false, '2020-01-01'),
  ('Maternity Protection',         'Pregnant workers are prohibited from certain shift types.',          'DE', 'temp',        'error',  NULL, NULL,         'maternity_protection', false, '2020-01-01');
