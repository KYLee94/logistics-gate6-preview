const fs = require('fs');
const groups = require('./temp_groups.cjs');

let output_sql = `-- IOTA Seoul Pilot Members Table Setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS public.iota_seoul_pilot_members;

CREATE TABLE public.iota_seoul_pilot_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID,
    staff_id VARCHAR,
    staff_name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    org_name VARCHAR,
    workspace_code VARCHAR,
    role_code VARCHAR CHECK (role_code IN ('master', 'director', 'manager')),
    allowed_project_ids JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.iota_seoul_pilot_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.iota_seoul_pilot_members FOR SELECT USING (true);
CREATE POLICY "Allow individual update" ON public.iota_seoul_pilot_members FOR UPDATE USING (true);

INSERT INTO public.iota_seoul_pilot_members (staff_name, email, workspace_code, role_code) VALUES
('전기영', 'jk.jeon@igisam.com', 'WS_PM', 'master')`;

const uniqueEmails = new Set();
uniqueEmails.add('jk.jeon@igisam.com');

const values = [];

groups.forEach(group => {
    let workspace_code = "WS_OTHER";
    if (group.groupTitle === 'CFT 총괄') workspace_code = 'WS_MASTER';
    else if (group.groupTitle === '사업PM') workspace_code = 'WS_PM';
    else if (group.groupTitle === '파이낸싱') workspace_code = 'WS_FINANCING';
    else if (group.groupTitle === '개발관리') workspace_code = 'WS_DEVELOPMENT';
    else if (group.groupTitle === '기업마케팅') workspace_code = 'WS_MARKETING';
    else if (group.groupTitle === '상품·디지털') workspace_code = 'WS_DIGITAL';
    else if (group.groupTitle === '펀드운용') workspace_code = 'WS_FUND';
    else if (group.groupTitle === 'IPR') workspace_code = 'WS_IPR';

    group.members.forEach(member => {
        if (!member.email || uniqueEmails.has(member.email)) return;
        uniqueEmails.add(member.email);

        let role_code = 'manager';
        if (group.groupTitle === 'CFT 총괄') {
            role_code = 'master';
        } else if (member.responsibility && member.responsibility.includes('책임인력')) {
            role_code = 'director';
        }

        values.push(`('${member.name}', '${member.email}', '${workspace_code}', '${role_code}')`);
    });
});

if (values.length > 0) {
    output_sql += ",\n" + values.join(",\n") + ";\n";
} else {
    output_sql += ";\n";
}

fs.writeFileSync('setup.sql', output_sql);
console.log('setup.sql successfully generated with ' + values.length + ' members.');
