CREATE TABLE IF NOT EXISTS contracts_generated (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  employee_id bigint REFERENCES employees(id) ON DELETE SET NULL,
  stage text NOT NULL,
  generated_by text
);

CREATE INDEX IF NOT EXISTS contracts_generated_employee_id_idx ON contracts_generated(employee_id);
CREATE INDEX IF NOT EXISTS contracts_generated_stage_idx ON contracts_generated(stage);
