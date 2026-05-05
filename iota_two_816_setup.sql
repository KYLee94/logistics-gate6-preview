-- IOTA Two 816 Tables Setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Building Comparison
DROP TABLE IF EXISTS public.iota_building_comparison;
CREATE TABLE public.iota_building_comparison (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR NOT NULL,
    image VARCHAR,
    region VARCHAR,
    year VARCHAR,
    gfa VARCHAR,
    office_area VARCHAR,
    retail_area VARCHAR,
    floor_area VARCHAR,
    scale VARCHAR,
    ceiling_height VARCHAR,
    parking VARCHAR,
    constructor VARCHAR,
    architect VARCHAR,
    lease_span VARCHAR,
    monthly_gi VARCHAR,
    yearly_gi VARCHAR,
    yearly_noi VARCHAR,
    enoc_2026 VARCHAR,
    enoc_2032 VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.iota_building_comparison ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.iota_building_comparison FOR SELECT USING (true);

INSERT INTO public.iota_building_comparison 
(title, image, region, year, gfa, office_area, retail_area, floor_area, scale, ceiling_height, parking, constructor, architect, lease_span, monthly_gi, yearly_gi, yearly_noi, enoc_2026, enoc_2032)
VALUES 
('Centerfield', '/centerfield.webp', 'GBD', '2021', '72,374평', '51,189평', '2,288평', '599/529평', 'B9 / 34F', '3.00m', '889 대', '현대건설, 현대엔지..', 'JMA, dA', '16m', '211억', '2,533억', '2,153억', '523,100원', '621,802원'),
('그랑서울', '/gran.webp', 'CBD', '2014', '53,100평', '50,753평', '2,347평', '605평', 'B7 / 24F', '2.80m', '754 대', 'GS건설', '창조', '-', '122억', '1,467억', '1,247억', '430,512원', '511,743원'),
('파르나스타워', '/parnas.webp', 'GBD', '2016', '73,648평', '- 평', '- 평', '535평', 'B1 / 40F', '3.00m', '464 대', 'GS건설', 'KMD, 창조', '-', '181억', '2,175억', '1,849억', '522,000원', '620,494원'),
('GFC', '/gfc.webp', 'GBD', '2001', '64,316평', '64,316평', '3,000평', '722평', 'B8 / 45F', '2.70m', '1,312 대', '현대산업개발', 'KRJDA', '15m', '149억', '1,791억', '1,523억', '433,918원', '515,792원');


-- 2. Marketing History
DROP TABLE IF EXISTS public.iota_marketing_history;
CREATE TABLE public.iota_marketing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    url VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.iota_marketing_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.iota_marketing_history FOR SELECT USING (true);

INSERT INTO public.iota_marketing_history (type, title, url) VALUES
('[자체생산]', 'Design Presentation by Luke Fox (Interview 영상)', '#'),
('[기획기사]', 'AI시대 ''서울의 지식 허브'' 떠오르는 6개 핵심 지역은', '#'),
('[기획기사]', 'NH투자증권, 이오타2 프로젝트에 1300억 투입... 리파이낸싱 마무리 수순', '#');


-- 3. Building Specs
DROP TABLE IF EXISTS public.iota_building_specs;
CREATE TABLE public.iota_building_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR NOT NULL,
    label VARCHAR NOT NULL,
    value VARCHAR NOT NULL,
    highlight VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.iota_building_specs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.iota_building_specs FOR SELECT USING (true);

INSERT INTO public.iota_building_specs (category, label, value, highlight) VALUES
('eco', '[Global]', '사전인증 예정', 'LEED Gold'),
('eco', '[Global]', '사전인증 예정', 'Wiredscore / Smartscore'),
('eco', '[Global]', '인증 준비중', 'WELL'),
('spec', '[통합 빌딩 관리 시스템]', '통합 SI + FMS 구축 - 클라우드 BEMS, FMS, 통합제어(HVAC 포함), 원격관리', NULL),
('spec', '[네트워크]', '초고속정보통신 1등급 (초고속정보통신 특등급으로 변경 진행중)', NULL),
('spec', '[엘리베이터]', '독일 TKE 제품 트윈 24인승 8대, 천장고 2.7이상 확보가능', NULL);


-- 4. Research Insights
DROP TABLE IF EXISTS public.iota_research_insights;
CREATE TABLE public.iota_research_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    icon VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    url VARCHAR,
    is_bright BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.iota_research_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.iota_research_insights FOR SELECT USING (true);

INSERT INTO public.iota_research_insights (icon, title, url, is_bright) VALUES
('📊', '현재 개발중인 3대권역 5만평 이상 복합 프로젝트 원가 DATA', '#', false),
('📍', '서울 도심 내 5,000평 이상 거래 가능한 상업부지', '#', false),
('🏢', '국내 매출 TOP 100 기업 임차 현황', '#', false),
('⚡', '서울 오피스 전기사용량과 주요 프라임 오피스 전력인프라 현황', '#', true);

