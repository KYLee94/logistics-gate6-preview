-- IOTA Seoul Pilot Members Table Setup
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
('이철승', 'ethan.lee@igisam.com', 'WS_MASTER', 'master'),
('윤관식', 'gwansik.yoon@igisam.com', 'WS_MASTER', 'master'),
('정조민', 'jmjung@igisam.com', 'WS_MASTER', 'master'),
('우형석', 'hyungsuk.woo@igisam.com', 'WS_MASTER', 'master'),
('권순일', 'ksoonil@igisam.com', 'WS_PM', 'director'),
('강순용', 'sykang@igisam.com', 'WS_PM', 'director'),
('윤주형', 'jh.yoon@igisam.com', 'WS_PM', 'manager'),
('김제익', 'jake.kim@igisam.com', 'WS_PM', 'manager'),
('류홍', 'ryuhong0526@igisam.com', 'WS_PM', 'manager'),
('박만진', 'jacob.park@igisam.com', 'WS_PM', 'manager'),
('박일훈', 'ilhoon.park@igisam.com', 'WS_PM', 'manager'),
('이정원', 'garden.lee@igisam.com', 'WS_PM', 'manager'),
('전무경', 'mooj@igisam.com', 'WS_PM', 'manager'),
('한찬호', 'chanho.han@igisam.com', 'WS_PM', 'manager'),
('박석제', 'seokje.park@igisam.com', 'WS_PM', 'manager'),
('박채현', 'p.chhyn@igisam.com', 'WS_PM', 'manager'),
('소현준', 'hyunjoon.so@igisam.com', 'WS_PM', 'manager'),
('이수정', 'sjl1747@igisam.com', 'WS_PM', 'manager'),
('조영비', 'youngbi@igisam.com', 'WS_PM', 'manager'),
('한수정', 'soojeong.han@igisam.com', 'WS_PM', 'manager'),
('박준호', 'junhopark@igisam.com', 'WS_FINANCING', 'director'),
('강석민', 'sm.kang@igisam.com', 'WS_FINANCING', 'manager'),
('정리훈', 'jlh@igisam.com', 'WS_FINANCING', 'manager'),
('손유정', 'yujung.son@igisam.com', 'WS_FINANCING', 'manager'),
('김지우', 'jiwoo@igisam.com', 'WS_FINANCING', 'manager'),
('박현승', 'hyunpark@igisam.com', 'WS_FINANCING', 'manager'),
('이성민A', 'stealth@igisam.com', 'WS_FINANCING', 'manager'),
('한승환', 'seunghwanhan@igisam.com', 'WS_FINANCING', 'manager'),
('홍장군', 'jghong@igisam.com', 'WS_DEVELOPMENT', 'director'),
('채원', 'won.chae@igisam.com', 'WS_DEVELOPMENT', 'manager'),
('김보성', 'kbs1208@igisam.com', 'WS_DEVELOPMENT', 'manager'),
('전승희', 'shjeon@igisam.com', 'WS_DEVELOPMENT', 'manager'),
('김대익', 'dikim@igisam.com', 'WS_DEVELOPMENT', 'manager'),
('장성진', 'jang.sj@igisam.com', 'WS_DEVELOPMENT', 'manager'),
('이정훈', '2019jhlee@igisam.com', 'WS_DEVELOPMENT', 'manager'),
('박봉서', 'okbong21@igisam.com', 'WS_DEVELOPMENT', 'manager'),
('김민지', 'minjik@igisam.com', 'WS_MARKETING', 'director'),
('고아라', 'argoh@igisam.com', 'WS_MARKETING', 'manager'),
('이가현', 'ghlee@igisam.com', 'WS_MARKETING', 'manager'),
('정수명', 'smchung@igisam.com', 'WS_MARKETING', 'manager'),
('김현수', 'hyunsoo.kim@igisam.com', 'WS_DIGITAL', 'director'),
('현철호', 'chyun@igisam.com', 'WS_DIGITAL', 'director'),
('신민호', 'rossshin@igisam.com', 'WS_DIGITAL', 'manager'),
('김행단', 'hkim@igisam.com', 'WS_FUND', 'director'),
('윤용택', 'yongtek.yoon@igisam.com', 'WS_IPR', 'director');
