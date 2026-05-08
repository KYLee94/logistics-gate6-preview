import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
let url = '';
let key = '';
envFile.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/\r/g, '');
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].replace(/\r/g, '');
});

const supabase = createClient(url, key);

async function check() {
    await supabase.from('iota_pm_tasks').delete().eq('id', 'test1');
    console.log("Deleted test");
}
check();
