CREATE TABLE IF NOT EXISTS scenario_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  tenant_name text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  happy_pass int NOT NULL DEFAULT 0,
  happy_fail int NOT NULL DEFAULT 0,
  unhappy_pass int NOT NULL DEFAULT 0,
  unhappy_fail int NOT NULL DEFAULT 0,
  total_steps int NOT NULL DEFAULT 0,
  step_results jsonb NOT NULL DEFAULT '[]',
  optimization_ideas jsonb DEFAULT NULL,
  triggered_by text DEFAULT 'manual',
  notes text,
  created_by_name text
);

CREATE INDEX IF NOT EXISTS idx_scenario_runs_tenant_run_at ON scenario_runs(tenant_id, run_at DESC);
ALTER TABLE scenario_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scenario_runs_select" ON scenario_runs FOR SELECT USING (get_my_role() IN ('admin', 'super_admin'));
CREATE POLICY "scenario_runs_insert" ON scenario_runs FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'super_admin'));
CREATE POLICY "scenario_runs_update" ON scenario_runs FOR UPDATE USING (get_my_role() IN ('admin', 'super_admin'));
