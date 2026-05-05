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
    console.log("Attempting to insert 골드만삭스...");
    const { data, error } = await supabase.from('iota_stakeholder_master').insert({
        company_name: '골드만삭스',
        contact_name: null,
        role_category: null
    });
    console.log("Result:", data, "Error:", error);
}
checkLog();
