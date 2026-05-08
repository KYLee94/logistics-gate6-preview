import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.VITE_SUPABASE_URL) {
    console.error('No VITE_SUPABASE_URL');
    process.exit(1);
}
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data, error } = await supabase.from('iota_assets').select('*').limit(1);
    console.log('iota_assets error:', error ? error.message : 'no error');
}
run();
