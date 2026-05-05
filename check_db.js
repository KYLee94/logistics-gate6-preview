import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

let url = '';
let key = '';

envContent.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function checkLog() {
    console.log("--- Checking Master DB ---");
    const { data: masterData } = await supabase.from('iota_stakeholder_master').select('*').like('company_name', '%I.O.IV%');
    console.log("Master Data:", masterData);

    console.log("\n--- Checking Logs ---");
    const { data: logsData } = await supabase.from('iota_seoul_logs').select('log_id, raw_text, created_at').like('raw_text', '%ㅇㄹㄹㄷㄷ%');
    console.log("Logs:", logsData);
    
    if (logsData && logsData.length > 0) {
        console.log("\n--- Checking Log Stakeholders ---");
        const { data: logShData } = await supabase.from('iota_seoul_log_stakeholders').select('*').eq('log_id', logsData[0].log_id);
        console.log("Log Stakeholders:", logShData);
    }
}
checkLog();
