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
    const { error } = await supabase.from('iota_pm_tasks').insert([{
        id: "test1",
        created_at: new Date().toISOString(),
        task_name: "test",
        company_name: "test",
        related_asset: "IOTA 공통",
        status: "신규",
        priority: "중간",
        due_date: "2024-01-01",
        next_action: "test"
    }]);
    if (error) {
        console.error("Insert Error:", error);
    } else {
        console.log("Insert Success!");
    }
}

check();
