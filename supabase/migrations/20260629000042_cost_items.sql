-- Cost Item Categories
CREATE TABLE cost_item_categories (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost Items Master Data
CREATE TABLE cost_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  description           TEXT,
  category_id           UUID REFERENCES cost_item_categories(id),
  billing_type          TEXT CHECK (billing_type IN ('hourly','daily','fixed','percentage','milestone','unit')),
  markup_eligible       BOOLEAN DEFAULT FALSE,
  pass_through          BOOLEAN DEFAULT FALSE,
  tax_treatment         TEXT CHECK (tax_treatment IN ('standard','exempt','reverse_charge','zero_rated')) DEFAULT 'standard',
  sap_gl_account        TEXT,
  sap_cost_object_type  TEXT CHECK (sap_cost_object_type IN ('cost_center','wbs_element','internal_order','profit_center')),
  countries             TEXT[] DEFAULT '{}',   -- ISO 3166-1 alpha-2; empty = all countries
  active                BOOLEAN DEFAULT TRUE,
  effective_from        DATE,
  effective_to          DATE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Contract-Type applicability (perm / temp / contracting / sow)
CREATE TABLE cost_item_contract_types (
  cost_item_id  UUID REFERENCES cost_items(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('perm','temp','contracting','sow')),
  PRIMARY KEY (cost_item_id, contract_type)
);

-- Per-tenant (client) overrides — NULL row = globally available
CREATE TABLE cost_item_clients (
  cost_item_id UUID REFERENCES cost_items(id) ON DELETE CASCADE,
  tenant_id    UUID REFERENCES tenants(id)    ON DELETE CASCADE,
  PRIMARY KEY (cost_item_id, tenant_id)
);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION update_cost_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_cost_items_updated_at
  BEFORE UPDATE ON cost_items
  FOR EACH ROW EXECUTE FUNCTION update_cost_items_updated_at();

-- RLS
ALTER TABLE cost_item_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_item_contract_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_item_clients      ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read cost items (needed for award/timesheet UI)
CREATE POLICY "ci_cats_read"       ON cost_item_categories  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ci_read"            ON cost_items             FOR SELECT TO authenticated USING (true);
CREATE POLICY "ci_ct_read"         ON cost_item_contract_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "ci_clients_read"    ON cost_item_clients      FOR SELECT TO authenticated USING (true);

-- Only super_admin may write
CREATE POLICY "ci_cats_write"      ON cost_item_categories  FOR ALL TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "ci_write"           ON cost_items             FOR ALL TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "ci_ct_write"        ON cost_item_contract_types FOR ALL TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "ci_clients_write"   ON cost_item_clients      FOR ALL TO authenticated USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');

-- ─── Seed: Categories ────────────────────────────────────────────────────────
INSERT INTO cost_item_categories (code, name, description, sort_order) VALUES
  ('LABOR',        'Labor',        'Billable time-based work costs',                     10),
  ('STATUTORY',    'Statutory',    'Legally mandated employer costs',                    20),
  ('EXPENSE',      'Expense',      'Reimbursable out-of-pocket expenses',                30),
  ('FEE',          'Fee',          'Commercial fees charged to the client',              40),
  ('COMPLIANCE',   'Compliance',   'Regulatory classification and status items',         50),
  ('PROJECT_COST', 'Project Cost', 'Fixed-price or milestone-based project deliverables',60),
  ('ADJUSTMENT',   'Adjustment',   'Credit notes, change orders, and billing corrections',70);

-- ─── Seed: Cost Items ─────────────────────────────────────────────────────────
DO $$
DECLARE
  c_labor       UUID := (SELECT id FROM cost_item_categories WHERE code='LABOR');
  c_statutory   UUID := (SELECT id FROM cost_item_categories WHERE code='STATUTORY');
  c_expense     UUID := (SELECT id FROM cost_item_categories WHERE code='EXPENSE');
  c_fee         UUID := (SELECT id FROM cost_item_categories WHERE code='FEE');
  c_compliance  UUID := (SELECT id FROM cost_item_categories WHERE code='COMPLIANCE');
  c_project     UUID := (SELECT id FROM cost_item_categories WHERE code='PROJECT_COST');
  c_adjustment  UUID := (SELECT id FROM cost_item_categories WHERE code='ADJUSTMENT');
BEGIN

  -- ── TEMP: Labor ────────────────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, tax_treatment, sap_cost_object_type) VALUES
    ('REG_HRS',      'Regular Hours',       'Standard billable hours at the agreed bill rate',           c_labor,     'hourly', true,  'standard', 'cost_center'),
    ('OT_125',       'Overtime 1.25×',      'Overtime at 125% of the regular rate',                      c_labor,     'hourly', true,  'standard', 'cost_center'),
    ('OT_150',       'Overtime 1.50×',      'Overtime at 150% of the regular rate',                      c_labor,     'hourly', true,  'standard', 'cost_center'),
    ('OT_200',       'Overtime 2.00×',      'Double-time overtime rate',                                 c_labor,     'hourly', true,  'standard', 'cost_center'),
    ('SHIFT_PREM',   'Shift Premium',       'Additional pay for shift work (early/late)',                c_labor,     'hourly', true,  'standard', 'cost_center'),
    ('NIGHT_PREM',   'Night Premium',       'Additional pay for night-shift hours',                      c_labor,     'hourly', true,  'standard', 'cost_center'),
    ('WEEKEND_PREM', 'Weekend Premium',     'Additional pay for weekend hours',                          c_labor,     'hourly', true,  'standard', 'cost_center'),
    ('HOLIDAY_PREM', 'Holiday Premium',     'Additional pay for public holiday hours',                   c_labor,     'hourly', true,  'standard', 'cost_center');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'temp' FROM cost_items
    WHERE code IN ('REG_HRS','OT_125','OT_150','OT_200','SHIFT_PREM','NIGHT_PREM','WEEKEND_PREM','HOLIDAY_PREM');

  -- ── TEMP: Statutory ────────────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, pass_through, tax_treatment, sap_cost_object_type) VALUES
    ('EMP_SOC_SEC',  'Employer Social Security', 'Statutory employer social security contributions',    c_statutory, 'percentage', false, true, 'standard', 'cost_center'),
    ('PENSION',      'Pension Contributions',     'Statutory employer pension contributions',            c_statutory, 'percentage', false, true, 'standard', 'cost_center'),
    ('HOLIDAY_PAY',  'Holiday Pay Accrual',       'Accrued holiday pay provision',                       c_statutory, 'percentage', false, true, 'standard', 'cost_center'),
    ('STAT_SICK',    'Statutory Sick Pay',         'Statutory sick pay as required by local law',        c_statutory, 'daily',      false, true, 'standard', 'cost_center');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'temp' FROM cost_items
    WHERE code IN ('EMP_SOC_SEC','PENSION','HOLIDAY_PAY','STAT_SICK');

  -- ── TEMP: Commercial ───────────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, tax_treatment, sap_cost_object_type) VALUES
    ('AGENCY_MARGIN','Agency Margin',        'MSP/staffing agency commercial margin',                   c_fee,       'percentage', false, 'standard', 'profit_center');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    VALUES ((SELECT id FROM cost_items WHERE code='AGENCY_MARGIN'), 'temp');

  -- ── TEMP: Expenses ─────────────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, pass_through, tax_treatment, sap_cost_object_type) VALUES
    ('TRAVEL_EXP',   'Travel Expenses',     'Reimbursable travel costs (tickets, taxi, etc.)',          c_expense,   'unit',       false, true, 'standard', 'cost_center'),
    ('MILEAGE',      'Mileage',             'Business mileage reimbursement at approved rate',          c_expense,   'unit',       false, true, 'standard', 'cost_center'),
    ('PPE',          'PPE',                 'Personal protective equipment costs',                       c_expense,   'unit',       false, true, 'exempt',   'cost_center'),
    ('UNIFORM',      'Uniform',             'Uniform and workwear costs',                               c_expense,   'unit',       false, true, 'exempt',   'cost_center'),
    ('OTHER_EXP',    'Other Expenses',      'Other approved reimbursable expenses',                     c_expense,   'unit',       false, true, 'standard', 'cost_center');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'temp' FROM cost_items
    WHERE code IN ('TRAVEL_EXP','MILEAGE','PPE','UNIFORM','OTHER_EXP');

  -- ── TEMP: Germany-specific (AÜG) ──────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, tax_treatment, sap_cost_object_type, countries) VALUES
    ('EQUAL_PAY',    'Equal Pay Surcharge (AÜG)',    'Mandatory equal-pay surcharge after 9 months per AÜG §8', c_compliance, 'percentage', true, 'standard', 'cost_center', ARRAY['DE']),
    ('BAP_IGZ',      'BAP / iGZ Tariff Surcharge',   'Tariff surcharge per BAP/DGB or iGZ/DGB collective agreement', c_compliance, 'percentage', true, 'standard', 'cost_center', ARRAY['DE']);

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'temp' FROM cost_items WHERE code IN ('EQUAL_PAY','BAP_IGZ');

  -- ── CONTRACTING: Labor ─────────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, tax_treatment, sap_cost_object_type) VALUES
    ('REG_HRS_CTR',  'Regular Hours (Contracting)', 'Standard billable hours for contractor engagement',  c_labor,  'hourly', true,  'standard', 'cost_center'),
    ('OPT_OT_CTR',   'Optional Overtime',           'Contractor overtime — by agreement only',            c_labor,  'hourly', true,  'standard', 'cost_center');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'contracting' FROM cost_items WHERE code IN ('REG_HRS_CTR','OPT_OT_CTR');

  -- ── CONTRACTING: Commercial ────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, tax_treatment, sap_cost_object_type) VALUES
    ('MARGIN_SPREAD','Margin Spread',        'Agency spread between pay and bill rate',                  c_fee,    'percentage', false, 'standard', 'profit_center'),
    ('MSP_FEE',      'MSP Program Fee',      'Managed Service Provider program fee',                    c_fee,    'percentage', false, 'standard', 'profit_center'),
    ('VMS_FEE',      'VMS Program Fee',      'Vendor Management System technology fee',                 c_fee,    'percentage', false, 'standard', 'profit_center');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'contracting' FROM cost_items WHERE code IN ('MARGIN_SPREAD','MSP_FEE','VMS_FEE');

  -- ── CONTRACTING: Expenses ──────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, pass_through, tax_treatment, sap_cost_object_type) VALUES
    ('TRAVEL_CTR',   'Travel (Contracting)',       'Approved travel costs for contractor assignments',   c_expense, 'unit', false, true, 'standard', 'cost_center'),
    ('ACCOMMODATION','Accommodation',              'Approved hotel / short-term accommodation',         c_expense, 'unit', false, true, 'standard', 'cost_center'),
    ('SUBSISTENCE',  'Subsistence',               'Daily subsistence / meal allowance',                c_expense, 'unit', false, true, 'standard', 'cost_center');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'contracting' FROM cost_items WHERE code IN ('TRAVEL_CTR','ACCOMMODATION','SUBSISTENCE');

  -- ── CONTRACTING: Compliance ────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, tax_treatment, sap_cost_object_type) VALUES
    ('IR35',         'IR35 Status',                   'IR35 / off-payroll status determination item',   c_compliance, 'unit', false, 'standard', 'cost_center'),
    ('SCHEINSELBST', 'Scheinselbstständigkeit Status', 'German false self-employment (§611a BGB) flag',  c_compliance, 'unit', false, 'standard', 'cost_center'),
    ('VAT_TREATMENT','VAT Treatment',                 'VAT applicability flag for contractor invoices',  c_compliance, 'unit', false, 'standard', 'cost_center');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'contracting' FROM cost_items WHERE code IN ('IR35','SCHEINSELBST','VAT_TREATMENT');

  -- IR35 is UK-specific; Scheinselbst is DE-specific
  UPDATE cost_items SET countries = ARRAY['GB'] WHERE code = 'IR35';
  UPDATE cost_items SET countries = ARRAY['DE'] WHERE code = 'SCHEINSELBST';

  -- ── SOW: Project Costs ─────────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, tax_treatment, sap_cost_object_type) VALUES
    ('MILESTONE_FEE','Milestone Fee',        'Fixed fee triggered by agreed milestone acceptance',      c_project, 'fixed',     true,  'standard', 'wbs_element'),
    ('DELIV_FEE',    'Deliverable Fee',      'Fee tied to a specific project deliverable',             c_project, 'fixed',     true,  'standard', 'wbs_element'),
    ('FIXED_PROJ',   'Fixed Project Fee',    'Fixed total project fee billed in agreed instalments',   c_project, 'fixed',     true,  'standard', 'wbs_element');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'sow' FROM cost_items WHERE code IN ('MILESTONE_FEE','DELIV_FEE','FIXED_PROJ');

  -- ── SOW: Time & Material ───────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, tax_treatment, sap_cost_object_type) VALUES
    ('CAPPED_HOURLY','Capped Hourly Costs',  'T&M hours billed up to an agreed cap amount',            c_labor,   'hourly', true, 'standard', 'wbs_element'),
    ('GOV_TIMESHEET','Governance Timesheet', 'Timesheets captured for governance only — not invoiced', c_labor,   'hourly', false,'standard', 'wbs_element');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'sow' FROM cost_items WHERE code IN ('CAPPED_HOURLY','GOV_TIMESHEET');

  -- ── SOW: Project Expenses ──────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, pass_through, tax_treatment, sap_cost_object_type) VALUES
    ('TRAVEL_SOW',   'Travel (SOW)',         'Project travel costs passed through to client',           c_expense, 'unit', false, true, 'standard', 'wbs_element'),
    ('MATERIALS',    'Materials',            'Project materials and consumables',                       c_expense, 'unit', false, true, 'standard', 'wbs_element'),
    ('SUBCONTRACTOR','Subcontractor Costs',  'Third-party subcontractor costs passed through',          c_expense, 'unit', false, true, 'standard', 'wbs_element');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'sow' FROM cost_items WHERE code IN ('TRAVEL_SOW','MATERIALS','SUBCONTRACTOR');

  -- ── SOW: Commercial Adjustments ────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, tax_treatment, sap_cost_object_type) VALUES
    ('CHANGE_ORDER', 'Change Order',         'Agreed scope change billed as an amendment',             c_adjustment, 'fixed',      true,  'standard', 'wbs_element'),
    ('RETAINAGE',    'Retainage',            'Amount withheld until project completion',               c_adjustment, 'percentage', false, 'standard', 'wbs_element'),
    ('HOLDBACK',     'Holdback',             'Contractual holdback released on acceptance',            c_adjustment, 'percentage', false, 'standard', 'wbs_element');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'sow' FROM cost_items WHERE code IN ('CHANGE_ORDER','RETAINAGE','HOLDBACK');

  -- ── PERM: Placement Fees ───────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, tax_treatment, sap_cost_object_type) VALUES
    ('PLACEMENT_FEE','Placement Fee',        'One-off recruitment placement fee',                      c_fee,        'fixed',      false, 'standard', 'profit_center'),
    ('FIXED_FEE',    'Fixed Fee',            'Pre-agreed fixed recruitment fee',                       c_fee,        'fixed',      false, 'standard', 'profit_center'),
    ('PCT_FEE',      'Percentage Fee',       'Fee as % of candidate first-year salary',               c_fee,        'percentage', false, 'standard', 'profit_center');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'perm' FROM cost_items WHERE code IN ('PLACEMENT_FEE','FIXED_FEE','PCT_FEE');

  -- ── PERM: Additional Fees ──────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, pass_through, tax_treatment, sap_cost_object_type) VALUES
    ('RETAINER',     'Retainer',             'Up-front retainer against placement success fee',        c_fee,     'fixed',  false, false, 'standard', 'profit_center'),
    ('RELOCATION',   'Relocation Reimb.',    'Candidate relocation reimbursement passed through',      c_expense, 'fixed',  false, true,  'exempt',   'cost_center'),
    ('SIGN_ON',      'Sign-on Bonus Reimb.', 'Sign-on bonus reimbursement if candidate leaves early', c_expense, 'fixed',  false, true,  'exempt',   'cost_center');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'perm' FROM cost_items WHERE code IN ('RETAINER','RELOCATION','SIGN_ON');

  -- ── PERM: Adjustments ─────────────────────────────────────────────────────
  INSERT INTO cost_items (code, name, description, category_id, billing_type, markup_eligible, tax_treatment, sap_cost_object_type) VALUES
    ('REPL_CREDIT',  'Replacement Credit',   'Credit issued when a guarantee replacement is provided', c_adjustment, 'fixed', false, 'standard', 'profit_center'),
    ('CREDIT_NOTE',  'Credit Note',          'General credit note against a prior invoice',           c_adjustment, 'fixed', false, 'standard', 'profit_center');

  INSERT INTO cost_item_contract_types (cost_item_id, contract_type)
    SELECT id, 'perm' FROM cost_items WHERE code IN ('REPL_CREDIT','CREDIT_NOTE');

END $$;
