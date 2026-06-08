import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zptvmsrsdubxraqudzvb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwdHZtc3JzZHVieHJhcXVkenZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTk0MzAsImV4cCI6MjA5NjQ3NTQzMH0.78LNGzcjkcw2Px0ikTSpC_y9fjSuQ4oF_E1slSmMB2c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


export { supabase }