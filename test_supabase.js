import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read supabase url and key from .env
const envFile = fs.readFileSync('.env', 'utf8');
let url = '';
let key = '';
envFile.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1];
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1];
});

const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('iota_pm_tasks').select('*');
    if (error) {
        console.error("Supabase Error:", error);
    } else {
        console.log("Supabase iota_pm_tasks count:", data.length);
        console.log(JSON.stringify(data, null, 2));
    }
}

check();
