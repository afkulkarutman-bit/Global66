import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.PAYROLL_SUPABASE_URL!,
  process.env.PAYROLL_SUPABASE_SERVICE_ROLE_KEY ?? process.env.PAYROLL_SUPABASE_ANON_KEY!
);
