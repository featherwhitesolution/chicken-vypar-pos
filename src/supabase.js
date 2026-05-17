import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zknmahoepgcemsqbqoxy.supabase.co';
const supabaseAnonKey = 'sb_publishable_BaETkiC_eFDYVgQ4sH-kWg_6IqmsQwH';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
