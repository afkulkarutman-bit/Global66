import { createClient } from '@supabase/supabase-js';

// Separate Supabase project for payroll tables
export const supabasePayroll = createClient(
  process.env.PAYROLL_SUPABASE_URL!,
  process.env.PAYROLL_SUPABASE_SERVICE_ROLE_KEY ?? process.env.PAYROLL_SUPABASE_ANON_KEY!
);
