import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/\r/g, '');
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].replace(/\r/g, '');
});

const supabase = createClient(url, key);
const tables = ['iota_pm_tasks', 'iota_financing_tasks', 'iota_development_tasks', 'iota_fund_tasks', 'iota_ipr_tasks', 'iota_marketing_tasks'];

async function check() {
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('id, task_name');
        if (data && data.length > 0) {
            console.log(table, data.length, data);
        } else {
            console.log(table, "Empty or Error");
        }
    }
}
check();
