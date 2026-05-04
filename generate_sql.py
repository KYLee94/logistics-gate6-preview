import re
import json

with open("src/components/system/stakeholder/StakeInternal.jsx", "r", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find("const stakeholderGroups = [")
end_idx = content.find("];\n\nexport default function StakeInternal()") + 1

groups_text = content[start_idx:end_idx]

unique_emails = set()
group_matches = re.finditer(r"groupTitle:\s*'([^']+)'(.*?)\]", groups_text, re.DOTALL)

output_sql = """-- IOTA Seoul Pilot Members Table Setup
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
('전기영', 'jk.jeon@igisam.com', 'WS_PM', 'master'),
"""

values = []

for match in group_matches:
    group_name = match.group(1)
    block = match.group(2)
    
    workspace_code = "WS_OTHER"
    if group_name == 'CFT 총괄': workspace_code = 'WS_MASTER'
    elif group_name == '사업PM': workspace_code = 'WS_PM'
    elif group_name == '파이낸싱': workspace_code = 'WS_FINANCING'
    elif group_name == '개발관리': workspace_code = 'WS_DEVELOPMENT'
    elif group_name == '기업마케팅': workspace_code = 'WS_MARKETING'
    elif group_name == '상품·디지털': workspace_code = 'WS_DIGITAL'
    elif group_name == '펀드운용': workspace_code = 'WS_FUND'
    elif group_name == 'IPR': workspace_code = 'WS_IPR'

    m_iter = re.finditer(r"name:\s*'([^']+)'(?:.*?responsibility:\s*'([^']+)')?.*?email:\s*'([^']+)'", block, re.DOTALL)
    for m in m_iter:
        name = m.group(1)
        resp = m.group(2)
        email = m.group(3)
        
        if email in unique_emails: continue
        unique_emails.add(email)
        
        role_code = 'manager'
        if group_name == 'CFT 총괄':
            role_code = 'master'
        elif resp and '책임인력' in resp:
            role_code = 'director'
            
        values.append(f"('{name}', '{email}', '{workspace_code}', '{role_code}')")

output_sql += ",\n".join(values) + ";"

with open("setup.sql", "w", encoding="utf-8") as f:
    f.write(output_sql)

print("Generated setup.sql")
